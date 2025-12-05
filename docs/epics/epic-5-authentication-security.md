# Epic 5: Authentication & Security

**Epic Goal:** Enable developers to implement secure authentication flows with JWT tokens, session management, and authorization patterns while the framework handles security best practices automatically.

**FR Coverage:** FR79, FR80, FR129, FR138, FR139, FR140, plus auth-related aspects from Architecture (JWT, OAuth, Sessions, RBAC)

---

## Story 5.1: Custom WebCrypto JWT Implementation

As a **developer**,
I want a lightweight JWT implementation using WebCrypto,
So that I can authenticate users without heavy dependencies.

**Acceptance Criteria:**

**Given** I need to create a JWT token (Architecture: Custom JWT ~2KB)
**When** I use the auth module:
```typescript
import { jwt } from 'ixflare/auth'

// Create a token
const token = await jwt.sign({
  userId: user.id,
  email: user.email,
  role: user.role,
}, {
  expiresIn: '15m',  // Short-lived (Architecture: 15m default)
})

// Verify a token
const payload = await jwt.verify(token)
// payload: { userId: 1, email: 'user@example.com', role: 'user', iat: ..., exp: ... }
```
**Then** the token is created using WebCrypto APIs
**And** the implementation is ~2KB (no jose dependency)
**And** the API is jose-compatible for familiarity

**Given** I configure the JWT algorithm (Architecture: Single Algorithm Enforcement)
**When** I set it in `edge.config.ts`:
```typescript
export default defineConfig({
  auth: {
    jwt: {
      algorithm: 'ES256',  // OR 'HS256', pick one
      secret: env.JWT_SECRET,  // For HS256
      // OR
      privateKey: env.JWT_PRIVATE_KEY,  // For ES256
      publicKey: env.JWT_PUBLIC_KEY,
    },
  },
})
```
**Then** all tokens use the configured algorithm
**And** mixed algorithms are rejected

**Given** a token has expired
**When** I verify it
**Then** a `TokenExpiredError` is thrown with expiry time
**And** I can handle refresh logic appropriately

**Technical Notes:**
- Implement in `packages/ixflare/src/auth/jwt.ts`
- Use WebCrypto for cryptographic operations (edge-compatible)
- ES256 (ECDSA) recommended for asymmetric, HS256 for symmetric
- No external JWT libraries needed

**Prerequisites:** Epic 1 (config system)

---

## Story 5.2: Session Management

As a **developer**,
I want flexible session management across storage tiers,
So that I can maintain user state securely.

**Acceptance Criteria:**

**Given** I configure session handling (Architecture: Session Hybrid Model)
**When** I set up sessions:
```typescript
// edge.config.ts
export default defineConfig({
  auth: {
    session: {
      strategy: 'jwt',  // 'jwt' | 'database' | 'hybrid'
      cookie: {
        name: '__session',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,  // 7 days
      },
    },
  },
})
```
**Then** sessions are managed according to the strategy

**Given** I use JWT sessions (stateless)
**When** I access the session:
```typescript
export async function loader({ request, session }: LoaderArgs) {
  if (!session.userId) {
    return redirect('/login')
  }
  const user = await User.find(session.userId)
  return { user }
}
```
**Then** session data is decoded from the JWT cookie
**And** no database lookup is required for basic session info

**Given** I need to revoke sessions (Architecture: KV for revocation)
**When** I use the hybrid strategy:
```typescript
// Revoke all sessions for a user
await session.revokeAll(userId)

// Revoke specific session
await session.revoke(sessionId)

// Check if session is revoked (KV lookup)
const isValid = await session.isValid()
```
**Then** revoked sessions are tracked in KV
**And** active sessions can be invalidated immediately

**Given** I need cross-device session management
**When** I query active sessions:
```typescript
const sessions = await Session.where({ userId: user.id }).all()
// [{ id, device, lastActive, createdAt }, ...]
```
**Then** I can list and manage user sessions

**Technical Notes:**
- JWT → KV → DO hybrid model (Architecture)
- Short-lived access tokens (15m) + longer refresh tokens
- Revocation list in KV for compromised tokens
- DO for real-time session coordination if needed

**Prerequisites:** Story 5.1, Epic 3 (KV storage)

---

## Story 5.3: OAuth Primitives & Adapters

