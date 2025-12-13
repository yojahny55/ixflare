/**
 * @module commands/auth/rotate-keys
 * @description Manual key rotation CLI command
 * @node-only
 *
 * Note: Full CLI implementation deferred to Epic 6 (CLI Developer Experience).
 * See docs/sprint-artifacts/deferred-items.md for details.
 */

/**
 * Rotate JWT signing keys manually
 *
 * This command provides guidance on manual key rotation.
 * Full CLI implementation (wrangler integration, remote KV access)
 * is deferred to Epic 6.
 *
 * @example
 * ```bash
 * ix auth:rotate-keys
 * ```
 */
export async function rotateKeys(): Promise<void> {
  console.log(`
╭─────────────────────────────────────────╮
│   JWT Key Rotation                      │
╰─────────────────────────────────────────╯

ℹ️  Direct CLI rotation requires wrangler integration (Epic 6).
   Use one of the methods below for key rotation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. AUTOMATIC ROTATION (Recommended)
   Keys rotate automatically based on your configuration:
   - Default interval: 30 days
   - Grace period: 24 hours
   - No manual action required

2. MANUAL ROTATION via API ENDPOINT
   Create a protected endpoint in your application:

   ┌──────────────────────────────────────────────────────┐
   │ // src/routes/api/admin/rotate-keys.ts              │
   │                                                      │
   │ import { rotateKeys, KeyStore } from 'ixflare'      │
   │ import type { EdgeContext } from 'ixflare'          │
   │                                                      │
   │ export async function POST(ctx: EdgeContext) {      │
   │   // IMPORTANT: Add authentication check here!      │
   │   const keyStore = new KeyStore(ctx.env.JWT_KEYS)   │
   │   const config = { interval: '30d', gracePeriod: '24h' }│
   │                                                      │
   │   const result = await rotateKeys(                  │
   │     config,                                          │
   │     keyStore,                                        │
   │     'ES256',                                         │
   │     { encryptionSecret: ctx.env.KEY_ENCRYPTION_SECRET }│
   │   )                                                  │
   │                                                      │
   │   return Response.json({                            │
   │     success: true,                                   │
   │     kid: result.kid,                                 │
   │     encrypted: result.encrypted,                    │
   │     rotatedAt: new Date(result.rotatedAt).toISOString()│
   │   })                                                 │
   │ }                                                    │
   └──────────────────────────────────────────────────────┘

   Trigger rotation:
   $ curl -X POST https://your-app.workers.dev/api/admin/rotate-keys \\
       -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

3. CHECK CURRENT KEY STATUS
   View JWKS endpoint: GET /.well-known/jwks.json
   Shows active keys and their IDs (kid)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 Security Notes:
   - Always protect manual rotation endpoints with authentication
   - Use encryptionSecret to encrypt private keys at rest
   - Set KEY_ENCRYPTION_SECRET in wrangler.toml secrets

📖 Docs: See docs/sprint-artifacts/deferred-items.md for CLI roadmap
`)
}
