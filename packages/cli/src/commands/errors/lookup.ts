/**
 * Error code lookup functionality
 * @packageDocumentation
 */

import pc from 'picocolors'
import { ERROR_CODES, getErrorMeta, getErrorDocsUrl } from '@/errors/codes'
import type { ErrorCategory } from '@/errors/types'

/**
 * Look up and display information about a specific error code
 */
export function lookupErrorCode(code: string): void {
  const meta = getErrorMeta(code)

  if (!meta) {
    console.error(pc.red(`Error code "${code}" not found.`))
    console.error(`\nUse ${pc.cyan('ix errors --list')} to see all available error codes.`)
    process.exit(1)
  }

  const docsUrl = getErrorDocsUrl(code)

  const lines: string[] = []
  lines.push('')
  lines.push(`${pc.bold(code)}: ${meta.title}`)
  lines.push('')
  lines.push(`${pc.dim('Category:')} ${meta.category}`)

  // Show common causes
  if (meta.causes && meta.causes.length > 0) {
    lines.push('')
    lines.push(pc.dim('Common causes:'))
    meta.causes.forEach((cause, i) => {
      lines.push(`  ${i + 1}. ${cause}`)
    })
  }

  // Show quick fixes
  if (meta.fixes && meta.fixes.length > 0) {
    lines.push('')
    lines.push(pc.dim('Quick fixes:'))
    meta.fixes.forEach((fix) => {
      // Highlight commands in backticks
      const styledFix = fix.replace(/`([^`]+)`/g, (_, cmd) => pc.cyan(cmd))
      lines.push(`  • ${styledFix}`)
    })
  }

  lines.push('')
  lines.push(`${pc.dim('Documentation:')} ${pc.cyan(docsUrl || 'N/A')} ${pc.dim('(coming soon)')}`)
  lines.push('')
  lines.push(`${pc.dim('To see this error in context, trigger it with relevant commands.')}`)
  lines.push(`${pc.dim('For detailed debugging, add')} ${pc.cyan('--verbose')} ${pc.dim('to any command.')}`)
  lines.push('')

  console.log(lines.join('\n'))
}

/**
 * List all error codes, optionally filtered by category
 */
export function listErrorCodes(categoryFilter?: string): void {
  const categories: Record<string, string[]> = {
    config: [],
    build: [],
    deploy: [],
    database: [],
    auth: [],
    internal: [],
  }

  // Group error codes by category
  for (const [code, meta] of Object.entries(ERROR_CODES)) {
    if (!categoryFilter || meta.category === categoryFilter) {
      categories[meta.category]?.push(`${code}: ${meta.title}`)
    }
  }

  console.log(`\n${pc.bold('Ixflare Error Codes')}\n`)

  // Display by category
  for (const [category, codes] of Object.entries(categories)) {
    if (codes.length === 0) continue

    const categoryLabel = getCategoryLabel(category as ErrorCategory)
    console.log(pc.bold(categoryLabel))
    codes.forEach((code) => {
      console.log(`  ${pc.dim('•')} ${code}`)
    })
    console.log('')
  }

  console.log(pc.dim(`Use ${pc.cyan('ix errors <code>')} to see details about a specific error.\n`))
}

/**
 * Get a human-readable label for an error category
 */
function getCategoryLabel(category: ErrorCategory): string {
  switch (category) {
    case 'config':
      return '📝 Configuration Errors (IX_E1XX)'
    case 'build':
      return '🔨 Build Errors (IX_E2XX)'
    case 'deploy':
      return '🚀 Deployment Errors (IX_E3XX)'
    case 'database':
      return '🗄️  Database Errors (IX_E4XX)'
    case 'auth':
      return '🔐 Authentication Errors (IX_E5XX)'
    case 'internal':
      return '⚙️  Internal Errors (IX_E9XX)'
  }
}