As a **developer**,
I want built-in OAuth support for social login,
So that users can authenticate with existing accounts.

**Acceptance Criteria:**

**Given** I want to add GitHub OAuth (Architecture: OAuth Primitives)
**When** I configure an OAuth provider:
```typescript
// edge.config.ts
export default defineConfig({
  auth: {
    providers: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        scopes: ['user:email'],
      },
    },
  },
})
```
**Then** OAuth routes are automatically created:
- `GET /auth/github` - Redirect to GitHub
- `GET /auth/github/callback` - Handle callback

**Given** a user completes OAuth flow
**When** GitHub redirects back:
```typescript
// src/routes/auth/github/callback.ts (optional customization)
import { handleOAuthCallback } from 'ixflare/auth'

export const GET = handleOAuthCallback('github', async (profile, tokens) => {
  // profile: { id, email, name, avatar }
  let user = await User.where({ githubId: profile.id }).first()

  if (!user) {
    user = await User.create({
      email: profile.email,
      name: profile.name,
      githubId: profile.id,
      avatarUrl: profile.avatar,
    })
  }

  return { user, redirect: '/dashboard' }
})
```
**Then** the user is authenticated
**And** I can create or link accounts

**Given** I want to add multiple providers
**When** I configure them:
```typescript
providers: {
  github: { /* ... */ },
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    scopes: ['email', 'profile'],
  },
  discord: { /* ... */ },
}
```
**Then** all providers work with the same pattern

**Given** I need custom OAuth providers
**When** I define a custom provider:
```typescript
import { defineOAuthProvider } from 'ixflare/auth'

export const customProvider = defineOAuthProvider({
  id: 'corporate-sso',
  authorizationUrl: 'https://sso.company.com/authorize',
  tokenUrl: 'https://sso.company.com/token',
  userInfoUrl: 'https://sso.company.com/userinfo',
  scopes: ['openid', 'profile', 'email'],
})
```
**Then** the custom provider works like built-in ones

**Technical Notes:**
- OAuth 2.0 authorization code flow
- PKCE for enhanced security (optional)
- Store provider tokens in secure session if refresh needed
- Support for OpenID Connect providers

**Prerequisites:** Story 5.2

---

## Story 5.4: Authorization with RBAC + Policies

As a **developer**,
I want flexible authorization using roles and policies,
So that I can control access to resources granularly.

**Acceptance Criteria:**

**Given** I define roles for my application (Architecture: Hybrid RBAC + Policies)
**When** I configure RBAC:
```typescript
// src/auth/roles.ts
import { defineRoles } from 'ixflare/auth'

export const roles = defineRoles({
  admin: {
    permissions: ['*'],  // All permissions
  },
  moderator: {
    permissions: ['posts:read', 'posts:update', 'posts:delete', 'users:read'],
  },
  user: {
    permissions: ['posts:read', 'posts:create'],
  },
})
```
**Then** roles are available for authorization checks

**Given** I want to protect a route by role
**When** I use the `requireRole` middleware:
```typescript
// src/routes/admin/users.ts
import { requireRole } from 'ixflare/auth'

export const middleware = [requireRole('admin')]

export const GET: RouteHandler = async () => {
  const users = await User.all()
  return Response.json(users)
}
```
**Then** only admins can access the route
**And** others receive 403 Forbidden

**Given** I need resource-level authorization (policies)
**When** I define policies:
```typescript
// src/auth/policies.ts
import { definePolicy } from 'ixflare/auth'

export const postPolicy = definePolicy({
  view: (user, post) => true,  // Anyone can view
  update: (user, post) => user.id === post.authorId || user.role === 'admin',
  delete: (user, post) => user.id === post.authorId || user.role === 'admin',
})
```
**And** I use them in handlers:
```typescript
export const PUT: RouteHandler = async ({ user, params }) => {
  const post = await Post.findOrFail(params.id)

  if (!postPolicy.can(user, 'update', post)) {
    throw new ForbiddenError('Cannot update this post')
  }

  // ... update post
}
```
**Then** authorization is checked against the specific resource

**Given** I want to check permissions in components
**When** I use the authorization helpers:
```typescript
export default function PostActions({ post, user }) {
  return (
    <div>
      {postPolicy.can(user, 'update', post) && (
        <button>Edit</button>
      )}
      {postPolicy.can(user, 'delete', post) && (
        <button>Delete</button>
      )}
    </div>
  )
}
```
**Then** UI reflects user permissions

