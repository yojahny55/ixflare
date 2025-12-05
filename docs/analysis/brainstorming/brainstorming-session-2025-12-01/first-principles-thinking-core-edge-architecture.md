# First Principles Thinking: Core Edge Architecture

**Goal:** Strip away assumptions from traditional frameworks to discover authentic edge-first design patterns.

**Method:** Question everything about traditional server frameworks and rebuild from edge computing fundamentals.

---

## Edge Computing Fundamentals (The Foundation)

**Core Truths We Must Accept:**

1. **Ephemeral Execution Environment**
   - Workers run in V8 isolates (not Node.js processes)
   - No persistent memory between requests
   - <1ms cold start requirement
   - CPU time limits (~50ms for free, ~30s for paid)

2. **Globally Distributed by Default**
   - Code runs in 300+ edge locations simultaneously
   - No single "server" - every request hits nearest edge
   - Geographic data (country, city, colo) available on every request
   - User proximity determines which edge handles request

3. **Storage is Multi-Tier and Distributed**
   - KV: Eventually consistent, globally replicated (fast reads)
   - D1: SQLite-based, regional consistency
   - R2: Object storage, globally accessible
   - Durable Objects: Strong consistency, single-region coordination

4. **No Traditional Filesystem**
   - No `fs.readFile()` or `path.join()`
   - Everything must be bundled or fetched from storage
   - Static assets served from Workers or R2

5. **Request/Response Model Only**
   - No long-running processes
   - No background workers (unless Durable Objects)
   - Everything triggered by HTTP requests or scheduled events

---

## 17 Architectural Pillars (First Principles Exploration)

Through First Principles analysis, we identified 17 core architectural decisions:

---

### **PILLAR 1: Cloudflare Integration Philosophy**

**Question:** How should the framework integrate with Cloudflare services?

**Decision:** Service-aware unified API with escape hatches
- Provide unified `services` API for common operations
- Expose underlying Cloudflare APIs when needed
- Convention-based binding configuration
- Integrate WITH wrangler (not replace it)

**Implementation:**
```typescript
// Unified API
await services.get('CACHE', 'user:123')           // KV
await services.get('DB', 'users', { id: 123 })    // D1
await services.query('DB', 'SELECT * FROM...', [params])  // SQL

// Escape hatch to raw Cloudflare APIs
await env.CACHE.get('user:123')  // Direct KV access
await env.DB.prepare('SELECT...').all()  // Direct D1 access
```

---

### **PILLAR 2: Session & Authentication**

**Question:** How to handle sessions in ephemeral, distributed environment?

**Decision:** Hybrid JWT + KV + Durable Objects
- **JWT (HttpOnly cookies):** Minimal claims for instant reads (0ms)
- **KV:** Cached session data for fast reads (5-20ms)
- **Durable Objects:** Authoritative writes for consistency (50-100ms)

**Session Strategy:**
```typescript
// Read priority: JWT → KV → DO
const session = await services.session.get(request)
// 1. Check JWT for instant userId/sessionId
// 2. Check KV for cached full session
// 3. Fallback to DO for authoritative data

// Writes go to DO, async replicate to KV
await services.session.update(sessionId, data)
// → DO write (strong consistency)
// → KV replicate (async, eventual consistency)
```

**Latency Budgeting:**
- JWT reads: 0ms (no network)
- KV reads: P95 < 20ms
- DO writes: P95 < 100ms
- Auto-fallback if budget exceeded

---

### **PILLAR 3: Routing Architecture**

**Question:** File-based or programmatic routing? How to handle edge constraints?

**Decision:** Hybrid convention-based + Worker-native URLPattern
- File structure = routes (build-time discovery)
- HTTP method exports (GET, POST, etc.)
- URLPattern for advanced matching
- Vite for builds (not esbuild - user preference)

**File Structure:**
```
app/
  routes/
    products/
      [id].tsx          # GET /products/:id
      index.tsx         # GET /products
    admin/
      layout.tsx        # Layout wrapper
      dashboard.tsx     # GET /admin/dashboard
```

**Route Definition:**
```typescript
// app/routes/products/[id].tsx
export async function loader({ params, request }) {
  const product = await Product.find(params.id)
  return { product }
}

export default function ProductPage({ product }) {
  return <ProductDetail {...product} />
}

// Advanced routing with URLPattern
export const pattern = new URLPattern({
  pathname: '/products/:id(\\d+)'  // Only numeric IDs
})
```

