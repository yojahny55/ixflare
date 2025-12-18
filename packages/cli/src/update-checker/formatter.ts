/**
 * Update notification formatter
 * Formats update notifications with styled boxes
 */

import { cyan, yellow, green, dim, bold } from 'picocolors'
import { major } from 'semver'
import type { UpdateCheckResult } from './types'

// Unicode box drawing characters
const BOX = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
}

/**
 * Pad a line to fit within the box width
 * Accounts for ANSI color codes by measuring visible characters
 *
 * @param text - Text to pad (may include ANSI codes)
 * @param width - Target width
 * @returns Padded text
 */
function padLine(text: string, width: number): string {
  // Remove ANSI codes to measure visible length
  // Matches all ANSI escape sequences including:
  // - Basic colors: \x1B[31m
  // - Multiple params: \x1B[38;5;196m (256-color)
  // - RGB colors: \x1B[38;2;255;128;0m (true color)
  // eslint-disable-next-line no-control-regex
  const visible = text.replace(/\u001B\[[0-9;]*m/g, '')
  const padding = width - visible.length
  return text + ' '.repeat(Math.max(0, padding))
}

/**
 * Format update notification for display
 * Creates styled box with update information
 *
 * @param result - Update check result
 * @param packageManager - Package manager command (npm/pnpm/bun)
 * @returns Formatted notification string
 */
export function formatUpdateNotification(
  result: UpdateCheckResult,
  packageManager: string
): string {
  const lines: string[] = ['']
  const width = 55

  // Top border
  lines.push(BOX.topLeft + BOX.horizontal.repeat(width) + BOX.topRight)

  if (result.updateType === 'major' || result.updateType === 'premajor') {
    // Major version warning
    const versionLine = `${yellow('⚠️  Major update available:')} ${dim(result.currentVersion)} → ${bold(result.latestVersion)}`
    lines.push(`${BOX.vertical} ${padLine(versionLine, width - 2)} ${BOX.vertical}`)
    lines.push(`${BOX.vertical} ${padLine('', width - 2)} ${BOX.vertical}`)
    lines.push(
      `${BOX.vertical} ${padLine('This update includes breaking changes.', width - 2)} ${BOX.vertical}`
    )

    if (result.migrationUrl) {
      lines.push(
        `${BOX.vertical} ${padLine(`Migration guide: ${cyan(result.migrationUrl)}`, width - 2)} ${BOX.vertical}`
      )
    }

    lines.push(`${BOX.vertical} ${padLine('', width - 2)} ${BOX.vertical}`)

    const cmd = `${packageManager} update ixflare@${major(result.latestVersion)}`
    lines.push(
      `${BOX.vertical} ${padLine(`Run ${green(cmd)} when ready.`, width - 2)} ${BOX.vertical}`
    )
  } else {
    // Minor/patch update
    const versionLine = `${cyan('Update available:')} ${dim(result.currentVersion)} → ${bold(result.latestVersion)}`
    lines.push(`${BOX.vertical} ${padLine(versionLine, width - 2)} ${BOX.vertical}`)

    const cmd = `${packageManager} update ixflare`
    lines.push(
      `${BOX.vertical} ${padLine(`Run ${green(cmd)} to update`, width - 2)} ${BOX.vertical}`
    )

    lines.push(`${BOX.vertical} ${padLine('', width - 2)} ${BOX.vertical}`)
    lines.push(
      `${BOX.vertical} ${padLine(`Changelog: ${cyan(result.changelogUrl)}`, width - 2)} ${BOX.vertical}`
    )
  }

  // Bottom border
  lines.push(BOX.bottomLeft + BOX.horizontal.repeat(width) + BOX.bottomRight)
  lines.push('')

  return lines.join('\n')
}

/**
 * Display update notification to console
 * Prints formatted notification to stdout
 *
 * @param result - Update check result
 * @param packageManager - Package manager (default: pnpm)
 */
export function displayUpdateNotification(
  result: UpdateCheckResult,
  packageManager: 'npm' | 'pnpm' | 'bun' = 'pnpm'
): void {
  const notification = formatUpdateNotification(result, packageManager)
  console.log(notification)
}