**Technical Notes:**
- RBAC for broad access control
- Policies for resource-specific rules
- Cache permission checks for performance
- Audit log integration (optional)

**Prerequisites:** Story 5.2

---

## Story 5.5: Automatic Key Rotation

As a **developer**,
I want JWT signing keys to rotate automatically,
So that key compromise has limited impact.

**Acceptance Criteria:**

**Given** key rotation is configured (Architecture: 30d interval, 24h grace)
**When** I set up rotation:
```typescript
// edge.config.ts
export default defineConfig({
  auth: {
    jwt: {
      algorithm: 'ES256',
      rotation: {
        interval: '30d',      // Generate new key every 30 days
        gracePeriod: '24h',   // Accept old key for 24h after rotation
      },
    },
  },
})
```
**Then** keys rotate automatically

**Given** a new key is generated
**When** tokens are created
**Then** new tokens use the new key
**And** existing tokens (with old key) still verify during grace period

**Given** I need to manually rotate keys
**When** I run `ix auth:rotate-keys`:
```bash
$ ix auth:rotate-keys

Current key expires: 2024-12-15
New key will be active: 2024-12-16

? Rotate keys now? (Y/n)

✓ New key generated
✓ Old key moved to grace period (expires in 24h)
✓ KV updated with new JWKS
```
**Then** keys are rotated immediately

**Given** I expose JWKS for external verification
**When** clients request `/.well-known/jwks.json`
**Then** they receive the current public keys:
```json
{
  "keys": [
    { "kid": "key-2024-12", "kty": "EC", "crv": "P-256", ... },
    { "kid": "key-2024-11", "kty": "EC", "crv": "P-256", ... }  // Grace period
  ]
}
```

**Technical Notes:**
- Store keys in KV with versioning
- JWKS endpoint for external services
- Include key ID (kid) in token headers
- Automatic cleanup of expired keys

**Prerequisites:** Story 5.1

---

## Story 5.6: CSRF Protection

As a **developer**,
I want automatic CSRF protection on state-changing operations,
So that my application is protected from cross-site attacks.

**Acceptance Criteria:**

**Given** CSRF protection is enabled (default) (FR79)
**When** I configure it:
```typescript
// edge.config.ts
export default defineConfig({
  security: {
    csrf: {
      enabled: true,
      cookie: '__csrf',
      header: 'X-CSRF-Token',
      methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    },
  },
})
```
**Then** CSRF tokens are required for state-changing requests

**Given** I render a form
**When** I use the CSRF token helper:
```typescript
import { csrfToken } from 'ixflare/auth'

export default function CreatePostForm() {
  return (
    <form method="POST" action="/api/posts">
      <input type="hidden" name="_csrf" value={csrfToken()} />
      <input type="text" name="title" />
      <button type="submit">Create</button>
    </form>
  )
}
```
**Then** the form includes the CSRF token

**Given** a request lacks a valid CSRF token
**When** a POST request is made without the token
**Then** a 403 Forbidden response is returned:
```json
{
  "error": {
    "code": "CSRF_INVALID",
    "message": "Invalid or missing CSRF token"
  }
}
```

**Given** I make API requests with fetch
**When** I include the token in headers:
```typescript
const response = await fetch('/api/posts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken(),  // From cookie or meta tag
  },
  body: JSON.stringify({ title: 'New Post' }),
})
```
**Then** the request is accepted

**Technical Notes:**
- Double-submit cookie pattern for stateless CSRF
- Token in cookie (httpOnly: false for JS access) + header/body
- Automatic injection in SSR forms
- Skip CSRF for same-origin API requests with credentials

**Prerequisites:** Story 5.2

---

## Story 5.7: Secure Cookie Handling

As a **developer**,
I want cookies to be secure by default,
So that session data is protected from attacks.

**Acceptance Criteria:**

**Given** I set a cookie (FR80)
**When** I use the cookie helpers:
```typescript
import { setCookie, getCookie, deleteCookie } from 'ixflare/auth'

export const POST: RouteHandler = async ({ request }) => {
  // Set a secure cookie
  const response = Response.json({ success: true })

  setCookie(response, 'preferences', JSON.stringify({ theme: 'dark' }), {
    httpOnly: true,      // Default: true
    secure: true,        // Default: true in production
    sameSite: 'lax',     // Default: 'lax'
    maxAge: 60 * 60 * 24 * 30,  // 30 days
    path: '/',
  })

  return response
}
```
**Then** cookies have secure defaults