**Performance Priority:**
1. Performance (#1)
2. Type safety (#2)
3. Developer experience
4. Flexibility

---

### **PILLAR 4: Middleware System**

**Question:** How to compose middleware in edge environment?

**Decision:** Hybrid functional composition with build-time inlining
- Convention-based discovery + explicit decorators
- Zero runtime overhead via build-time optimization
- Type-safe context passing

**Priority Ranking:**
1. Short-circuit (auth fails → stop immediately)
2. Context enrichment (add user to context)
3. Error handling
4. Cross-cutting concerns (logging, metrics)
5. Request transformation
6. Response transformation

**Implementation:**
```typescript
// app/routes/dashboard.tsx
export const middleware = ['auth', 'analytics', 'rateLimit']

// app/middleware/auth.ts
export const auth = defineMiddleware({
  async handle({ request, services }) {
    const session = await services.session.get(request)
    if (!session) return Response.redirect('/login')
    return { session }  // Added to context
  },
  cache: { enabled: true, ttl: 60 }  // Cache auth checks
})

// Framework inlines middleware at build time (zero runtime cost)
```

---

### **PILLAR 5: State Management**

**Question:** How to manage state across ephemeral edge nodes?

**Decision:** Multi-scope state with automatic storage selection

**State Types:**
- **Ephemeral:** Request-scoped (in-memory)
- **Session:** User-scoped (JWT + KV + DO)
- **Cached:** Shared, fast (KV)
- **Persistent:** Long-term (D1 or DO)
- **Realtime:** Live updates (DO WebSockets)
- **Blob:** Large files (R2)

**Unified State API:**
```typescript
await store.set('cart', items, {
  scope: 'session',      // Tied to user session
  consistency: 'strong', // DO for writes
  ttl: 3600,            // 1 hour
  replicate: 3          // Replicate to 3 edges
})

await store.set('product:123', product, {
  scope: 'cache',         // Global cache
  consistency: 'eventual', // KV for speed
  ttl: 300,               // 5 minutes
  staleWhileRevalidate: 60
})
```

**Priority:**
1. Performance (#1)
2. Developer simplicity (#2)
3. Correctness
4. Automatic optimization
5. Flexibility
6. Type safety

---

### **PILLAR 6: Scaffolding & Project Structure**

**Question:** How much should the framework generate vs. developer control?

**Decision:** Minimal but functional starting point with interactive prompts

**Approach:**
- Interactive CLI prompts (not templates)
- Hybrid folder structure (feature-based + layer-based)
- Zero-config for 90%, explicit for 10%
- Focused generators (no full CRUD scaffolds)
- Examples in separate GitHub repo
- Dev-only scaffold first, optional production addon

**Generated Structure:**
```
app/
  routes/              # File-based routing
    layout.tsx
    index.tsx
  api/                 # API endpoints
  models/              # EdgeRecord models
  islands/             # Client components
  middleware/          # Middleware definitions
  lib/                 # Shared utilities

config/
  edge.config.ts       # Optional framework config

db/
  migrations/          # SQL migrations
  seeds/               # Database seeders

public/                # Static assets

tests/                 # Test files
```

**Priority:**
1. Get started fast
2. Learn patterns
3. Flexibility
4. Minimal bloat
5. Production-ready (optional)

---

### **PILLAR 7: Frontend Integration**

**Question:** How to handle frontend in fullstack edge framework?

**Decision:** Framework-agnostic with co-located structure

**Supported Frameworks:** React, Vue, Svelte, Vanilla JS

**File Conventions:**
- `.tsx` = SSR pages
- `.ts` = API routes
- `.client.tsx` = Client islands (hydrated)
- `.server.tsx` = Server-only components

**Structure:**
```
app/
  routes/
    products/
      [id].tsx           # SSR page
    layout.tsx           # Root layout
  islands/
    cart.client.tsx      # Interactive cart
  components/
    product-card.server.tsx  # Server-only
```

---

### **PILLAR 8: Testing Strategy**

**Question:** How to test edge applications?

**Decision:** Multi-layer testing with edge simulation

**Test Levels:**
1. **Unit Tests:** Mock Cloudflare bindings
2. **Integration Tests:** Miniflare (local edge simulation)
3. **E2E Tests:** Playwright with edge context

**Example:**
```typescript
// test/routes/products.test.ts
test('product page renders', async ({ edge }) => {
  const response = await edge.request('/products/123', {
    colo: 'SFO',
    country: 'US',
    session: { userId: 1 }
  })

  expect(response.status).toBe(200)
  expect(edge.kv.get).toHaveBeenCalled()
})
```

---

### **PILLAR 9: Deployment Pipeline**

**Question:** How to deploy to Cloudflare edge?

**Decision:** Multi-environment with integrated CI/CD

**Environments:**
- **Preview:** Auto-deploy on PRs
- **Staging:** Promoted previews with health checks
- **Production:** Canary deployments with auto-rollback

**Pipeline:**
```bash
edge deploy --stage production --health-check --auto-rollback

# 1. Run tests
# 2. Build with Vite
# 3. Upload assets to R2
# 4. Deploy to Workers
# 5. Run health checks
# 6. Monitor error rate
# 7. Auto-rollback if errors > threshold
```

---

### **PILLAR 10: Data Layer & ORM**

**Question:** How to interact with databases at the edge?

**Decision:** EdgeRecord ORM with repository pattern

**Features:**
- Active Record-style syntax (Laravel-inspired)
- Automatic KV caching
- DO-backed writes for consistency
- Query builder with type inference

**Example:**
```typescript
// app/models/user.ts
export class User extends EdgeRecord {
  static table = 'users'

  static cache = {
    enabled: true,
    ttl: 300,
    invalidateOn: ['update', 'delete']
  }

  posts() {
    return this.hasMany(Post, 'userId')
  }
}

// Usage
const user = await User.find(123)  // KV → D1
const posts = await user.posts()   // DO-backed relation
```

---

### **PILLAR 11: Caching Strategy**

**Question:** How to cache in distributed edge environment?

**Decision:** 3-tier cache with tag-based invalidation

**Tiers:**
1. **Edge Cache:** Cloudflare CDN (instant)
2. **KV Cache:** Edge-local storage (5-20ms)
3. **D1 Cache:** Regional database (20-50ms)

**Strategy:**
```typescript
// Request flow:
// 1. Check Edge Cache → instant
// 2. Check KV Cache → 5-20ms
// 3. Check D1 → 20-50ms
// 4. Compute → cache in all tiers

// Tag-based invalidation
await cache.invalidate({ tags: ['product:123', 'category:electronics'] })
```

---

### **PILLAR 12: Rendering Strategy**

**Question:** SSR, CSR, or hybrid?

**Decision:** Multi-mode with islands architecture

**Modes:**
- **SSR:** Server-side rendering at edge
- **Islands:** Partial hydration for interactivity
- **Server Components:** Server-only (no client JS)
- **Streaming SSR:** Progressive rendering

**Example:**
```typescript
// app/routes/products/[id].tsx
export default function ProductPage({ product }) {
  return (
    <>
      {/* SSR - no client JS */}
      <ProductInfo product={product} />

      {/* Island - hydrated on client */}
      <AddToCart productId={product.id} />
    </>
  )
}
```

---

### **PILLAR 13: Jobs & Scheduled Tasks**

**Question:** How to handle background jobs at the edge?

**Decision:** Durable Object-backed job queues

**Features:**
- Cron triggers (scheduled tasks)
- Queue-based jobs
- DO for ordering and retries

**Example:**
```typescript
// app/jobs/send-email.ts
export class SendEmailJob extends Job {
  async handle({ userId, template }) {
    const user = await User.find(userId)
    await services.email.send({ to: user.email, template })
  }

  static config = {
    retries: 3,
    backoff: 'exponential',
    timeout: 30_000
  }
}

// Dispatch
await SendEmailJob.dispatch({ userId: 123, template: 'welcome' })
```

---

### **PILLAR 14: Developer Tools & CLI**

**Question:** What tools make edge development easier?

**Decision:** Comprehensive CLI with 50+ commands

**Command Categories:**
- **Generators:** `edge make:route`, `edge make:model`, etc.
- **Database:** `edge migrate`, `edge seed`, `edge tinker`
- **Cache:** `edge cache:clear`, `edge cache:stats`
- **Deployment:** `edge deploy`, `edge deploy:preview`
- **Development:** `edge dev`, `edge logs`, `edge dashboard`

**Interactive REPL:**
```bash
edge tinker

> await User.find(123)
User { id: 123, name: 'Alice' }

> await services.kv.get('user:123')
{ id: 123, name: 'Alice', email: 'alice@example.com' }
```

---

### **PILLAR 15: Security Model**

**Question:** How to secure edge applications?

**Decision:** Multi-layer security with edge advantages

**Layers:**
1. **Authentication:** JWT + session management
2. **Authorization:** Role-based access control
3. **Input Validation:** Zod schemas (auto-generated)
4. **CSRF Protection:** Token-based
5. **Rate Limiting:** Multi-tier (IP, API key, user)
6. **Security Headers:** Auto-injected
7. **CORS:** Configurable per route
8. **Secrets Management:** Cloudflare secrets
9. **Audit Trail:** Analytics Engine logging

**Example:**
```typescript
export const middleware = ['auth', 'requireRole:admin', 'rateLimit']

export async function POST({ request }) {
  const data = await request.json<CreateUserInput>()
  // Auto-validated with Zod schema

  const user = await User.create(data)
  return Response.json({ user })
}
```

---

### **PILLAR 16: Observability**

**Question:** How to monitor edge applications?

**Decision:** Automatic instrumentation with Analytics Engine

**Components:**
1. **Structured Logging:** Multi-output (console, Analytics Engine)
2. **Metrics:** Counters, gauges, histograms
3. **Distributed Tracing:** OpenTelemetry integration
4. **Real-time Dashboard:** Built-in observability UI
5. **Alerting:** Threshold-based alerts

**Auto-Captured:**
- Request metadata (URL, method, headers)
- Edge context (colo, country, ray ID)
- Performance metrics (duration, CPU time)
- Database queries (count, duration)
- Cache operations (hits, misses)
- Business metrics (conversions, revenue)

---

### **PILLAR 17: Filesystem Conventions**

**Question:** What project structure maximizes productivity?

**Decision:** Convention-over-configuration with clear patterns

**Complete Structure:**
```
project-root/
├── app/
│   ├── routes/              # Pages (SSR)
│   │   ├── layout.tsx
│   │   ├── index.tsx
│   │   └── products/
│   │       ├── [id].tsx
│   │       └── layout.tsx
│   ├── api/                 # API endpoints
│   │   └── products.ts
│   ├── models/              # Data models
│   │   ├── user.ts
│   │   └── product.ts
│   ├── islands/             # Client components
│   │   └── cart.client.tsx
│   ├── components/          # Shared components
│   │   └── button.tsx
│   ├── middleware/          # Middleware
│   │   ├── auth.ts
│   │   └── analytics.ts
│   ├── lib/                 # Utilities
│   │   └── utils.ts
│   └── styles/              # Global styles
│       └── globals.css
├── config/
│   └── edge.config.ts       # Optional config
├── db/
│   ├── migrations/          # SQL migrations
│   └── seeds/               # Seeders
├── public/                  # Static assets
│   ├── favicon.ico
│   └── images/
├── tests/
│   ├── routes/
│   └── models/
├── wrangler.toml            # Cloudflare config
└── package.json
```

**Naming Conventions:**
- `.tsx` = SSR pages or components
- `.ts` = API routes or utilities
- `.client.tsx` = Client islands (hydrated)
- `.server.tsx` = Server-only components
- `layout.tsx` = Route layouts
- `[param].tsx` = Dynamic routes
- `index.tsx` = Index routes

---

## First Principles Summary

**Key Decisions Made:**

1. ✅ **Integration:** Service-aware unified API with escape hatches
2. ✅ **Sessions:** Hybrid JWT + KV + DO with latency budgeting
3. ✅ **Routing:** File-based with Vite builds
4. ✅ **Middleware:** Functional composition with build-time inlining
5. ✅ **State:** Multi-scope with automatic storage selection
6. ✅ **Scaffolding:** Interactive prompts, minimal but functional
7. ✅ **Frontend:** Framework-agnostic, co-located structure
8. ✅ **Testing:** Multi-layer with edge simulation
9. ✅ **Deployment:** Multi-environment with CI/CD
10. ✅ **Data:** EdgeRecord ORM with caching
11. ✅ **Caching:** 3-tier with tag-based invalidation
12. ✅ **Rendering:** Multi-mode with islands
13. ✅ **Jobs:** DO-backed queues
14. ✅ **CLI:** 50+ commands with REPL
15. ✅ **Security:** Multi-layer with edge advantages
16. ✅ **Observability:** Automatic instrumentation
17. ✅ **Structure:** Convention-based filesystem

**Core Philosophy:** Build authentically for edge computing, don't adapt traditional server patterns. Every decision prioritizes edge-native advantages: distribution, performance, and developer experience.

---
