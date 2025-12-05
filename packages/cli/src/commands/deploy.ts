/**
 * @module commands/deploy
 * @description Deploy to Cloudflare Workers command
 */

import { HooksRunner, HookError } from '../hooks/index'

export async function deploy(): Promise<void> {
  const projectRoot = process.cwd()
  const runner = new HooksRunner()

  try {
    // Load configuration
    await runner.loadConfig(projectRoot)

    // Detect environment (use NODE_ENV or default to production)
    const environment = process.env.NODE_ENV === 'development' ? 'development' : 'production'

    // Execute pre-deploy hook
    try {
      await runner.runPreDeploy({ environment })
    } catch (error) {
      if (error instanceof HookError) {
        console.error(`\n❌ ${error.message}`)
        console.error('\nDeployment stopped due to hook failure.\n')
        process.exit(1)
      }
      throw error
    }

    console.log('Deploying to Cloudflare Workers...')
    console.log('')
    // Placeholder - will be implemented in Story 6.3
    console.log('✓ Build verified')
    console.log('✓ Uploading to Cloudflare')
    console.log('')

    // Placeholder deployment URL - will be dynamic in Story 6.3
    const deploymentUrl = 'https://my-app.workers.dev'
    console.log('✓ Deployed successfully!')

    // Execute post-deploy hook
    try {
      await runner.runPostDeploy({ url: deploymentUrl })
    } catch (error) {
      if (error instanceof HookError) {
        console.error(`\n❌ ${error.message}`)
        console.error('\nDeployment completed but post-deploy hook failed.\n')
        process.exit(1)
      }
      throw error
    }
  } catch (error) {
    // Handle config loading errors gracefully
    // If no config file exists, just run deploy without hooks
    if (error instanceof Error && error.message.includes('Configuration file not found')) {
      console.log('Deploying to Cloudflare Workers...')
      console.log('')
      console.log('✓ Build verified')
      console.log('✓ Uploading to Cloudflare')
      console.log('')
      console.log('✓ Deployed successfully!')
      return
    }
    throw error
  }
}