**Given** I read a cookie
**When** I use `getCookie`:
```typescript
export const GET: RouteHandler = async ({ request }) => {
  const preferences = getCookie(request, 'preferences')
  // preferences: string | null
}
```
**Then** I can access the cookie value

**Given** I need to delete a cookie
**When** I use `deleteCookie`:
```typescript
export const POST: RouteHandler = async ({ request }) => {
  const response = Response.json({ success: true })
  deleteCookie(response, 'preferences')
  return response
}
```
**Then** the cookie is cleared with proper attributes

**Given** production environment
**When** any cookie is set without explicit secure options
**Then** `secure: true` and `httpOnly: true` are enforced
**And** a warning is logged if insecure options are attempted

**Technical Notes:**
- Default to secure settings in production
- Support signed cookies for tamper detection
- Cookie prefix validation (__Secure-, __Host-)
- Clear error messages for cookie issues

**Prerequisites:** Epic 2 (middleware)

---

## Story 5.8: Security Headers Auto-Injection

As a **developer**,
I want security headers automatically added to responses,
So that common vulnerabilities are mitigated.

**Acceptance Criteria:**

**Given** security headers are enabled (default)
**When** I configure them:
```typescript
// edge.config.ts
export default defineConfig({
  security: {
    headers: {
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],  // Customize as needed
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
      // Automatically set based on best practices
      strictTransportSecurity: true,  // HSTS
      xContentTypeOptions: true,      // nosniff
      xFrameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
    },
  },
})
```
**Then** responses include security headers

**Given** default configuration
**When** a response is sent
**Then** it includes:
```
Content-Security-Policy: default-src 'self'; script-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 0  (deprecated, rely on CSP)
```

**Given** I need to customize headers for a route
**When** I override in the route:
```typescript
export const config = {
  security: {
    headers: {
      xFrameOptions: 'SAMEORIGIN',  // Allow embedding on same origin
    },
  },
}
```
**Then** route-specific headers override global defaults

**Given** HTTP to HTTPS redirect is needed (FR140)
**When** a request comes over HTTP in production
**Then** it's redirected to HTTPS with 301
**And** HSTS header prevents future HTTP requests

**Technical Notes:**
- Implement as global middleware
- CSP nonce generation for inline scripts
- Report-only mode for testing CSP changes
- Per-route overrides supported

**Prerequisites:** Epic 2 (middleware)

---

## Story 5.9: XSS Prevention & Auto-Sanitization

As a **developer**,
I want automatic XSS prevention,
So that user-provided content is safely rendered.

**Acceptance Criteria:**

**Given** I render user content in React (FR129)
**When** I use JSX:
```typescript
export default function Comment({ comment }) {
  return (
    <div>
      {/* Automatically escaped by React */}
      <p>{comment.body}</p>

      {/* Dangerous - must be explicit */}
      <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
    </div>
  )
}
```
**Then** content is escaped by default
**And** dangerous patterns require explicit opt-in

**Given** I need to allow safe HTML
**When** I use the sanitizer:
```typescript
import { sanitizeHtml } from 'ixflare/security'

const allowedTags = ['p', 'b', 'i', 'a', 'ul', 'li']
const sanitized = sanitizeHtml(userInput, { allowedTags })

// Use sanitized HTML
<div dangerouslySetInnerHTML={{ __html: sanitized }} />
```
**Then** only allowed tags remain
**And** dangerous attributes (onclick, onerror) are removed

**Given** I store user input in the database
**When** I save content:
```typescript
// Sanitization on output, not input (preserve original)
await Post.create({
  title: userInput.title,  // Stored as-is
  content: userInput.content,  // Stored as-is
})

// Sanitized on render
const safeContent = sanitizeHtml(post.content)
```
**Then** original content is preserved
**And** sanitization happens at render time

**Given** API responses return user content
**When** JSON is returned
**Then** no HTML encoding is needed (JSON-safe)
**But** client must escape when rendering to DOM

