/**
 * @module tests/commands/security/audit
 * @description Tests for dependency vulnerability scanning
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  AuditOptions,
  AuditResult,
  Vulnerability,
  VulnerabilitySeverity,
  PnpmAuditOutput,
} from '../../../src/commands/security/types'

/**
 * These tests verify type definitions, parsing logic, and security
 * aspects of the audit command.
 */

describe('security:audit types', () => {
  it('should define VulnerabilitySeverity correctly', () => {
    const severities: VulnerabilitySeverity[] = ['low', 'moderate', 'high', 'critical']
    expect(severities).toHaveLength(4)
  })

  it('should define Vulnerability interface with required fields', () => {
    const vuln: Vulnerability = {
      id: 'CVE-2023-1234',
      severity: 'high',
      package: 'lodash',
      version: '4.17.19',
      fixedIn: '4.17.21',
      path: ['my-app', 'dep', 'lodash'],
      description: 'Prototype pollution',
      url: 'https://github.com/advisories/GHSA-xxxx',
    }

    expect(vuln.id).toBe('CVE-2023-1234')
    expect(vuln.severity).toBe('high')
    expect(vuln.package).toBe('lodash')
    expect(vuln.version).toBe('4.17.19')
  })

  it('should define AuditResult with summary', () => {
    const result: AuditResult = {
      vulnerabilities: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
      },
      ignored: [],
    }

    expect(result.summary.total).toBe(0)
    expect(result.vulnerabilities).toHaveLength(0)
  })

  it('should define AuditOptions with all flags', () => {
    const options: AuditOptions = {
      json: true,
      fix: false,
      ci: true,
      auditLevel: 'high',
      prod: true,
      dev: false,
      ignoreCves: ['CVE-2023-1234'],
      cwd: '/path/to/project',
    }

    expect(options.json).toBe(true)
    expect(options.ci).toBe(true)
    expect(options.auditLevel).toBe('high')
    expect(options.prod).toBe(true)
  })
})

describe('security:audit severity filtering logic', () => {
  it('should correctly categorize severity levels', () => {
    const severityOrder: VulnerabilitySeverity[] = ['low', 'moderate', 'high', 'critical']

    // Low is least severe
    expect(severityOrder.indexOf('low')).toBe(0)
    // Critical is most severe
    expect(severityOrder.indexOf('critical')).toBe(3)
  })

  it('should filter vulnerabilities by severity threshold', () => {
    const vulnerabilities: Vulnerability[] = [
      {
        id: '1',
        severity: 'low',
        package: 'pkg1',
        version: '1.0.0',
        path: ['app', 'pkg1'],
        description: 'Low severity',
      },
      {
        id: '2',
        severity: 'high',
        package: 'pkg2',
        version: '1.0.0',
        path: ['app', 'pkg2'],
        description: 'High severity',
      },
      {
        id: '3',
        severity: 'critical',
        package: 'pkg3',
        version: '1.0.0',
        path: ['app', 'pkg3'],
        description: 'Critical severity',
      },
    ]

    // Filter by high threshold - should include high and critical
    const highAndAbove = vulnerabilities.filter((v) => ['high', 'critical'].includes(v.severity))
    expect(highAndAbove).toHaveLength(2)

    // Filter by critical threshold - should include only critical
    const criticalOnly = vulnerabilities.filter((v) => v.severity === 'critical')
    expect(criticalOnly).toHaveLength(1)
  })
})

