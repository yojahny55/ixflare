# Test Results ✅

- **Tests:** 45 passed
- **Coverage:** 87.5%
- **Duration:** 23s

All checks passed!
```

**Technical Notes:**
- Provide CI templates for GitHub Actions, GitLab CI
- Support parallel test execution
- Cache dependencies between runs
- Upload coverage to Codecov/Coveralls

**Prerequisites:** Story 7.7

---

**Epic 7 Complete: Testing Framework**

**Stories Created:** 9
**FR Coverage:** FR36, FR37, FR38, FR39, FR40, FR41, FR130, FR131, FR132
**Technical Context Used:** Vitest, Miniflare for Workers simulation, fixture factories, coverage thresholds
**UX Patterns Incorporated:** CI/CD integration for automated quality

---

# Epic 8: Deployment & Production

**Epic Goal:** Enable developers to deploy their applications to Cloudflare Workers with confidence, manage multiple environments, monitor production health, and rollback if issues occur.

**FR Coverage:** FR69, FR70, FR74, FR103, FR134, FR144, FR156, FR157, FR168, FR173, plus health checks, compression, graceful shutdown

---

## Story 8.1: Single Command Deployment

As a **developer**,
I want to deploy with a single command,
So that shipping updates is fast and simple.

**Acceptance Criteria:**

**Given** I have a production-ready application
**When** I run `ix deploy` (FR69):
```bash
$ ix deploy

Preparing deployment...

✓ Running pre-deploy checks
  ✓ TypeScript compilation
  ✓ Tests passing
  ✓ Bundle size: 38KB (limit: 1MB)

Deploying to production...

✓ Uploading Worker bundle
✓ Configuring D1 bindings
✓ Configuring KV namespaces
✓ Running database migrations
✓ Deploying to edge (300+ locations)

✓ Deployed successfully!

🌍 https://my-app.workers.dev
📊 Dashboard: https://dash.cloudflare.com/workers/my-app
```
**Then** the application is deployed globally

**Given** deployment includes database changes
**When** migrations are pending
**Then** they run automatically:
```
Running migrations...
  ✓ 0003_add_tags.sql (applied)
```

**Given** pre-deploy checks fail
**When** I run `ix deploy`
**Then** deployment is blocked with clear errors:
```
❌ Pre-deploy checks failed:

  TypeScript: 2 errors
    src/routes/api/users.ts:15 - Type error

  Tests: 1 failing
    tests/routes/users.test.ts - Expected 200, got 500

Fix these issues before deploying.
```

**Technical Notes:**
- Run type check, tests, and build before deploy
- Use Wrangler API for deployment
- Automatic migration on deploy (configurable)
- Store deployment metadata for history

**Prerequisites:** Epic 6 (CLI)

---

## Story 8.2: Edge-Optimized Bundles

As a **developer**,
I want production bundles optimized for edge execution,
So that my application is fast globally.

**Acceptance Criteria:**

**Given** I build for production (FR70)
**When** the build completes
**Then** bundles are optimized for Workers:
- Tree-shaking removes unused code
- Minification reduces size
- Code splitting by route
- Server-only code excluded from client

**Given** I check bundle composition
**When** I run `ix build --analyze`:
```
Bundle Analysis:

Server (worker.js): 38KB gzipped
├─ ixflare/runtime: 12KB
├─ ixflare/orm: 8KB
├─ src/routes: 10KB
└─ src/models: 8KB

Client bundles: 45KB total
├─ routes/index: 12KB
├─ routes/dashboard: 18KB
└─ shared: 15KB
```
**Then** I can identify optimization opportunities

**Given** bundle exceeds Workers limits
**When** I run `ix build`
**Then** I see actionable warnings:
```
⚠️ Server bundle (1.2MB) exceeds 1MB limit

Top contributors:
  1. lodash (245KB) - Consider lodash-es
  2. moment (180KB) - Consider date-fns
  3. aws-sdk (320KB) - Use modular imports

