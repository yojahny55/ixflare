/**
 * @module commands/auth/rotate-keys
 * @description Manual key rotation CLI command
 * @node-only
 */

/**
 * Rotate JWT signing keys manually
 *
 * Note: This is a placeholder implementation. Full implementation requires:
 * 1. Worker API endpoint for rotation
 * 2. Wrangler integration for remote KV access
 * 3. Authenticated API calls to trigger rotation
 *
 * For now, this command provides guidance on manual rotation.
 *
 * @example
 * ```bash
 * ix auth:rotate-keys
 * ```
 */
export async function rotateKeys(): Promise<void> {
  console.log(`
╭─────────────────────────────────────────╮
│                                         │
│   JWT Key Rotation                      │
│                                         │
╰─────────────────────────────────────────╯

⚠️  Manual key rotation via CLI is not yet fully implemented.

To rotate keys, you have two options:

1. **Automatic Rotation (Recommended)**
   - Keys rotate automatically based on your configuration
   - Default: Every 30 days with 24h grace period
   - No action needed from you

2. **Manual Rotation via API**
   - Create a protected API endpoint in your application:

   \`\`\`typescript
   // src/routes/api/admin/rotate-keys.ts
   import { rotateKeys, KeyStore } from 'ixflare/auth/rotation'
   import type { EdgeContext } from 'ixflare'

   export async function POST(ctx: EdgeContext) {
     // Add authentication check here
     const keyStore = new KeyStore(ctx.env.KV_NAMESPACE)
     const config = { interval: '30d', gracePeriod: '24h' }

     const result = await rotateKeys(config, keyStore, 'ES256')

     return Response.json({
       success: true,
       newKeyId: result.kid,
       rotatedAt: new Date(result.rotatedAt).toISOString(),
     })
   }
   \`\`\`

   Then trigger rotation:
   \`\`\`bash
   curl -X POST https://your-app.workers.dev/api/admin/rotate-keys \\
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   \`\`\`

3. **Check Current Key Status**
   - View your JWKS endpoint: \`/.well-known/jwks.json\`
   - Inspect active keys and rotation schedule

For more information, see: docs/authentication/key-rotation.md
`)
}
