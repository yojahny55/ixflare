/**
 * First-time deployment wizard flow
 * Guides user through Cloudflare credential setup
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import picocolors from 'picocolors'
import type { WizardContext } from '@/wizard/context'
import type { CredentialStatus } from '@/wizard/types'

const { bold, green, yellow, cyan, dim, red } = picocolors

/**
 * Detect existing Cloudflare credentials
 */
export function detectCloudflareCredentials(): CredentialStatus {
  // 1. Check environment variables
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return {
      hasCredentials: true,
      source: 'env',
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    }
  }

  // 2. Check wrangler auth file
  const wranglerAuthPath = join(homedir(), '.wrangler', 'config', 'default.toml')
  if (existsSync(wranglerAuthPath)) {
    return { hasCredentials: true, source: 'wrangler' }
  }

  return { hasCredentials: false }
}

/**
 * Validate API token format (basic check)
 */
function validateApiToken(token: string): boolean | string {
  if (!token || token.trim().length === 0) {
    return 'API token cannot be empty'
  }

  if (token.length < 10) {
    return 'API token seems too short'
  }

  // Cloudflare API tokens are typically 40+ characters
  if (token.length < 30) {
    return 'Token appears invalid. Cloudflare API tokens are typically 40+ characters.'
  }

  return true
}

/**
 * Test if credentials are valid by running wrangler whoami
 */
async function testCredentials(): Promise<boolean> {
  try {
    execSync('wrangler whoami', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Run the deploy setup wizard flow
 * @param ctx - Wizard context
 * @returns true if credentials are set up, false otherwise
 */
export async function deploySetupWizardFlow(ctx: WizardContext): Promise<boolean> {
  // Check for existing credentials
  const credentials = detectCloudflareCredentials()

  if (credentials.hasCredentials) {
    // Verify credentials still work
    const valid = await testCredentials()
    if (valid) {
      return true // Already configured and working
    }
    // Credentials exist but are invalid, continue with setup
    console.log(yellow('\nExisting credentials appear invalid. Let\'s set up new ones.\n'))
  }

  // Non-interactive mode requires environment variables
  if (!ctx.isInteractive) {
    console.error(red('Error: Cloudflare credentials required for deployment.'))
    console.error('')
    console.error('Set the following environment variable:')
    console.error(`  ${cyan('export CLOUDFLARE_API_TOKEN="your-token-here"')}`)
    console.error('')
    console.error('Or run interactively: ix deploy')
    return false
  }

  // Interactive setup
  console.log('')
  console.log(`${yellow('First-time deployment detected!')}`)
  console.log('')

  // Step 1: Check if user has account
  const hasAccount = await ctx.confirm('Do you have a Cloudflare account?', true)

  if (!hasAccount) {
    console.log('')
    console.log(`Create a free Cloudflare account:`)
    console.log(`  ${cyan('https://dash.cloudflare.com/sign-up')}`)
    console.log('')
    console.log(`After creating your account, run ${bold('ix deploy')} again.`)
    console.log('')
    return false
  }

  // Step 2: Choose authentication method
  const authMethod = await ctx.select('How would you like to authenticate?', [
    {
      title: `${cyan('Browser login')} ${dim('- Opens browser (recommended for local dev)')}`,
      value: 'browser' as const,
      description: 'Quick and easy, uses wrangler login',
    },
    {
      title: `${cyan('API token')} ${dim('- Enter token manually (for CI/CD)')}`,
      value: 'token' as const,
      description: 'More secure, recommended for automated deployments',
    },
  ])

  if (!authMethod) {
    return false // Cancelled
  }

  if (authMethod === 'browser') {
    return await handleBrowserAuth()
  } else {
    return await handleTokenAuth(ctx)
  }
}

/**
 * Handle browser-based authentication
 */
async function handleBrowserAuth(): Promise<boolean> {
  console.log('')
  console.log('Starting browser authentication...')
  console.log('')

  try {
    execSync('wrangler login', { stdio: 'inherit' })
    console.log('')
    console.log(`${green('✓')} Authentication successful!`)
    console.log('')
    return true
  } catch {
    console.error('')
    console.error(`${red('✗')} Browser authentication failed.`)
    console.error('Try using an API token instead.')
    console.error('')
    return false
  }
}

/**
 * Handle API token authentication with secure input
 */
async function handleTokenAuth(ctx: WizardContext): Promise<boolean> {
  console.log('')
  console.log(`${bold('Create an API Token:')}`)
  console.log('')
  console.log(`${dim('1.')} Go to: ${cyan('https://dash.cloudflare.com/profile/api-tokens')}`)
  console.log(`${dim('2.')} Click ${bold('"Create Token"')}`)
  console.log(`${dim('3.')} Use template: ${bold('"Edit Cloudflare Workers"')}`)
  console.log(`${dim('4.')} Click "Continue to Summary" then "Create Token"`)
  console.log(`${dim('5.')} Copy the token (shown only once)`)
  console.log('')

  // Secure token input with masked password
  const token = await ctx.password('Paste your API Token:', {
    validate: validateApiToken,
  })

  if (!token) {
    return false // Cancelled
  }

  // Store token using wrangler
  console.log('')
  console.log('Storing credentials securely...')

  try {
    // Use wrangler to store the token
    execSync(`wrangler config --api-token "${token}"`, { stdio: 'pipe' })

    // Verify the token works
    const valid = await testCredentials()
    if (!valid) {
      console.error('')
      console.error(`${red('✗')} Token validation failed. Please check your token and try again.`)
      return false
    }

    console.log(`${green('✓')} Credentials saved securely!`)
    console.log('')
    return true
  } catch {
    console.error('')
    console.error(`${red('✗')} Failed to store credentials.`)
    console.error('')
    console.error('Alternative: Set the token as an environment variable:')
    console.error(`  ${cyan('export CLOUDFLARE_API_TOKEN="your-token"')}`)
    console.error('')
    return false
  }
}

/**
 * Display credential setup instructions (non-interactive fallback)
 */
export function displayCredentialInstructions(): void {
  console.log('')
  console.log(`${bold('To deploy to Cloudflare Workers, you need:')}`)
  console.log('')
  console.log(`1. A Cloudflare account (free): ${cyan('https://dash.cloudflare.com/sign-up')}`)
  console.log(`2. An API token with Workers permissions`)
  console.log('')
  console.log(`${bold('Create an API Token:')}`)
  console.log('')
  console.log(`${dim('1.')} Go to: ${cyan('https://dash.cloudflare.com/profile/api-tokens')}`)
  console.log(`${dim('2.')} Click "Create Token"`)
  console.log(`${dim('3.')} Use template: "Edit Cloudflare Workers"`)
  console.log(`${dim('4.')} Required permissions:`)
  console.log(`   - Account: Workers Scripts (Edit)`)
  console.log(`   - Account: Workers KV Storage (Edit)`)
  console.log(`   - Account: Account Settings (Read)`)
  console.log(`   - Zone: Workers Routes (Edit)`)
  console.log(`${dim('5.')} Click "Continue to Summary" then "Create Token"`)
  console.log(`${dim('6.')} Copy the token (shown only once)`)
  console.log('')
  console.log(`${bold('Set the token:')}`)
  console.log(`  ${cyan('export CLOUDFLARE_API_TOKEN="your-token-here"')}`)
  console.log('')
  console.log(`Or add to your shell profile:`)
  console.log(`  ${dim('echo \'export CLOUDFLARE_API_TOKEN="your-token"\' >> ~/.zshrc')}`)
  console.log('')
}
