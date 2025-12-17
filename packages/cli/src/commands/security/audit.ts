/**
 * @module commands/security/audit
 * @description Dependency vulnerability scanning command
 * @node-only
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { pathToFileURL } from 'url'
import pc from 'picocolors'
import type {
  AuditOptions,
  AuditResult,
  AuditSummary,
  FixResult,
  PnpmAuditOutput,
  Vulnerability,
  VulnerabilitySeverity,
} from './types'

/** Valid audit severity levels */
const VALID_AUDIT_LEVELS: readonly VulnerabilitySeverity[] = ['low', 'moderate', 'high', 'critical']

/**
 * Validate and sanitize cwd path to prevent path injection
 * @throws Error if path is invalid or contains suspicious patterns
 */
function validateCwd(cwd: string): string {
  // Reject path traversal attempts
  if (cwd.includes('..')) {
    throw new Error('Invalid working directory: path traversal not allowed')
  }
  // Reject null bytes (path injection)
  if (cwd.includes('\0')) {
    throw new Error('Invalid working directory: null bytes not allowed')
  }
  // Reject shell metacharacters that could be dangerous
  const dangerousChars = /[;&|`$(){}[\]<>!]/
  if (dangerousChars.test(cwd)) {
    throw new Error('Invalid working directory: contains shell metacharacters')
  }
  return cwd
}

/**
 * Validate audit options at runtime
 * @throws Error if options are invalid
 */
function validateAuditOptions(options: AuditOptions): void {
  // Validate auditLevel if provided
  if (options.auditLevel !== undefined) {
    if (!VALID_AUDIT_LEVELS.includes(options.auditLevel)) {
      throw new Error(
        `Invalid audit level: "${options.auditLevel}". Valid levels: ${VALID_AUDIT_LEVELS.join(', ')}`
      )
    }
  }

  // Validate mutually exclusive options
  if (options.prod && options.dev) {
    throw new Error('Cannot specify both --prod and --dev')
  }
}

/**
 * Main audit command entry point
 */
export async function audit(options: AuditOptions = {}): Promise<void> {
  // Validate options at runtime (defense in depth - don't trust caller)
  validateAuditOptions(options)

  // Validate and sanitize cwd
  const cwd = validateCwd(options.cwd || process.cwd())

  // CI mode sets defaults
  if (options.ci) {
    options.prod = options.prod ?? true
    options.auditLevel = options.auditLevel ?? 'high'
  }

  // Load ignore configuration
  const ignoredCves = await loadIgnoredCves(cwd, options.ignoreCves)

  try {
    if (options.fix) {
      const fixResult = await runAuditFix(cwd, options, ignoredCves)
      displayFixResults(fixResult, options.json)
      process.exit(0)
    }

    const result = await runAudit(cwd, options, ignoredCves)

    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      displayAuditResults(result, options)
    }

    // Exit with error code if vulnerabilities found at/above threshold
    const hasRelevantVulns = shouldFail(result, options.auditLevel)
    process.exit(hasRelevantVulns ? 1 : 0)
  } catch (error) {
    // Sanitize error output - don't expose internal details
    const safeMessage = getSafeErrorMessage(error)
    console.error(pc.red('Error running audit:'), safeMessage)
    if (process.env.DEBUG === 'true') {
      console.error(pc.gray('Debug details:'), error)
    }
    process.exit(1)
  }
}

/**
 * Extract a safe error message without exposing sensitive details
 */
function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Filter out potentially sensitive information from error messages
    const message = error.message
    // Remove file paths that might expose system structure
    const sanitized = message.replace(/\/[^\s]+/g, '[path]').replace(/\\[^\s]+/g, '[path]')
    // Limit message length
    return sanitized.length > 200 ? sanitized.slice(0, 200) + '...' : sanitized
  }
  return 'An unexpected error occurred'
}

/**
 * Run pnpm audit and parse results
 */
async function runAudit(
  cwd: string,
  options: AuditOptions,
  ignoredCves: string[]
): Promise<AuditResult> {
  const args = ['audit', '--json']

  if (options.auditLevel) {
    args.push('--audit-level', options.auditLevel)
  }
  if (options.prod) {
    args.push('--prod')
  }
  if (options.dev) {
    args.push('--dev')
  }

  const output = await executePnpmAudit(cwd, args)
  return parseAuditOutput(output, ignoredCves)
}

/**
 * Execute pnpm audit command
 * Note: shell is only enabled on Windows where it's required for pnpm to work
 */
function executePnpmAudit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // Only use shell on Windows where it's required for PATH resolution
    const useShell = process.platform === 'win32'
    const proc = spawn('pnpm', args, { cwd, shell: useShell })
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      // pnpm audit returns 1 when vulnerabilities found, which is expected
      // Only reject on unexpected errors
      if (code !== null && code !== 0 && code !== 1) {
        reject(new Error(`pnpm audit failed with code ${code}: ${stderr}`))
      } else {
        resolve(stdout)
      }
    })

    proc.on('error', (error) => {
      reject(new Error(`Failed to spawn pnpm: ${error.message}`))
    })
  })
}

/**
 * Extract CVE ID from advisory URL or metadata
 * Advisory URLs are typically: https://github.com/advisories/GHSA-xxxx-xxxx-xxxx
 * or may contain CVE references in the overview/title
 */
function extractCveId(advisory: {
  id: number
  url: string
  overview: string
  title: string
}): string {
  // Try to extract CVE from URL (some advisories link directly to CVE)
  const urlCveMatch = advisory.url?.match(/CVE-\d{4}-\d+/)
  if (urlCveMatch) {
    return urlCveMatch[0]
  }

  // Try to extract CVE from overview or title
  const overviewCveMatch = advisory.overview?.match(/CVE-\d{4}-\d+/)
  if (overviewCveMatch) {
    return overviewCveMatch[0]
  }

  const titleCveMatch = advisory.title?.match(/CVE-\d{4}-\d+/)
  if (titleCveMatch) {
    return titleCveMatch[0]
  }

  // Extract GHSA ID from URL if present
  const ghsaMatch = advisory.url?.match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/)
  if (ghsaMatch) {
    return ghsaMatch[0]
  }

  // Fall back to numeric advisory ID (npm registry ID)
  return String(advisory.id)
}

/**
 * Parse pnpm audit JSON output
 */
function parseAuditOutput(output: string, ignoredCves: string[]): AuditResult {
  try {
    const data: PnpmAuditOutput = JSON.parse(output)
    const vulnerabilities: Vulnerability[] = []

    // Parse advisories
    for (const [advisoryId, advisory] of Object.entries(data.advisories || {})) {
      // Extract the actual CVE/GHSA ID from advisory metadata
      const vulnId = extractCveId(advisory)

      // Skip ignored vulnerabilities (check multiple ID formats)
      const idsToCheck = [vulnId, advisoryId, String(advisory.id)]
      if (idsToCheck.some((id) => ignoredCves.includes(id))) {
        continue
      }

      for (const finding of advisory.findings || []) {
        for (const path of finding.paths || []) {
          vulnerabilities.push({
            id: vulnId,
            severity: advisory.severity,
            package: advisory.module_name,
            version: finding.version,
            fixedIn: advisory.patched_versions,
            path: path.split('>').map((p) => p.trim()),
            description: advisory.overview || advisory.title,
            url: advisory.url,
          })
        }
      }
    }

    // Calculate summary
    const summary: AuditSummary = {
      total: vulnerabilities.length,
      critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
      high: vulnerabilities.filter((v) => v.severity === 'high').length,
      moderate: vulnerabilities.filter((v) => v.severity === 'moderate').length,
      low: vulnerabilities.filter((v) => v.severity === 'low').length,
    }

    return {
      vulnerabilities,
      summary,
      ignored: ignoredCves,
    }
  } catch {
    // Don't expose raw parsing errors which may contain sensitive data
    throw new Error(
      'Failed to parse audit output. Ensure pnpm is installed and the project has a valid package.json.'
    )
  }
}

/**
 * Load ignored CVEs/GHSA IDs from configuration sources
 * Priority (lowest to highest):
 * 1. edge.config.ts security.audit.ignoreCves
 * 2. .ixignore file
 * 3. CLI --ignore flags (via cliIgnores)
 */
async function loadIgnoredCves(cwd: string, cliIgnores?: string[]): Promise<string[]> {
  const ignored = new Set<string>()

  // 1. Try loading from edge.config.ts
  await loadIgnoresFromEdgeConfig(cwd, ignored)

  // 2. Try loading from .ixignore file
  await loadIgnoresFromIxignore(cwd, ignored)

  // 3. CLI ignores have highest priority (already in set, just add them)
  if (cliIgnores) {
    for (const cve of cliIgnores) {
      ignored.add(cve)
    }
  }

  return Array.from(ignored)
}

/**
 * Load ignored CVEs from edge.config.ts security.audit.ignoreCves
 */
async function loadIgnoresFromEdgeConfig(cwd: string, ignored: Set<string>): Promise<void> {
  const configPaths = ['edge.config.ts', 'edge.config.js', 'edge.config.mjs']

  for (const configPath of configPaths) {
    const fullPath = join(cwd, configPath)
    if (!existsSync(fullPath)) continue

    try {
      const configUrl = pathToFileURL(fullPath).href
      const configModule = await import(configUrl)
      const config = configModule.default

      // Navigate to security.audit.ignoreCves
      const ignoreCves = config?.security?.audit?.ignoreCves
      if (Array.isArray(ignoreCves)) {
        for (const cve of ignoreCves) {
          if (typeof cve === 'string') {
            ignored.add(cve)
          }
        }
      }
      break // Found config, stop looking
    } catch {
      // Config file exists but failed to load/parse, continue to next option
    }
  }
}

/**
 * Load ignored CVEs/GHSA IDs from .ixignore file
 * Supports both CVE-YYYY-NNNNN and GHSA-xxxx-xxxx-xxxx formats
 */
async function loadIgnoresFromIxignore(cwd: string, ignored: Set<string>): Promise<void> {
  try {
    const ixignorePath = join(cwd, '.ixignore')
    const content = await readFile(ixignorePath, 'utf-8')
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue

      // Extract CVE ID (CVE-YYYY-NNNNN format)
      const cveMatch = trimmed.match(/^(CVE-\d{4}-\d+)/)
      if (cveMatch) {
        ignored.add(cveMatch[1])
        continue
      }

      // Extract GHSA ID (GHSA-xxxx-xxxx-xxxx format)
      const ghsaMatch = trimmed.match(/^(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})/)
      if (ghsaMatch) {
        ignored.add(ghsaMatch[1])
        continue
      }

      // Also support numeric advisory IDs (npm registry format)
      const numericMatch = trimmed.match(/^(\d+)/)
      if (numericMatch) {
        ignored.add(numericMatch[1])
      }
    }
  } catch {
    // .ixignore doesn't exist or can't be read, that's fine
  }
}

/**
 * Display audit results in human-readable format
 */
function displayAuditResults(result: AuditResult, _options: AuditOptions): void {
  console.log('\n' + pc.bold('Scanning dependencies...') + '\n')

  if (result.summary.total === 0) {
    console.log(pc.green('✓ No vulnerabilities found'))
    if (result.ignored.length > 0) {
      console.log(pc.gray(`  (${result.ignored.length} CVEs ignored via configuration)`))
    }
    return
  }

  console.log(
    pc.yellow(
      `Found ${result.summary.total} ${result.summary.total === 1 ? 'vulnerability' : 'vulnerabilities'}:\n`
    )
  )

  // Group by severity for cleaner output
  const groupedBySeverity = groupVulnerabilitiesBySeverity(result.vulnerabilities)

  for (const severity of ['critical', 'high', 'moderate', 'low'] as VulnerabilitySeverity[]) {
    const vulns = groupedBySeverity[severity] || []
    if (vulns.length === 0) continue

    const color = getSeverityColor(severity)
    const label = severity.toUpperCase()

    for (const vuln of vulns) {
      console.log(color(`${label}: ${vuln.package} ${vuln.version}`))
      console.log(`  Path: ${vuln.path.join(' > ')}`)
      if (vuln.fixedIn) {
        console.log(`  Fix: Update to ${vuln.fixedIn}`)
      } else {
        console.log(`  Fix: No patch available`)
      }
      if (vuln.url) {
        console.log(pc.gray(`  URL: ${vuln.url}`))
      }
      console.log('')
    }
  }

  if (result.ignored.length > 0) {
    console.log(pc.gray(`${result.ignored.length} CVEs ignored via configuration\n`))
  }

  console.log(pc.yellow(`Run ${pc.bold('ix security:audit --fix')} to auto-fix where possible.\n`))
}

/**
 * Group vulnerabilities by severity
 */
function groupVulnerabilitiesBySeverity(
  vulnerabilities: Vulnerability[]
): Record<VulnerabilitySeverity, Vulnerability[]> {
  const grouped: Record<VulnerabilitySeverity, Vulnerability[]> = {
    critical: [],
    high: [],
    moderate: [],
    low: [],
  }

  for (const vuln of vulnerabilities) {
    grouped[vuln.severity].push(vuln)
  }

  return grouped
}

/**
 * Get color function for severity level
 */
function getSeverityColor(severity: VulnerabilitySeverity): (str: string) => string {
  switch (severity) {
    case 'critical':
    case 'high':
      return pc.red
    case 'moderate':
      return pc.yellow
    case 'low':
      return pc.gray
  }
}

/**
 * Determine if audit should fail based on severity threshold
 */
function shouldFail(result: AuditResult, auditLevel?: VulnerabilitySeverity): boolean {
  if (!auditLevel) return result.summary.total > 0

  const severityOrder: VulnerabilitySeverity[] = ['low', 'moderate', 'high', 'critical']
  const thresholdIndex = severityOrder.indexOf(auditLevel)

  for (let i = thresholdIndex; i < severityOrder.length; i++) {
    const severity = severityOrder[i]
    if (result.summary[severity] > 0) return true
  }

  return false
}

/**
 * Run audit with --fix flag
 * Performs pre/post fix audits to calculate actual fixes applied
 *
 * IMPORTANT: pnpm audit --fix is unaware of Ixflare's ignore configuration.
 * This function warns users if ignored vulnerabilities might be affected,
 * and uses pnpm's --ignore flag (v10+) when possible.
 */
async function runAuditFix(
  cwd: string,
  options: AuditOptions,
  ignoredCves: string[]
): Promise<FixResult> {
  // 1. Get pre-fix vulnerability state (without filtering ignores)
  const preFixResultAll = await runAudit(cwd, options, [])

  // 2. Check if any vulnerabilities match ignored CVEs
  const ignoredVulns = preFixResultAll.vulnerabilities.filter((v) =>
    ignoredCves.some((ignored) => v.id === ignored || v.id.includes(ignored))
  )

  if (ignoredVulns.length > 0) {
    // Warn user about ignored vulnerabilities that pnpm might try to fix
    console.log(pc.yellow('\n⚠ Warning: The following vulnerabilities are in your ignore list:'))
    for (const vuln of ignoredVulns) {
      console.log(pc.yellow(`  - ${vuln.id}: ${vuln.package}@${vuln.version}`))
    }
    console.log(pc.yellow('\npnpm audit --fix may still attempt to update these packages.'))
    console.log(
      pc.yellow(
        'If this causes issues, you can revert with: git checkout package.json pnpm-lock.yaml\n'
      )
    )
  }

  // Build args for fix command
  const args = ['audit', '--fix']
  if (options.prod) {
    args.push('--prod')
  }
  if (options.dev) {
    args.push('--dev')
  }

  // Pass ignored CVEs to pnpm (supported in pnpm v10.11.0+)
  // This prevents pnpm from trying to fix intentionally ignored vulnerabilities
  for (const cve of ignoredCves) {
    args.push('--ignore', cve)
  }

  try {
    // 3. Run pnpm audit --fix
    await executePnpmAudit(cwd, args)

    // 4. Get post-fix vulnerability state
    const postFixResult = await runAudit(cwd, options, [])

    // 5. Calculate which vulnerabilities were fixed
    const preFixPackages = new Map<string, Vulnerability>()
    for (const vuln of preFixResultAll.vulnerabilities) {
      preFixPackages.set(`${vuln.package}@${vuln.version}`, vuln)
    }

    const postFixPackageKeys = new Set<string>()
    for (const vuln of postFixResult.vulnerabilities) {
      postFixPackageKeys.add(`${vuln.package}@${vuln.version}`)
    }

    // Find packages that were fixed (present before, not present after)
    const fixes: FixResult['fixes'] = []
    for (const [key, vuln] of preFixPackages) {
      if (!postFixPackageKeys.has(key)) {
        // Skip counting ignored vulnerabilities as "fixed"
        if (ignoredCves.some((ignored) => vuln.id === ignored || vuln.id.includes(ignored))) {
          continue
        }
        fixes.push({
          package: vuln.package,
          fromVersion: vuln.version,
          toVersion: vuln.fixedIn || 'patched',
          method: 'direct-update', // pnpm audit --fix uses overrides
        })
      }
    }

    // Deduplicate fixes (same package may have multiple vulnerabilities)
    const uniqueFixes = new Map<string, FixResult['fixes'][0]>()
    for (const fix of fixes) {
      const key = `${fix.package}@${fix.fromVersion}`
      if (!uniqueFixes.has(key)) {
        uniqueFixes.set(key, fix)
      }
    }

    // Calculate remaining (excluding ignored)
    const remainingNonIgnored = postFixResult.vulnerabilities.filter(
      (v) => !ignoredCves.some((ignored) => v.id === ignored || v.id.includes(ignored))
    ).length

    return {
      fixed: uniqueFixes.size,
      remaining: remainingNonIgnored,
      fixes: Array.from(uniqueFixes.values()),
    }
  } catch {
    // If fix fails, return what we know
    const remainingNonIgnored = preFixResultAll.vulnerabilities.filter(
      (v) => !ignoredCves.some((ignored) => v.id === ignored || v.id.includes(ignored))
    ).length
    return {
      fixed: 0,
      remaining: remainingNonIgnored,
      fixes: [],
    }
  }
}

/**
 * Display fix results
 */
function displayFixResults(result: FixResult, json?: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log('\n' + pc.bold('Auto-fixing vulnerabilities...') + '\n')

  if (result.fixes.length > 0) {
    for (const fix of result.fixes) {
      console.log(pc.green(`✓ Updated ${fix.package}: ${fix.fromVersion} → ${fix.toVersion}`))
    }
  }

  if (result.remaining > 0) {
    console.log(pc.yellow(`\n✗ ${result.remaining} vulnerabilities require manual action\n`))
  } else {
    console.log(pc.green('\n✓ All vulnerabilities fixed\n'))
  }

  console.log(`Summary: ${result.fixed} fixed, ${result.remaining} remaining\n`)
}
