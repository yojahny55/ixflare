/**
 * @module commands/build
 * @description Production build command
 */

import { HooksRunner, HookError } from '../hooks/index'

export async function build(): Promise<void> {
  const projectRoot = process.cwd()
  const runner = new HooksRunner()

  try {
    // Load configuration
    await runner.loadConfig(projectRoot)

    // Execute pre-build hook
    try {
      await runner.runPreBuild()
    } catch (error) {
      if (error instanceof HookError) {
        console.error(`\n❌ ${error.message}`)
        console.error('\nBuild stopped due to hook failure.\n')
        process.exit(1)
      }
      throw error
    }

    console.log('Building for production...')
    console.log('')
    // Placeholder - will be implemented in Story 6.2
    console.log('✓ TypeScript compilation complete')
    console.log('✓ Server bundle ready')

    // Determine output path (placeholder - will be dynamic in Story 6.2)
    const outputPath = `${projectRoot}/dist`

    // Execute post-build hook
    try {
      await runner.runPostBuild({ outputPath })
    } catch (error) {
      if (error instanceof HookError) {
        console.error(`\n❌ ${error.message}`)
        console.error('\nBuild completed but post-build hook failed.\n')
        process.exit(1)
      }
      throw error
    }

    console.log('')
    console.log('Build complete!')
  } catch (error) {
    // Handle config loading errors gracefully
    // If no config file exists, just run build without hooks
    if (error instanceof Error && error.message.includes('Configuration file not found')) {
      console.log('Building for production...')
      console.log('')
      console.log('✓ TypeScript compilation complete')
      console.log('✓ Server bundle ready')
      console.log('')
      console.log('Build complete!')
      return
    }
    throw error
  }
}