Run `ix build --analyze` for details.
```

**Technical Notes:**
- Validate against Cloudflare Workers 1MB compressed limit
- Provide actionable suggestions for oversized bundles
- Support for manual chunk configuration
- Source maps for debugging (not uploaded to production)

**Prerequisites:** Story 8.1

---

## Story 8.3: Deployment Rollback

As a **developer**,
I want to rollback to previous deployments,
So that I can quickly recover from bad deploys.

**Acceptance Criteria:**

**Given** a deployment causes issues (FR74)
**When** I run `ix rollback`:
```bash
$ ix rollback

Recent deployments:
  1. abc123 (current) - 5 minutes ago
  2. def456 - 2 hours ago
  3. ghi789 - 1 day ago

? Select version to rollback to: def456

Rolling back...

✓ Worker reverted to def456
✓ Deployment abc123 marked as rolled back

Rollback complete!

Note: Database migrations are NOT automatically rolled back.
Run `ix migrate:rollback` if needed.
```
**Then** the previous version is restored

**Given** I know the deployment ID
**When** I run `ix rollback def456`
**Then** rollback happens without prompts

**Given** I want to see deployment history (FR103)
**When** I run `ix deployments`:
```bash
$ ix deployments

Deployment History (production):

  ID      | Status     | Date              | Duration
  --------|------------|-------------------|----------
  abc123  | rolled-back| 2024-12-04 14:30  | 12s
  def456  | active     | 2024-12-04 12:00  | 15s
  ghi789  | superseded | 2024-12-03 10:00  | 11s
```
**Then** I see all deployments with status

**Technical Notes:**
- Keep last 10 deployments by default
- Instant rollback via Cloudflare's versioning
- Warn about database rollback needs
- Store deployment metadata in KV

**Prerequisites:** Story 8.1

---

## Story 8.4: Post-Deployment Smoke Tests

As a **developer**,
I want automatic smoke tests after deployment,
So that I know the deploy succeeded.

**Acceptance Criteria:**

**Given** deployment completes (FR168)
**When** smoke tests run:
```
Running post-deployment smoke tests...

  ✓ Health check: /_health (200 OK, 23ms)
  ✓ Homepage: / (200 OK, 145ms)
  ✓ API: /api/v1/status (200 OK, 45ms)

All smoke tests passed!
```
**Then** basic functionality is verified

**Given** smoke tests fail
**When** deployment completes but tests fail:
```
❌ Smoke tests failed!

  ✕ API: /api/v1/status (500 Internal Server Error)
    Response: {"error":"Database connection failed"}

? Automatic rollback? (Y/n) y

Rolling back to previous version...
✓ Rolled back to def456
```
**Then** automatic rollback is offered

**Given** I configure custom smoke tests
**When** I define them in `edge.config.ts`:
```typescript
export default defineConfig({
  deploy: {
    smokeTests: [
      { path: '/_health', expectedStatus: 200 },
      { path: '/api/v1/users', expectedStatus: 200 },
      { path: '/admin', expectedStatus: 401 },  // Should require auth
    ],
  },
})
```
**Then** custom tests run after each deployment

**Technical Notes:**
- Run tests against live deployment URL
- Configurable timeout and retries
- Support for status code and response body checks
- Integration with monitoring systems

**Prerequisites:** Story 8.1

---

## Story 8.5: Health Check Endpoints

As a **developer**,
I want built-in health check endpoints,
So that load balancers and monitoring can verify application health.

**Acceptance Criteria:**

**Given** health checks are enabled (default)
**When** I request `/_health`:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-04T14:30:00Z",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "healthy", "latency": 12 },
    "cache": { "status": "healthy", "latency": 3 }
  }
}
```
**Then** detailed health status is returned

**Given** a dependency is unhealthy
**When** I request `/_health`:
```json
{
  "status": "degraded",
  "timestamp": "2024-12-04T14:30:00Z",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "unhealthy", "error": "Connection timeout" },
    "cache": { "status": "healthy", "latency": 3 }
  }
}
```
**Then** status is 503 and shows which component failed

**Given** I want a simple liveness check
**When** I request `/_health/live`:
**Then** I get 200 OK with minimal response:
```
OK
```

