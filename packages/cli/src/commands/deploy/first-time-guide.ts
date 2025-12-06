/**
 * @module commands/deploy/first-time-guide
 * @description Interactive first-time deployment guide
 */

import prompts from 'prompts'
import { execSync } from 'child_process'

/**
 * Show first-time deployment guide and walk user through setup
 */
export async function showFirstTimeGuide(): Promise<boolean> {
  console.log(`
First-time deployment detected!

To deploy to Cloudflare Workers, you need:
1. A Cloudflare account (free): https://dash.cloudflare.com/sign-up
2. An API token with Workers permissions

Let's set this up:
`)

  const { hasAccount } = await prompts({
    type: 'confirm',
    name: 'hasAccount',
    message: 'Do you have a Cloudflare account?',
    initial: true,
  })

  if (!hasAccount) {
    console.log(`
Create a free Cloudflare account:
  https://dash.cloudflare.com/sign-up

After creating your account, run 'ix deploy' again.
`)
    return false
  }

  const { authMethod } = await prompts({
    type: 'select',
    name: 'authMethod',
    message: 'How would you like to authenticate?',
    choices: [
      { title: 'Browser login (recommended for local dev)', value: 'browser' },
      { title: 'API token (recommended for CI/CD)', value: 'token' },
    ],
  })

  if (authMethod === 'browser') {
    console.log(`
Starting browser authentication...
`)
    try {
      execSync('wrangler login', { stdio: 'inherit' })
      console.log(`
✅ Authentication successful!
`)
      return true
    } catch {
      console.error('❌ Browser authentication failed. Try using an API token instead.')
      return false
    }
  } else {
    await guideApiTokenCreation()
    return false // User needs to set token and re-run
  }
}

/**
 * Display instructions for creating API token
 */
async function guideApiTokenCreation(): Promise<void> {
  console.log(`
Create an API Token:

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: "Edit Cloudflare Workers"
4. Configure permissions:
   - Account: Workers Scripts (Edit)
   - Account: Workers KV Storage (Edit)
   - Account: Account Settings (Read)
   - Zone: Workers Routes (Edit)
5. Click "Continue to Summary" then "Create Token"
6. Copy the token (shown only once)

Set the token as an environment variable:
  export CLOUDFLARE_API_TOKEN="your-token-here"

Or add to your shell profile (~/.zshrc or ~/.bashrc):
  echo 'export CLOUDFLARE_API_TOKEN="your-token"' >> ~/.zshrc

Then run 'ix deploy' again.
`)
}

/**
 * Prompt user to choose authentication method
 */
export async function promptCloudflareAccount(): Promise<boolean> {
  const { hasAccount } = await prompts({
    type: 'confirm',
    name: 'hasAccount',
    message: 'Do you have a Cloudflare account?',
    initial: true,
  })

  return hasAccount
}

/**
 * Validate and store credentials
 */
export async function validateAndStoreCredentials(): Promise<boolean> {
  try {
    // Test authentication by running wrangler whoami
    execSync('wrangler whoami', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}