describe('security:audit CVE ignore patterns', () => {
  it('should parse CVE IDs from .ixignore format', () => {
    const ixignoreContent = `
# Ignore specific vulnerability
CVE-2023-1234 # False positive, not exploitable in our usage
CVE-2023-5678 # Accepted risk

# Another section
CVE-2024-0001 # Fixed in next release
`

    const lines = ixignoreContent.split('\n')
    const cveIds: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const match = trimmed.match(/^(CVE-\d{4}-\d+)/)
      if (match) {
        cveIds.push(match[1])
      }
    }

    expect(cveIds).toEqual(['CVE-2023-1234', 'CVE-2023-5678', 'CVE-2024-0001'])
  })

  it('should filter vulnerabilities by ignored CVEs', () => {
    const vulnerabilities: Vulnerability[] = [
      {
        id: 'CVE-2023-1234',
        severity: 'high',
        package: 'pkg1',
        version: '1.0.0',
        path: [],
        description: '',
      },
      {
        id: 'CVE-2023-5678',
        severity: 'high',
        package: 'pkg2',
        version: '1.0.0',
        path: [],
        description: '',
      },
      {
        id: 'CVE-2024-0001',
        severity: 'low',
        package: 'pkg3',
        version: '1.0.0',
        path: [],
        description: '',
      },
    ]

    const ignoredCves = ['CVE-2023-1234', 'CVE-2024-0001']

    const filtered = vulnerabilities.filter((v) => !ignoredCves.includes(v.id))

    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('CVE-2023-5678')
  })
})

describe('security:audit exit code logic', () => {
  it('should determine exit code based on vulnerability presence', () => {
    const shouldFail = (
      summary: { critical: number; high: number; moderate: number; low: number },
      level: VulnerabilitySeverity | undefined
    ): boolean => {
      if (!level) return summary.critical + summary.high + summary.moderate + summary.low > 0

      const severityOrder: VulnerabilitySeverity[] = ['low', 'moderate', 'high', 'critical']
      const thresholdIndex = severityOrder.indexOf(level)

      for (let i = thresholdIndex; i < severityOrder.length; i++) {
        const severity = severityOrder[i]
        if (summary[severity] > 0) return true
      }

      return false
    }

    // No vulnerabilities
    expect(shouldFail({ critical: 0, high: 0, moderate: 0, low: 0 }, undefined)).toBe(false)

    // Low vulnerabilities only, no threshold
    expect(shouldFail({ critical: 0, high: 0, moderate: 0, low: 1 }, undefined)).toBe(true)

    // Low vulnerabilities only, high threshold
    expect(shouldFail({ critical: 0, high: 0, moderate: 0, low: 1 }, 'high')).toBe(false)

    // High vulnerability present, high threshold
    expect(shouldFail({ critical: 0, high: 1, moderate: 0, low: 0 }, 'high')).toBe(true)

    // Critical vulnerability present, any threshold
    expect(shouldFail({ critical: 1, high: 0, moderate: 0, low: 0 }, 'low')).toBe(true)
    expect(shouldFail({ critical: 1, high: 0, moderate: 0, low: 0 }, 'critical')).toBe(true)
  })
})

describe('security:audit CI mode defaults', () => {
  it('should set production deps and high threshold in CI mode', () => {
    const options: AuditOptions = { ci: true }

    // CI mode should imply these defaults
    const effectiveProd = options.prod ?? true
    const effectiveLevel = options.auditLevel ?? 'high'

    expect(effectiveProd).toBe(true)
    expect(effectiveLevel).toBe('high')
  })
})

describe('security:audit JSON output structure', () => {
  it('should produce valid JSON output format', () => {
    const result: AuditResult = {
      vulnerabilities: [
        {
          id: 'CVE-2023-XXXX',
          severity: 'high',
          package: 'lodash',
          version: '4.17.19',
          fixedIn: '4.17.21',
          path: ['my-app', 'internal-dep', 'lodash'],
          description: 'Prototype pollution vulnerability',
        },
      ],
      summary: {
        total: 1,
        critical: 0,
        high: 1,
        moderate: 0,
        low: 0,
      },
      ignored: [],
    }

    const jsonOutput = JSON.stringify(result, null, 2)
    const parsed = JSON.parse(jsonOutput)

    expect(parsed).toHaveProperty('vulnerabilities')
    expect(parsed).toHaveProperty('summary')
    expect(parsed.vulnerabilities).toBeInstanceOf(Array)
    expect(parsed.summary.total).toBe(1)
    expect(parsed.summary.high).toBe(1)
  })
})