**Given** I configure custom health checks
**When** I define them:
```typescript
export default defineConfig({
  health: {
    checks: {
      database: async (env) => {
        await env.DB.exec('SELECT 1')
        return { status: 'healthy' }
      },
      externalApi: async () => {
        const res = await fetch('https://api.example.com/health')
        return { status: res.ok ? 'healthy' : 'unhealthy' }
      },
    },
  },
})
```
**Then** custom checks are included in health response

**Technical Notes:**
- `/_health` for detailed status (for monitoring)
- `/_health/live` for simple liveness (for load balancers)
- `/_health/ready` for readiness (for orchestration)
- Cache health check results briefly to avoid overhead

**Prerequisites:** Epic 2

---

## Story 8.6: Static Asset Serving

As a **developer**,
I want static assets served efficiently from the edge,
So that images, fonts, and files load quickly.

**Acceptance Criteria:**

**Given** I have static assets in `public/` (FR144)
**When** I request `/images/logo.png`:
**Then** the asset is served with proper caching:
```
HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: public, max-age=31536000, immutable
ETag: "abc123"
```

**Given** assets have fingerprinted names
**When** I build for production:
```
public/
  images/logo.png → /_assets/logo.abc123.png
  styles/app.css → /_assets/app.def456.css
```
**Then** assets get long-term caching with cache busting

**Given** I reference assets in code
**When** I use the asset helper:
```typescript
import { asset } from 'ixflare'

export default function Header() {
  return <img src={asset('/images/logo.png')} alt="Logo" />
}
// Outputs: <img src="/_assets/logo.abc123.png" alt="Logo" />
```
**Then** fingerprinted URLs are used automatically

**Technical Notes:**
- Use Cloudflare's CDN for asset serving
- Content-based hashing for cache busting
- Support for R2 storage for large assets
- Automatic MIME type detection

**Prerequisites:** Story 8.2

---

## Story 8.7: WebSocket Support via Durable Objects

As a **developer**,
I want WebSocket support for real-time features,
So that I can build chat, notifications, and live updates.

**Acceptance Criteria:**

**Given** I need WebSocket connections (FR134)
**When** I define a WebSocket route:
```typescript
// src/routes/ws/chat.ts
import { defineWebSocket } from 'ixflare'

export const websocket = defineWebSocket({
  async onConnect(ws, ctx) {
    const roomId = ctx.params.roomId
    await ctx.durableObject.joinRoom(roomId, ws)
  },

  async onMessage(ws, message, ctx) {
    // Broadcast to room
    await ctx.durableObject.broadcast(message)
  },

  async onClose(ws, ctx) {
    await ctx.durableObject.leaveRoom(ws)
  },
})
```
**Then** WebSocket connections are handled by Durable Objects

**Given** I connect from a client
**When** I use WebSocket helpers (FR156):
```typescript
import { createWebSocket } from 'ixflare/client'

const ws = createWebSocket('/ws/chat/room-123', {
  onMessage: (data) => console.log('Received:', data),
  onReconnect: () => console.log('Reconnected!'),
})

ws.send({ type: 'message', text: 'Hello!' })
```
**Then** the connection is established
**And** auto-reconnection works on disconnect (FR157)

**Given** I need to manage connections
**When** I use the DO API:
```typescript
// In Durable Object
class ChatRoom extends DurableObject {
  connections = new Set<WebSocket>()

  async broadcast(message: unknown) {
    for (const ws of this.connections) {
      ws.send(JSON.stringify(message))
    }
  }
}
```
**Then** I can coordinate across connections

**Technical Notes:**
- Durable Objects for WebSocket coordination
- Automatic reconnection with exponential backoff
- Support for rooms/channels pattern
- Binary and JSON message support

**Prerequisites:** Epic 3 (DO), Epic 2 (routing)

---

## Story 8.8: Response Compression

As a **developer**,
I want automatic response compression,
So that bandwidth is optimized.

**Acceptance Criteria:**

**Given** compression is enabled (default)
**When** a client requests with `Accept-Encoding: gzip, br`:
**Then** responses are compressed:
```
HTTP/1.1 200 OK
Content-Encoding: br
Content-Type: application/json
```

**Given** different compression algorithms
**When** clients support them:
**Then** the best algorithm is chosen:
- Brotli (br) preferred for text content
- Gzip as fallback
- No compression for already-compressed (images, etc.)

