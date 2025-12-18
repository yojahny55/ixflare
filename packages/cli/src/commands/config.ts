/**
 * Config command for managing user preferences
 * Allows setting and getting configuration values
 */

import { UserPreferences } from '@/wizard/preferences'

/**
 * Handle config command
 * Supports: ix config set <key> <value> and ix config get <key>
 */
export async function config(): Promise<void> {
  const args = process.argv.slice(3)
  const subcommand = args[0]
  const key = args[1]
  const value = args[2]

  // Load preferences
  const preferences = await UserPreferences.load()

  // Get subcommand
  if (subcommand === 'get') {
    if (!key) {
      console.error('Error: Missing key argument')
      console.error('Usage: ix config get <key>')
      process.exit(1)
    }

    await handleGet(preferences, key)
    return
  }

  // Set subcommand
  if (subcommand === 'set') {
    if (!key || value === undefined) {
      console.error('Error: Missing key or value argument')
      console.error('Usage: ix config set <key> <value>')
      process.exit(1)
    }

    await handleSet(preferences, key, value)
    return
  }

  // No subcommand or unknown
  console.log(`
Usage: ix config <command> [options]

Commands:
  get <key>         Get configuration value
  set <key> <value> Set configuration value

Available Keys:
  updateCheck       Enable/disable framework update notifications (true/false)
  packageManager    Preferred package manager (npm/pnpm/bun)

Examples:
  ix config get updateCheck
  ix config set updateCheck false
  ix config set packageManager pnpm
`)
}

/**
 * Handle config get command
 */
async function handleGet(preferences: UserPreferences, key: string): Promise<void> {
  switch (key) {
    case 'updateCheck':
      console.log(preferences.updateCheck)
      break
    case 'packageManager':
      console.log(preferences.packageManager ?? 'not set')
      break
    case 'lastTemplate':
      console.log(preferences.lastTemplate ?? 'not set')
      break
    case 'cloudflareAccountId':
      console.log(preferences.cloudflareAccountId ?? 'not set')
      break
    default:
      console.error(`Error: Unknown config key "${key}"`)
      console.error('Available keys: updateCheck, packageManager')
      process.exit(1)
  }
}

/**
 * Handle config set command
 */
async function handleSet(preferences: UserPreferences, key: string, value: string): Promise<void> {
  switch (key) {
    case 'updateCheck':
      if (value !== 'true' && value !== 'false') {
        console.error('Error: updateCheck must be "true" or "false"')
        process.exit(1)
      }
      preferences.setUpdateCheck(value === 'true')
      await preferences.persist()
      console.log(`✓ Update check ${value === 'true' ? 'enabled' : 'disabled'}`)
      break

    case 'packageManager':
      if (value !== 'npm' && value !== 'pnpm' && value !== 'bun') {
        console.error('Error: packageManager must be "npm", "pnpm", or "bun"')
        process.exit(1)
      }
      preferences.setPackageManager(value as 'npm' | 'pnpm' | 'bun')
      await preferences.persist()
      console.log(`✓ Package manager set to ${value}`)
      break

    default:
      console.error(`Error: Unknown config key "${key}"`)
      console.error('Available keys: updateCheck, packageManager')
      process.exit(1)
  }
}