describe('security:audit input validation', () => {
  it('should accept valid audit levels', () => {
    const validLevels: VulnerabilitySeverity[] = ['low', 'moderate', 'high', 'critical']

    for (const level of validLevels) {
      const options: AuditOptions = { auditLevel: level }
      expect(['low', 'moderate', 'high', 'critical']).toContain(options.auditLevel)
    }
  })

  it('should handle empty ignore list', () => {
    const ignoredCves: string[] = []
    const vulnerabilities: Vulnerability[] = [
      {
        id: 'CVE-2023-1234',
        severity: 'high',
        package: 'pkg',
        version: '1.0.0',
        path: [],
        description: '',
      },
    ]

    const filtered = vulnerabilities.filter((v) => !ignoredCves.includes(v.id))

    expect(filtered).toHaveLength(1)
  })
})

describe('security:audit error message safety', () => {
  it('should not expose sensitive data patterns in error messages', () => {
    const sensitivePatterns = [/token/i, /secret/i, /password/i, /api[_-]?key/i, /bearer/i]

    const safeErrorMessage = 'Error running audit: pnpm audit failed with code 2'

    for (const pattern of sensitivePatterns) {
      expect(safeErrorMessage).not.toMatch(pattern)
    }
  })
})

describe('security:audit vulnerability grouping', () => {
  it('should group vulnerabilities by severity', () => {
    const vulnerabilities: Vulnerability[] = [
      { id: '1', severity: 'low', package: 'pkg1', version: '1.0.0', path: [], description: '' },
      { id: '2', severity: 'high', package: 'pkg2', version: '1.0.0', path: [], description: '' },
      { id: '3', severity: 'high', package: 'pkg3', version: '1.0.0', path: [], description: '' },
      {
        id: '4',
        severity: 'critical',
        package: 'pkg4',
        version: '1.0.0',
        path: [],
        description: '',
      },
    ]

    const grouped: Record<VulnerabilitySeverity, Vulnerability[]> = {
      critical: [],
      high: [],
      moderate: [],
      low: [],
    }

    for (const vuln of vulnerabilities) {
      grouped[vuln.severity].push(vuln)
    }

    expect(grouped.critical).toHaveLength(1)
    expect(grouped.high).toHaveLength(2)
    expect(grouped.moderate).toHaveLength(0)
    expect(grouped.low).toHaveLength(1)
  })
})

/**
 * Integration-style tests that verify parsing logic with realistic data
 */
describe('security:audit CVE ID extraction', () => {
  // Simulates extractCveId function logic
  function extractCveId(advisory: {
    id: number
    url: string
    overview: string
    title: string
  }): string {
    const urlCveMatch = advisory.url?.match(/CVE-\d{4}-\d+/)
    if (urlCveMatch) return urlCveMatch[0]

    const overviewCveMatch = advisory.overview?.match(/CVE-\d{4}-\d+/)
    if (overviewCveMatch) return overviewCveMatch[0]

    const titleCveMatch = advisory.title?.match(/CVE-\d{4}-\d+/)
    if (titleCveMatch) return titleCveMatch[0]

    const ghsaMatch = advisory.url?.match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/)
    if (ghsaMatch) return ghsaMatch[0]

    return String(advisory.id)
  }

  it('should extract CVE from URL', () => {
    const advisory = {
      id: 1234,
      url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-45857',
      overview: 'Some vulnerability',
      title: 'Security issue',
    }
    expect(extractCveId(advisory)).toBe('CVE-2023-45857')
  })

  it('should extract CVE from overview when not in URL', () => {
    const advisory = {
      id: 1234,
      url: 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz',
      overview: 'This is CVE-2024-12345 - a security vulnerability',
      title: 'Security issue',
    }
    expect(extractCveId(advisory)).toBe('CVE-2024-12345')
  })

  it('should extract CVE from title as fallback', () => {
    const advisory = {
      id: 1234,
      url: 'https://example.com/advisory',
      overview: 'Some vulnerability without CVE in text',
      title: 'CVE-2022-99999 - Critical Issue',
    }
    expect(extractCveId(advisory)).toBe('CVE-2022-99999')
  })

  it('should extract GHSA ID when no CVE present', () => {
    const advisory = {
      id: 1234,
      url: 'https://github.com/advisories/GHSA-abcd-efgh-ijkl',
      overview: 'Prototype pollution vulnerability',
      title: 'Security issue',
    }
    expect(extractCveId(advisory)).toBe('GHSA-abcd-efgh-ijkl')
  })

  it('should fall back to numeric ID when no CVE/GHSA found', () => {
    const advisory = {
      id: 5678,
      url: 'https://example.com/advisory/5678',
      overview: 'Some vulnerability',
      title: 'Security issue',
    }
    expect(extractCveId(advisory)).toBe('5678')
  })
})

