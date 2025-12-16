/**
 * @module commands/security/audit
 * @description Dependency vulnerability scanning command
 * @node-only
 */

import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
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

/**
 * Main audit command entry point
 */
export async function audit(options: AuditOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd()

  // CI mode sets defaults
  if (options.ci) {
    options.prod = options.prod ?? true
    options.auditLevel = options.auditLevel ?? 'high'
  }

  // Load ignore configuration
  const ignoredCves = await loadIgnoredCves(cwd, options.ignoreCves)

  try {
    if (options.fix) {
      const fixResult = await runAuditFix(cwd, options)
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
    console.error(pc.red('Error running audit:'), error)
    process.exit(1)
  }
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
 */
function executePnpmAudit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('pnpm', args, { cwd, shell: true })
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
 * Parse pnpm audit JSON output
 */
function parseAuditOutput(output: string, ignoredCves: string[]): AuditResult {
  try {
    const data: PnpmAuditOutput = JSON.parse(output)
    const vulnerabilities: Vulnerability[] = []

    // Parse advisories
    for (const [advisoryId, advisory] of Object.entries(data.advisories || {})) {
      const cveId = `CVE-${advisoryId}` // Normalize ID format

      // Skip ignored CVEs
      if (ignoredCves.includes(cveId) || ignoredCves.includes(advisoryId)) {
        continue
      }

      for (const finding of advisory.findings || []) {
        for (const path of finding.paths || []) {
          vulnerabilities.push({
            id: advisoryId,
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
  } catch (error) {
    throw new Error(`Failed to parse audit output: ${error}`)
  }
}

/**
 * Load ignored CVEs from configuration
 */
async function loadIgnoredCves(cwd: string, cliIgnores?: string[]): Promise<string[]> {
  const ignored = new Set<string>(cliIgnores || [])

  // Try loading from .ixignore
  try {
    const ixignorePath = join(cwd, '.ixignore')
    const content = await readFile(ixignorePath, 'utf-8')
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue

      // Extract CVE ID (before any comment)
      const match = trimmed.match(/^(CVE-\d{4}-\d+)/)
      if (match) {
        ignored.add(match[1])
      }
    }
  } catch {
    // .ixignore doesn't exist or can't be read, that's fine
  }

  // TODO: Load from edge.config.ts security.audit.ignoreCves
  // This would require loading and parsing the config file
  // Deferred to avoid complexity for now

  return Array.from(ignored)
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
    pc.yellow(`Found ${result.summary.total} ${result.summary.total === 1 ? 'vulnerability' : 'vulnerabilities'}:\n`)
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
 */
async function runAuditFix(cwd: string, options: AuditOptions): Promise<FixResult> {
  const args = ['audit', '--fix']

  if (options.prod) {
    args.push('--prod')
  }
  if (options.dev) {
    args.push('--dev')
  }

  try {
    await executePnpmAudit(cwd, args)

    // Run audit again to see what's remaining
    const postFixResult = await runAudit(cwd, options, [])

    // Simple fix result (actual tracking would require more complex logic)
    const fixResult: FixResult = {
      fixed: 0, // Would need pre-fix audit to calculate
      remaining: postFixResult.summary.total,
      fixes: [],
    }

    return fixResult
  } catch (error) {
    throw new Error(`Auto-fix failed: ${error}`)
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
      console.log(
        pc.green(`✓ Updated ${fix.package}: ${fix.fromVersion} → ${fix.toVersion}`)
      )
    }
  }

  if (result.remaining > 0) {
    console.log(
      pc.yellow(`\n✗ ${result.remaining} vulnerabilities require manual action\n`)
    )
  } else {
    console.log(pc.green('\n✓ All vulnerabilities fixed\n'))
  }

  console.log(`Summary: ${result.fixed} fixed, ${result.remaining} remaining\n`)
}
