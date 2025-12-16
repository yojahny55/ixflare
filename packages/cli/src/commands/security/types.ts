/**
 * @module commands/security/types
 * @description Type definitions for security audit command
 * @node-only
 */

/**
 * Severity levels for vulnerabilities (aligned with pnpm audit)
 */
export type VulnerabilitySeverity = 'critical' | 'high' | 'moderate' | 'low'

/**
 * Single vulnerability entry
 */
export interface Vulnerability {
  /** CVE or advisory identifier */
  id: string
  /** Severity level */
  severity: VulnerabilitySeverity
  /** Affected package name */
  package: string
  /** Current installed version */
  version: string
  /** Version that fixes the vulnerability */
  fixedIn?: string
  /** Dependency path from root to vulnerable package */
  path: string[]
  /** Vulnerability description */
  description: string
  /** URL to advisory details */
  url?: string
}

/**
 * Summary of vulnerability counts by severity
 */
export interface AuditSummary {
  total: number
  critical: number
  high: number
  moderate: number
  low: number
}

/**
 * Result of audit scan
 */
export interface AuditResult {
  vulnerabilities: Vulnerability[]
  summary: AuditSummary
  /** Vulnerabilities that were ignored via configuration */
  ignored: string[]
}

/**
 * Options for running audit command
 */
export interface AuditOptions {
  /** Output JSON instead of human-readable format */
  json?: boolean
  /** Attempt to auto-fix vulnerabilities */
  fix?: boolean
  /** CI mode (production deps only, fail on high/critical) */
  ci?: boolean
  /** Minimum severity level to report */
  auditLevel?: VulnerabilitySeverity
  /** Scan production dependencies only */
  prod?: boolean
  /** Scan development dependencies only */
  dev?: boolean
  /** CVE IDs to ignore */
  ignoreCves?: string[]
  /** Working directory (defaults to process.cwd()) */
  cwd?: string
}

/**
 * Result of auto-fix operation
 */
export interface FixResult {
  /** Number of vulnerabilities fixed */
  fixed: number
  /** Number of vulnerabilities remaining */
  remaining: number
  /** Details of fixes applied */
  fixes: Array<{
    package: string
    fromVersion: string
    toVersion: string
    method: 'direct-update' | 'override'
  }>
}

/**
 * Raw pnpm audit JSON output structure
 * Based on pnpm audit --json output format
 */
export interface PnpmAuditOutput {
  advisories: Record<
    string,
    {
      id: number
      created: string
      updated: string
      title: string
      module_name: string
      vulnerable_versions: string
      patched_versions: string
      severity: VulnerabilitySeverity
      overview: string
      url: string
      findings: Array<{
        version: string
        paths: string[]
      }>
    }
  >
  metadata: {
    vulnerabilities: {
      info: number
      low: number
      moderate: number
      high: number
      critical: number
      total: number
    }
  }
}