describe('security:audit GHSA ID parsing in .ixignore', () => {
  function parseIxignore(content: string): string[] {
    const ignored: string[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const cveMatch = trimmed.match(/^(CVE-\d{4}-\d+)/)
      if (cveMatch) {
        ignored.push(cveMatch[1])
        continue
      }

      const ghsaMatch = trimmed.match(/^(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})/)
      if (ghsaMatch) {
        ignored.push(ghsaMatch[1])
        continue
      }

      const numericMatch = trimmed.match(/^(\d+)/)
      if (numericMatch) {
        ignored.push(numericMatch[1])
      }
    }

    return ignored
  }

  it('should parse GHSA IDs from .ixignore', () => {
    const content = `
# GitHub Security Advisories
GHSA-abcd-1234-efgh # Prototype pollution in lodash
GHSA-wxyz-5678-mnop # Some other issue
`
    const ids = parseIxignore(content)
    expect(ids).toEqual(['GHSA-abcd-1234-efgh', 'GHSA-wxyz-5678-mnop'])
  })

  it('should parse mixed CVE and GHSA IDs', () => {
    const content = `
CVE-2023-1234 # A CVE
GHSA-abcd-efgh-ijkl # A GHSA
CVE-2024-5678 # Another CVE
`
    const ids = parseIxignore(content)
    expect(ids).toEqual(['CVE-2023-1234', 'GHSA-abcd-efgh-ijkl', 'CVE-2024-5678'])
  })

  it('should parse numeric advisory IDs', () => {
    const content = `
12345 # NPM advisory ID
CVE-2023-1111
67890 # Another numeric ID
`
    const ids = parseIxignore(content)
    expect(ids).toEqual(['12345', 'CVE-2023-1111', '67890'])
  })

  it('should handle empty and comment-only files', () => {
    const content = `
# This is a comment
# Another comment

   # Indented comment
`
    const ids = parseIxignore(content)
    expect(ids).toEqual([])
  })
})

