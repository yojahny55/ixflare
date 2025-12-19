/**
 * Eject command - Convert from managed Ixflare config to raw Wrangler/Vite config
 */

import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import pc from 'picocolors'
import prompts from 'prompts'
import {
  backupExistingFiles,
  detectProjectState,
  generateViteConfig,
  generateWranglerToml,
  readEdgeConfig,
  restoreFromBackups,
  updatePackageJson,
  type EjectOptions,
} from './eject/index.js'

/**
 * Execute the eject command
 */
export async function eject(): Promise<void> {
  const args = process.argv.slice(3)

  const options: EjectOptions = {
    configOnly: args.includes('--config-only'),
    yes: args.includes('--yes') || args.includes('-y'),
    help: args.includes('--help') || args.includes('-h'),
  }

  if (options.help) {
    showHelp()
    return
  }

  const projectRoot = process.cwd()

  // Detect project state
  const state = await detectProjectState(projectRoot)

  // Check if already ejected
  if (state.isEjected) {
    console.log(pc.yellow('\nThis project appears to already be ejected:'))
    if (state.hasWranglerToml) {
      console.log('  Found: wrangler.toml')
    }
    if (!state.hasEdgeConfig) {
      console.log('  Missing: edge.config.ts')
    }
    console.log("\nNo action needed. You're using raw configuration.")
    console.log(pc.dim('\nDocs: https://ixflare.dev/docs/advanced/ejected-projects'))
    return
  }

  // Check for edge.config.ts
  if (!state.hasEdgeConfig) {
    console.log(pc.red('\nError: edge.config.ts not found'))
    console.log('\nThe eject command requires an Ixflare project with edge.config.ts.')
    console.log("If you're already using raw configuration, there's nothing to eject.")
    process.exit(1)
  }

  // Show files that will be backed up if they exist
  const filesToBackupExist = state.hasWranglerToml || state.hasViteConfig
  if (filesToBackupExist && !options.yes) {
    console.log(pc.yellow('\nExisting files detected:'))
    if (state.hasWranglerToml) {
      console.log('  wrangler.toml (will be backed up)')
    }
    if (state.hasViteConfig && !options.configOnly) {
      console.log('  vite.config.ts (will be backed up)')
    }
    console.log('\nBackups will be created as *.backup-{timestamp}')
    console.log()
  }

  // Show warning and get confirmation
  if (!options.yes) {
    console.log()
    if (options.configOnly) {
      console.log(pc.yellow('Partial eject - wrangler.toml only'))
      console.log()
      console.log('This will:')
      console.log('  Generate raw wrangler.toml from edge.config.ts')
      console.log('  Keep Vite managed by the framework')
    } else {
      console.log('This will:')
      console.log('  Generate raw wrangler.toml from edge.config.ts')
      console.log('  Generate vite.config.ts with all plugins configured')
      console.log('  Update package.json scripts')
    }
    console.log()
    console.log(pc.dim("After ejecting, you'll manage configuration directly."))
    console.log(pc.dim('Some `ix` commands may not work as expected.'))
    console.log()

    const response = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: options.configOnly ? 'Proceed?' : 'Are you sure you want to eject?',
      initial: false,
    })

    if (!response.confirm) {
      console.log('Ejection cancelled.')
      return
    }
  }

  console.log()
  if (options.yes) {
    console.log('Ejecting (non-interactive mode)...')
  } else {
    console.log(options.configOnly ? 'Partial ejecting...' : 'Ejecting...')
  }
  console.log()

  let backups: Array<{ original: string; backup: string }> = []
  const generatedFiles: string[] = [] // Track files we generate for rollback cleanup

  try {
    // Read edge.config.ts
    const config = await readEdgeConfig(projectRoot)

    // Backup existing files
    backups = await backupExistingFiles(projectRoot, options)
    if (backups.length > 0) {
      for (const backup of backups) {
        console.log(pc.dim(`Backed up: ${backup.original} -> ${backup.backup}`))
      }
      console.log()
    }

    // Generate wrangler.toml
    const wranglerContent = generateWranglerToml(config)
    writeFileSync(join(projectRoot, 'wrangler.toml'), wranglerContent, 'utf-8')
    generatedFiles.push('wrangler.toml')
    console.log(pc.green('Generated: wrangler.toml'))

    // Generate vite.config.ts (unless --config-only)
    if (!options.configOnly) {
      const viteContent = generateViteConfig(config)
      writeFileSync(join(projectRoot, 'vite.config.ts'), viteContent, 'utf-8')
      generatedFiles.push('vite.config.ts')
      console.log(pc.green('Generated: vite.config.ts'))

      // Update package.json
      updatePackageJson(projectRoot)
      console.log(pc.green('Updated: package.json'))
    }

    console.log()
    console.log(pc.green(options.configOnly ? 'Partial ejection complete!' : 'Ejection complete!'))
    console.log()

    if (options.configOnly) {
      console.log('Note: Vite remains managed by Ixflare.')
    } else {
      console.log('Your project now uses raw Wrangler configuration.')
    }

    console.log(pc.dim('Docs: https://ixflare.dev/docs/advanced/ejected-projects'))
  } catch (error) {
    console.error(pc.red('\nEjection failed:'))
    console.error(error instanceof Error ? error.message : String(error))

    // Attempt rollback: first restore backups, then clean up generated files
    if (backups.length > 0) {
      console.log(pc.yellow('\nAttempting to restore backups...'))
      try {
        await restoreFromBackups(projectRoot, backups)
        console.log(pc.green('Backups restored successfully'))
      } catch (rollbackError) {
        console.error(
          pc.red(
            `Failed to restore backups: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
          )
        )
      }
    }

    // Clean up any generated files that weren't backed up (new files)
    for (const file of generatedFiles) {
      const filePath = join(projectRoot, file)
      // Only delete if this file wasn't restored from backup
      const wasBackedUp = backups.some((b) => b.original === file)
      if (!wasBackedUp && existsSync(filePath)) {
        try {
          unlinkSync(filePath)
          console.log(pc.dim(`Cleaned up: ${file}`))
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    process.exit(1)
  }
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
${pc.bold('Usage:')} ix eject [options]

Eject from Ixflare managed configuration to raw Wrangler/Vite config.

${pc.bold('Options:')}
  --config-only    Only generate wrangler.toml (keep Vite managed)
  --yes, -y        Skip confirmation prompt
  --help, -h       Show this help message

${pc.bold('What gets generated:')}
  wrangler.toml    Cloudflare Workers configuration
  vite.config.ts   Vite build configuration
  package.json     Updated scripts (dev, build, deploy, etc.)

${pc.bold('After ejecting:')}
  - You have full control over configuration
  - Some \`ix\` commands may not work as expected
  - Use \`wrangler\` and \`vite\` directly

${pc.bold('Examples:')}
  ix eject              Full ejection with confirmation
  ix eject --yes        Skip confirmation (for CI/scripting)
  ix eject --config-only   Only eject wrangler.toml

${pc.bold('Docs:')} https://ixflare.dev/docs/advanced/ejected-projects
`)
}