**Technical Notes:**
- React auto-escapes by default (primary defense)
- DOMPurify-style sanitization for allowed HTML
- CSP as secondary defense layer
- Input validation separate from output encoding

**Prerequisites:** Epic 4 (React SSR)

---

## Story 5.10: Dependency Vulnerability Scanning

As a **developer**,
I want automatic vulnerability scanning of dependencies,
So that I'm alerted to security issues in packages.

**Acceptance Criteria:**

**Given** I want to check for vulnerabilities (FR138)
**When** I run `ix security:audit`:
```bash
$ ix security:audit

Scanning dependencies...

Found 2 vulnerabilities:

HIGH: lodash < 4.17.21
  Path: ixflare > internal-dep > lodash
  Fix: Update internal-dep to ^2.0.0

MODERATE: axios < 1.6.0
  Path: my-app > axios
  Fix: Run `pnpm update axios`

Run `ix security:audit --fix` to auto-fix where possible.
```
**Then** I see a list of vulnerabilities with severity
**And** remediation steps are provided

**Given** I want automatic scanning in CI
**When** I configure GitHub Actions:
```yaml
- name: Security Audit
  run: ix security:audit --ci
```
**Then** the build fails if high/critical vulnerabilities exist
**And** PR comments show vulnerability details

**Given** I want to ignore a known issue
**When** I add to `.ixignore`:
```
# Ignore specific vulnerability (with reason)
CVE-2023-XXXX # False positive, not exploitable in our usage
```
**Then** the vulnerability is skipped in reports

**Given** I install new dependencies
**When** I run `pnpm add some-package`
**Then** a warning is shown if the package has known vulnerabilities
**And** I can proceed or cancel

**Technical Notes:**
- Use npm audit / pnpm audit under the hood
- Integration with vulnerability databases (GitHub Advisory, Snyk)
- Lock file analysis for accurate dependency tree
- Configurable severity thresholds

**Prerequisites:** Epic 1 (CLI)

---

## Story 5.11: Secret Management & Log Redaction

As a **developer**,
I want secrets to be encrypted and redacted from logs,
So that sensitive data is never exposed accidentally.

**Acceptance Criteria:**

**Given** I define secrets in environment (FR139)
**When** I access them:
```typescript
// Secrets are accessible but protected
const apiKey = env.STRIPE_SECRET_KEY

// Use in code
const stripe = new Stripe(apiKey)
```
**Then** secrets work normally in code

**Given** an error occurs with secret in context
**When** the error is logged:
```typescript
try {
  await fetch(`https://api.stripe.com/v1/charges`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
} catch (error) {
  console.error(error)  // Secret redacted in logs
}
```
**Then** the secret is redacted:
```
Error: fetch failed
  URL: https://api.stripe.com/v1/charges
  Headers: { Authorization: "Bearer [REDACTED]" }
```

**Given** I accidentally log a secret
**When** the log is processed:
```typescript
console.log('API Key:', env.STRIPE_SECRET_KEY)
// Output: "API Key: [REDACTED:STRIPE_SECRET_KEY]"
```
**Then** the secret value is replaced with a placeholder

**Given** I want to see secrets in development
**When** I enable verbose mode:
```bash
IX_DEBUG_SECRETS=true ix dev
```
**Then** secrets are shown in local development only
**And** production always redacts

**Given** I store secrets for deployment
**When** I use `ix secrets:set`:
```bash
$ ix secrets:set STRIPE_SECRET_KEY
Enter value: ****
✓ Secret encrypted and stored
```
**Then** secrets are encrypted at rest

**Technical Notes:**
- Pattern matching for common secret formats
- Environment variable names matching *_SECRET*, *_KEY*, *_TOKEN*
- Encryption using Cloudflare's secrets manager
- Never log request bodies that might contain credentials

**Prerequisites:** Epic 1 (environment management)

---

**Epic 5 Complete: Authentication & Security**

**Stories Created:** 11
**FR Coverage:** FR79, FR80, FR129, FR138, FR139, FR140, plus Architecture auth requirements (JWT, OAuth, Sessions, RBAC, Key Rotation)
**Technical Context Used:** WebCrypto JWT (~2KB), JWT→KV→DO session hybrid, OAuth primitives, RBAC + Policies, automatic key rotation
**UX Patterns Incorporated:** Enterprise Evaluation Flow security requirements, security audit badges

---