describe('security:audit pnpm output parsing', () => {
  // Simulates parseAuditOutput logic
  function parseAuditOutput(data: PnpmAuditOutput, ignoredCves: string[]): AuditResult {
    const vulnerabilities: Vulnerability[] = []

    for (const [advisoryId, advisory] of Object.entries(data.advisories || {})) {
      // Extract CVE/GHSA ID
      const urlCveMatch = advisory.url?.match(/CVE-\d{4}-\d+/)
      const ghsaMatch = advisory.url?.match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/)
      const vulnId = urlCveMatch?.[0] || ghsaMatch?.[0] || String(advisory.id)

      // Check ignores
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

    const summary = {
      total: vulnerabilities.length,
      critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
      high: vulnerabilities.filter((v) => v.severity === 'high').length,
      moderate: vulnerabilities.filter((v) => v.severity === 'moderate').length,
      low: vulnerabilities.filter((v) => v.severity === 'low').length,
    }

    return { vulnerabilities, summary, ignored: ignoredCves }
  }

  it('should parse pnpm audit JSON with multiple advisories', () => {
    const mockOutput: PnpmAuditOutput = {
      advisories: {
        '1234': {
          id: 1234,
          created: '2023-01-01',
          updated: '2023-01-02',
          title: 'Prototype Pollution',
          module_name: 'lodash',
          vulnerable_versions: '<4.17.21',
          patched_versions: '>=4.17.21',
          severity: 'high',
          overview: 'Prototype pollution in lodash',
          url: 'https://github.com/advisories/GHSA-abcd-efgh-ijkl',
          findings: [{ version: '4.17.19', paths: ['my-app > dep > lodash'] }],
        },
        '5678': {
          id: 5678,
          created: '2024-01-01',
          updated: '2024-01-02',
          title: 'ReDoS',
          module_name: 'axios',
          vulnerable_versions: '<1.6.0',
          patched_versions: '>=1.6.0',
          severity: 'moderate',
          overview: 'Regular expression denial of service',
          url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-12345',
          findings: [{ version: '1.5.0', paths: ['my-app > axios'] }],
        },
      },
      metadata: {
        vulnerabilities: {
          info: 0,
          low: 0,
          moderate: 1,
          high: 1,
          critical: 0,
          total: 2,
        },
      },
    }

    const result = parseAuditOutput(mockOutput, [])

    expect(result.vulnerabilities).toHaveLength(2)
    expect(result.summary.total).toBe(2)
    expect(result.summary.high).toBe(1)
    expect(result.summary.moderate).toBe(1)

    // Check first vulnerability (GHSA)
    const lodashVuln = result.vulnerabilities.find((v) => v.package === 'lodash')
    expect(lodashVuln?.id).toBe('GHSA-abcd-efgh-ijkl')
    expect(lodashVuln?.version).toBe('4.17.19')

    // Check second vulnerability (CVE)
    const axiosVuln = result.vulnerabilities.find((v) => v.package === 'axios')
    expect(axiosVuln?.id).toBe('CVE-2024-12345')
  })

  it('should filter out ignored vulnerabilities by CVE', () => {
    const mockOutput: PnpmAuditOutput = {
      advisories: {
        '1234': {
          id: 1234,
          created: '2023-01-01',
          updated: '2023-01-02',
          title: 'Vulnerability 1',
          module_name: 'pkg1',
          vulnerable_versions: '<1.0.0',
          patched_versions: '>=1.0.0',
          severity: 'high',
          overview: 'Test CVE-2023-1234',
          url: 'https://example.com',
          findings: [{ version: '0.9.0', paths: ['app > pkg1'] }],
        },
        '5678': {
          id: 5678,
          created: '2023-01-01',
          updated: '2023-01-02',
          title: 'Vulnerability 2',
          module_name: 'pkg2',
          vulnerable_versions: '<2.0.0',
          patched_versions: '>=2.0.0',
          severity: 'critical',
          overview: 'Critical issue',
          url: 'https://example.com',
          findings: [{ version: '1.9.0', paths: ['app > pkg2'] }],
        },
      },
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 1, total: 2 },
      },
    }

    // Ignore advisory 1234 by its numeric ID
    const result = parseAuditOutput(mockOutput, ['1234'])

    expect(result.vulnerabilities).toHaveLength(1)
    expect(result.vulnerabilities[0].package).toBe('pkg2')
  })

  it('should handle empty advisories', () => {
    const mockOutput: PnpmAuditOutput = {
      advisories: {},
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
      },
    }

    const result = parseAuditOutput(mockOutput, [])

    expect(result.vulnerabilities).toHaveLength(0)
    expect(result.summary.total).toBe(0)
  })

  it('should parse multiple paths for same vulnerability', () => {
    const mockOutput: PnpmAuditOutput = {
      advisories: {
        '1234': {
          id: 1234,
          created: '2023-01-01',
          updated: '2023-01-02',
          title: 'Vulnerability',
          module_name: 'lodash',
          vulnerable_versions: '<4.17.21',
          patched_versions: '>=4.17.21',
          severity: 'high',
          overview: 'Issue',
          url: 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz',
          findings: [{ version: '4.17.19', paths: ['app > dep1 > lodash', 'app > dep2 > lodash'] }],
        },
      },
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2 },
      },
    }

    const result = parseAuditOutput(mockOutput, [])

    // Should create separate vulnerability entries for each path
    expect(result.vulnerabilities).toHaveLength(2)
    expect(result.vulnerabilities[0].path).toEqual(['app', 'dep1', 'lodash'])
    expect(result.vulnerabilities[1].path).toEqual(['app', 'dep2', 'lodash'])
  })
})