**Given** I want to customize compression
**When** I configure it:
```typescript
export default defineConfig({
  compression: {
    enabled: true,
    algorithms: ['br', 'gzip'],
    minSize: 1024,  // Only compress > 1KB
    exclude: ['/api/binary-data'],  // Skip certain paths
  },
})
```
**Then** compression follows my settings

**Technical Notes:**
- Cloudflare handles compression at edge by default
- Framework can pre-compress static assets
- Skip compression for small responses
- Support for streaming compression

**Prerequisites:** Epic 2

---

## Story 8.9: Local D1 Database for Offline Development

As a **developer**,
I want a local D1 database for offline development,
So that I can develop without network connectivity.

**Acceptance Criteria:**

**Given** I start local development (FR173)
**When** I run `ix dev`:
```
Starting dev server...

✓ Local D1 database: .ixflare/d1/local.db
✓ Migrations applied (3 migrations)
✓ Seed data loaded

Ready at http://localhost:3000
```
**Then** a local SQLite database is used

**Given** I make schema changes
**When** migrations run locally:
**Then** they apply to the local database
**And** remote D1 is not affected

**Given** I want to sync with remote
**When** I run `ix db:pull`:
```bash
$ ix db:pull --env production

⚠️ This will overwrite local data with production data.
? Continue? (y/N) y

Pulling from production D1...
✓ Downloaded 156 users
✓ Downloaded 432 posts
✓ Downloaded 89 comments

Local database synced!
```
**Then** production data is copied locally

**Given** I want to push local changes
**When** I run `ix db:push`:
**Then** I'm warned about production impact
**And** can selectively push changes

**Technical Notes:**
- Use SQLite file for local D1
- Miniflare provides D1 simulation
- Support for data import/export
- Selective sync by table

**Prerequisites:** Epic 3, Story 6.1

---

## Story 8.10: Graceful Worker Shutdown

As a **developer**,
I want graceful shutdown handling,
So that in-flight requests complete during deployments.

**Acceptance Criteria:**

**Given** a new deployment starts
**When** the old Worker receives shutdown signal:
```typescript
// Automatic handling by framework
addEventListener('beforeunload', async (event) => {
  // Framework ensures:
  // 1. Stop accepting new requests
  // 2. Wait for in-flight requests (up to 30s)
  // 3. Close database connections
  // 4. Flush logs
})
```
**Then** in-flight requests complete gracefully

**Given** a long-running request is in progress
**When** shutdown is triggered:
**Then** it gets time to complete (up to 30s)
**And** then is terminated with appropriate response

**Given** I need custom shutdown logic
**When** I define a handler:
```typescript
export default defineConfig({
  lifecycle: {
    onShutdown: async () => {
      await flushAnalytics()
      await closeExternalConnections()
    },
  },
})
```
**Then** custom cleanup runs before shutdown

**Technical Notes:**
- Use Workers lifecycle events
- Default 30s grace period
- Log incomplete requests for debugging
- Integration with monitoring for shutdown events

**Prerequisites:** Epic 1

---

**Epic 8 Complete: Deployment & Production**

**Stories Created:** 10
**FR Coverage:** FR69, FR70, FR74, FR103, FR134, FR144, FR156, FR157, FR168, FR173, plus health checks, compression, graceful shutdown
**Technical Context Used:** Wrangler API, Cloudflare CDN, Durable Objects for WebSockets, edge compression
**UX Patterns Incorporated:** First-Time Setup Flow stage 5 (Production Deployment), Metrics Dashboard

---

# Epic 9: Documentation & Onboarding

**Epic Goal:** Enable developers to quickly find answers in comprehensive documentation, complete interactive tutorials, and get help through community channels when stuck.

**FR Coverage:** FR55, FR56, FR57, FR58, FR59, FR60, FR109, FR136, FR137, FR174

---

## Story 9.1: Quick Start Guide

As a **new developer**,
I want a Quick Start guide that gets me deployed in under 5 minutes,
So that I can evaluate Ixflare quickly.

**Acceptance Criteria:**

**Given** I visit the documentation (FR55)
**When** I follow the Quick Start:
```markdown