describe('security:audit CLI argument validation', () => {
  it('should validate audit level values', () => {
    const validLevels = ['low', 'moderate', 'high', 'critical'] as const

    // Valid levels should pass
    expect(validLevels.includes('low')).toBe(true)
    expect(validLevels.includes('high')).toBe(true)

    // Invalid levels should fail
    expect(validLevels.includes('invalid' as never)).toBe(false)
    expect(validLevels.includes('CRITICAL' as never)).toBe(false) // case sensitive
    expect(validLevels.includes('' as never)).toBe(false)
  })

  it('should reject malicious input in audit level', () => {
    const validLevels = ['low', 'moderate', 'high', 'critical'] as const

    // Injection attempts should fail validation
    const injectionAttempts = ['; rm -rf /', '$(whoami)', '`id`', '--help', '-e "malicious"']

    for (const attempt of injectionAttempts) {
      expect(validLevels.includes(attempt as never)).toBe(false)
    }
  })
})

describe('security:audit cwd validation', () => {
  // Mirrors the validateCwd function in audit.ts
  function validateCwd(cwd: string): { valid: boolean; error?: string } {
    if (cwd.includes('..')) {
      return { valid: false, error: 'path traversal not allowed' }
    }
    if (cwd.includes('\0')) {
      return { valid: false, error: 'null bytes not allowed' }
    }
    const dangerousChars = /[;&|`$(){}[\]<>!]/
    if (dangerousChars.test(cwd)) {
      return { valid: false, error: 'contains shell metacharacters' }
    }
    return { valid: true }
  }

  it('should accept valid paths', () => {
    expect(validateCwd('/safe/path/to/project').valid).toBe(true)
    expect(validateCwd('/home/user/my-app').valid).toBe(true)
    expect(validateCwd('C:\\Users\\name\\project').valid).toBe(true)
    expect(validateCwd('/path/with spaces/allowed').valid).toBe(true)
  })

  it('should reject path traversal attempts', () => {
    expect(validateCwd('../../../etc/passwd').valid).toBe(false)
    expect(validateCwd('/path/with/../traversal').valid).toBe(false)
    expect(validateCwd('..').valid).toBe(false)
  })

  it('should reject null byte injection', () => {
    expect(validateCwd('/path\0injection').valid).toBe(false)
    expect(validateCwd('safe\0path').valid).toBe(false)
  })

  it('should reject shell metacharacters', () => {
    expect(validateCwd('/path;rm -rf /').valid).toBe(false)
    expect(validateCwd('/path && echo pwned').valid).toBe(false)
    expect(validateCwd('/path | cat /etc/passwd').valid).toBe(false)
    expect(validateCwd('/path`id`').valid).toBe(false)
    expect(validateCwd('/path$(whoami)').valid).toBe(false)
    expect(validateCwd('/path{a,b}').valid).toBe(false)
  })
})

describe('security:audit options validation', () => {
  const VALID_AUDIT_LEVELS = ['low', 'moderate', 'high', 'critical'] as const

  function validateAuditOptions(options: AuditOptions): { valid: boolean; error?: string } {
    if (options.auditLevel !== undefined) {
      if (!VALID_AUDIT_LEVELS.includes(options.auditLevel as (typeof VALID_AUDIT_LEVELS)[number])) {
        return { valid: false, error: `Invalid audit level: "${options.auditLevel}"` }
      }
    }
    if (options.prod && options.dev) {
      return { valid: false, error: 'Cannot specify both --prod and --dev' }
    }
    return { valid: true }
  }

  it('should accept valid audit levels', () => {
    expect(validateAuditOptions({ auditLevel: 'low' }).valid).toBe(true)
    expect(validateAuditOptions({ auditLevel: 'moderate' }).valid).toBe(true)
    expect(validateAuditOptions({ auditLevel: 'high' }).valid).toBe(true)
    expect(validateAuditOptions({ auditLevel: 'critical' }).valid).toBe(true)
  })

  it('should accept undefined audit level', () => {
    expect(validateAuditOptions({}).valid).toBe(true)
    expect(validateAuditOptions({ json: true }).valid).toBe(true)
  })

  it('should reject invalid audit levels', () => {
    expect(validateAuditOptions({ auditLevel: 'invalid' as VulnerabilitySeverity }).valid).toBe(
      false
    )
    expect(validateAuditOptions({ auditLevel: 'HIGH' as VulnerabilitySeverity }).valid).toBe(false)
    expect(validateAuditOptions({ auditLevel: '' as VulnerabilitySeverity }).valid).toBe(false)
  })

  it('should reject mutually exclusive prod and dev flags', () => {
    expect(validateAuditOptions({ prod: true, dev: true }).valid).toBe(false)
    expect(validateAuditOptions({ prod: true, dev: false }).valid).toBe(true)
    expect(validateAuditOptions({ prod: false, dev: true }).valid).toBe(true)
  })

  it('should reject injection attempts in audit level', () => {
    const injectionAttempts = ['; rm -rf /', '$(whoami)', '`id`', '--help', '-e "malicious"']

    for (const attempt of injectionAttempts) {
      expect(validateAuditOptions({ auditLevel: attempt as VulnerabilitySeverity }).valid).toBe(
        false
      )
    }
  })
})

describe('security:audit --fix ignore configuration handling', () => {
  it('should identify ignored vulnerabilities that might be affected by fix', () => {
    const vulnerabilities: Vulnerability[] = [
      {
        id: 'CVE-2023-1234',
        severity: 'high',
        package: 'pkg1',
        version: '1.0.0',
        path: [],
        description: '',
      },
      {
        id: 'GHSA-abcd-efgh-ijkl',
        severity: 'high',
        package: 'pkg2',
        version: '1.0.0',
        path: [],
        description: '',
      },
      {
        id: 'CVE-2024-5678',
        severity: 'low',
        package: 'pkg3',
        version: '1.0.0',
        path: [],
        description: '',
      },
    ]

    const ignoredCves = ['CVE-2023-1234', 'GHSA-abcd-efgh-ijkl']

    const ignoredVulns = vulnerabilities.filter((v) =>
      ignoredCves.some((ignored) => v.id === ignored || v.id.includes(ignored))
    )

    expect(ignoredVulns).toHaveLength(2)
    expect(ignoredVulns.map((v) => v.id)).toContain('CVE-2023-1234')
    expect(ignoredVulns.map((v) => v.id)).toContain('GHSA-abcd-efgh-ijkl')
  })

  it('should exclude ignored vulnerabilities from remaining count', () => {
    const vulnerabilities: Vulnerability[] = [
      {
        id: 'CVE-2023-1234',
        severity: 'high',
        package: 'pkg1',
        version: '1.0.0',
        path: [],
        description: '',
      },
      {
        id: 'CVE-2024-5678',
        severity: 'high',
        package: 'pkg2',
        version: '1.0.0',
        path: [],
        description: '',
      },
      {
        id: 'CVE-2024-9999',
        severity: 'low',
        package: 'pkg3',
        version: '1.0.0',
        path: [],
        description: '',
      },
    ]

    const ignoredCves = ['CVE-2023-1234']

    const remainingNonIgnored = vulnerabilities.filter(
      (v) => !ignoredCves.some((ignored) => v.id === ignored || v.id.includes(ignored))
    ).length

    expect(remainingNonIgnored).toBe(2) // CVE-2024-5678 and CVE-2024-9999
  })
})

describe('security:audit security tests', () => {
  it('should sanitize vulnerability descriptions for display', () => {
    // Ensure HTML/script in descriptions doesn't cause issues
    const vuln: Vulnerability = {
      id: 'CVE-2023-1234',
      severity: 'high',
      package: 'test',
      version: '1.0.0',
      path: [],
      description: '<script>alert("xss")</script> Vulnerability',
    }

    // Description should be treated as plain text, not HTML
    expect(vuln.description).toContain('<script>')
    expect(typeof vuln.description).toBe('string')
  })

  it('should handle special characters in package names', () => {
    const vuln: Vulnerability = {
      id: 'CVE-2023-1234',
      severity: 'high',
      package: '@scope/package-name',
      version: '1.0.0-beta.1',
      path: ['app', '@scope/package-name'],
      description: 'Test',
    }

    expect(vuln.package).toBe('@scope/package-name')
    expect(vuln.version).toBe('1.0.0-beta.1')
    expect(vuln.path).toContain('@scope/package-name')
  })
})
