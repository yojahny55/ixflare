# Epic 2: Core Runtime & Routing

**Epic Goal:** Enable developers to define type-safe routes using file-based conventions, handle HTTP requests with proper method handlers, and compose middleware chains for request processing.

**FR Coverage:** FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR30, FR31, FR32, FR33, FR34, FR35, FR116, FR117, FR118, FR119, FR128, FR160, FR161, FR162, FR171

---

## Story 2.1: File-Based Route Discovery

As a **developer**,
I want routes to be automatically discovered from my file structure,
So that I don't need to manually register routes.

**Acceptance Criteria:**

**Given** I create a file at `src/routes/index.tsx`
**When** the dev server starts
**Then** it is registered as the `/` route (FR13)

**Given** I create files with the following structure:
```
src/routes/
├── index.tsx           # /
├── about.tsx           # /about
├── blog/
│   ├── index.tsx       # /blog
│   └── [slug].tsx      # /blog/:slug
└── api/
    └── v1/
        └── users.ts    # /api/v1/users
```
**When** the dev server starts
**Then** all routes are discovered and registered automatically (FR8)
**And** the route manifest is generated at build time

**Given** two files would create the same route (e.g., `about.tsx` and `about/index.tsx`)
**When** the dev server starts
**Then** a clear error is shown explaining the conflict (FR14):
```
❌ Route conflict detected!

Both files resolve to /about:
  • src/routes/about.tsx
  • src/routes/about/index.tsx

Solution: Remove one of these files.
```

**Technical Notes:**
- Implement in `packages/vite-plugin-ixflare/src/router-codegen.ts`
- Generate route manifest during Vite build
- Use chokidar for file watching in development
- Route conventions follow Next.js/Remix patterns

**Prerequisites:** Epic 1 complete

---

## Story 2.2: Dynamic Route Parameters

As a **developer**,
I want to define dynamic route segments with type-safe parameters,
So that I can build dynamic pages with validated inputs.

**Acceptance Criteria:**

**Given** I create a file `src/routes/users/[userId].tsx`
**When** a request comes to `/users/123`
**Then** the route handler receives `params.userId` with value `"123"` (FR10)

**Given** I define a route with multiple parameters `src/routes/[org]/[repo]/issues/[id].tsx`
**When** a request comes to `/acme/widgets/issues/42`
**Then** I receive all parameters:
```typescript
export async function loader({ params }: LoaderArgs) {
  // params is typed: { org: string, repo: string, id: string }
  const { org, repo, id } = params
  // org = "acme", repo = "widgets", id = "42"
}
```

**Given** I want to validate route parameters
**When** I export a `params` schema:
```typescript
import { z } from 'zod'

export const params = z.object({
  userId: z.coerce.number().positive(),
})

export async function loader({ params }: LoaderArgs) {
  // params.userId is now a number, validated
}
```
**Then** invalid parameters return 400 with validation error
**And** valid parameters are coerced to the correct types

**Given** I create a catch-all route `src/routes/docs/[...path].tsx`
**When** a request comes to `/docs/guides/routing/basics`
**Then** `params.path` equals `["guides", "routing", "basics"]`

**Technical Notes:**
- Use Zod for parameter validation (Architecture: Validation)
- Square bracket convention for dynamic segments
- Spread syntax `[...param]` for catch-all routes
- TypeScript inference for params type

**Prerequisites:** Story 2.1

---

## Story 2.3: Nested Route Layouts

As a **developer**,
I want to define nested layouts that wrap child routes,
So that I can share UI structure across related pages.

**Acceptance Criteria:**

**Given** I create a layout file `src/routes/dashboard/_layout.tsx`:
```typescript
export default function DashboardLayout({ children }: LayoutProps) {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>{children}</main>
    </div>
  )
}
```
**When** I navigate to `/dashboard/settings`
**Then** the `DashboardLayout` wraps the settings page content (FR9)

**Given** I have nested layouts:
```
src/routes/
├── _layout.tsx           # Root layout (all pages)
├── dashboard/
│   ├── _layout.tsx       # Dashboard layout
│   ├── index.tsx         # /dashboard
│   └── settings/
│       ├── _layout.tsx   # Settings layout
│       └── profile.tsx   # /dashboard/settings/profile
```
**When** I navigate to `/dashboard/settings/profile`
**Then** layouts are nested: Root → Dashboard → Settings → Profile

**Given** a layout exports a `loader` function
**When** the page loads
**Then** layout data is fetched and available via context:
```typescript
// _layout.tsx
export async function loader() {
  return { user: await getCurrentUser() }
}

export default function Layout({ children, data }: LayoutProps) {
  // data.user is available
}
```

**Technical Notes:**
- `_layout.tsx` convention for layout files (underscore prefix)
- Layouts receive `children` prop for nested content
- Layout loaders run in parallel with page loaders
- React context for sharing layout data to children

**Prerequisites:** Story 2.1

---

## Story 2.4: HTTP Method Handlers

As a **developer**,
I want to define handlers for different HTTP methods,
So that I can build RESTful API endpoints.

**Acceptance Criteria:**

**Given** I create an API route `src/routes/api/users.ts`:
```typescript
import type { RouteHandler } from 'ixflare'

// GET /api/users
export const GET: RouteHandler = async ({ request }) => {
  const users = await User.all()
  return Response.json(users)
}

// POST /api/users
export const POST: RouteHandler = async ({ request }) => {
  const data = await request.json()
  const user = await User.create(data)
  return Response.json(user, { status: 201 })
}
```
**When** a GET request comes to `/api/users`
**Then** the `GET` handler is called (FR11)
**And** a POST request calls the `POST` handler

**Given** I define handlers for all methods:
```typescript
export const GET: RouteHandler = async (ctx) => { /* ... */ }
export const POST: RouteHandler = async (ctx) => { /* ... */ }
export const PUT: RouteHandler = async (ctx) => { /* ... */ }
export const DELETE: RouteHandler = async (ctx) => { /* ... */ }
export const PATCH: RouteHandler = async (ctx) => { /* ... */ }
```
**Then** each handler responds to its respective HTTP method

**Given** a request uses an undefined method (e.g., OPTIONS on a route with only GET)
**When** the request is processed
**Then** a 405 Method Not Allowed response is returned
**And** the `Allow` header lists supported methods

**Technical Notes:**
- Named exports for HTTP methods (uppercase)
- `RouteHandler` type provides full context typing
- Auto-generate OPTIONS response with allowed methods
- HEAD requests automatically handled for GET routes

**Prerequisites:** Story 2.1

---

## Story 2.5: Route Loaders for Data Fetching

As a **developer**,
I want to fetch data before rendering pages,
So that I can server-render pages with data.

**Acceptance Criteria:**

**Given** I define a loader in a page route:
```typescript
// src/routes/users/[userId].tsx
export async function loader({ params, env }: LoaderArgs) {
  const user = await User.find(params.userId)
  if (!user) {
    throw new NotFoundError('User not found')
  }
  return { user }
}

export default function UserPage({ data }: PageProps) {
  // data.user is typed and available
  return <h1>{data.user.name}</h1>
}
```
**When** the page is requested
**Then** the loader runs first and provides data to the component (FR12)

**Given** a loader throws an error
**When** the error is a typed error (NotFoundError, AuthError, etc.)
**Then** the appropriate HTTP response is returned (404, 401, etc.)

**Given** multiple loaders need to run (layout + page)
**When** the page is requested
**Then** loaders run in parallel for performance
**And** data is available in the correct scope (layout data vs page data)

**Given** I need to redirect from a loader
**When** I return a redirect:
```typescript
export async function loader({ request }: LoaderArgs) {
  const user = await getCurrentUser(request)
  if (!user) {
    return redirect('/login')
  }
  return { user }
}
```
**Then** the client receives a redirect response

**Technical Notes:**
- Loaders run on the server (edge) only
- Loader return type inferred for component props
- Parallel execution of independent loaders
- Built-in redirect helper function

**Prerequisites:** Story 2.4

---

## Story 2.6: Request Body Parsing

As a **developer**,
I want automatic request body parsing with content-type detection,
So that I can easily access submitted data.

**Acceptance Criteria:**

**Given** a POST request with `Content-Type: application/json`
**When** I access the body:
```typescript
export const POST: RouteHandler = async ({ request }) => {
  const data = await request.json()
  // data is parsed JSON object
}
```
**Then** the JSON body is automatically parsed (FR116)

**Given** a POST request with `Content-Type: application/x-www-form-urlencoded`
**When** I access the body:
```typescript
const formData = await request.formData()
const email = formData.get('email')
```
**Then** form data is parsed correctly

**Given** a POST request with `Content-Type: multipart/form-data`
**When** I access files:
```typescript
const formData = await request.formData()
const file = formData.get('avatar') as File
const buffer = await file.arrayBuffer()
```
**Then** file uploads are accessible

**Given** I want type-safe body parsing with validation
**When** I use a schema:
```typescript
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})

export const POST: RouteHandler = async ({ request }) => {
  const body = await request.json()
  const data = createUserSchema.parse(body)
  // data is typed: { email: string, name: string }
}
```
**Then** invalid bodies return 422 with validation errors

**Technical Notes:**
- Use standard Web APIs (Request.json(), Request.formData())
- Zod for schema validation (Architecture: Validation)
- ValidationError for invalid bodies
- Cloudflare Workers file size limits apply

**Prerequisites:** Story 2.4

---

## Story 2.7: Response Helpers & Typed Responses

As a **developer**,
I want helper functions for common response types,
So that I can return properly formatted responses easily.

**Acceptance Criteria:**

**Given** I need to return JSON:
```typescript
export const GET: RouteHandler = async () => {
  const users = await User.all()
  return Response.json(users) // Standard Web API
}
```
**Then** the response has `Content-Type: application/json` (FR117)
**And** camelCase field names in response (Architecture: JSON Field Naming)

**Given** I need to return HTML:
```typescript
import { html } from 'ixflare'

export const GET: RouteHandler = async () => {
  return html`<h1>Hello World</h1>`
}
```
**Then** the response has `Content-Type: text/html`

**Given** I need to stream a response:
```typescript
import { stream } from 'ixflare'

export const GET: RouteHandler = async () => {
  return stream(async function* () {
    yield 'Starting...\n'
    for await (const chunk of processData()) {
      yield chunk
    }
    yield 'Done!\n'
  })
}
```
**Then** the response is streamed progressively (FR117)

**Given** I need to set custom headers (FR118):
```typescript
export const GET: RouteHandler = async () => {
  return Response.json(data, {
    headers: {
      'X-Custom-Header': 'value',
      'Cache-Control': 'max-age=3600',
    },
  })
}
```
**Then** custom headers are included in the response

**Technical Notes:**
- Use standard Response API where possible
- `html` template literal for HTML responses
- `stream` helper for async generator streaming
- Auto-transform snake_case DB fields to camelCase in JSON

**Prerequisites:** Story 2.4

---

## Story 2.8: Query Parameter Parsing

As a **developer**,
I want type-safe query parameter parsing,
So that I can safely use URL parameters in my handlers.

**Acceptance Criteria:**

**Given** a request to `/api/users?page=2&limit=10&sort=name`
**When** I access query parameters (FR119):
```typescript
export const GET: RouteHandler = async ({ request }) => {
  const url = new URL(request.url)
  const page = url.searchParams.get('page') // string | null
  const limit = url.searchParams.get('limit')
}
```
**Then** I can access query parameters using standard URL API

**Given** I want validated query parameters:
```typescript
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['name', 'createdAt', 'email']).optional(),
})

export const GET: RouteHandler = async ({ request }) => {
  const query = parseQuery(request, querySchema)
  // query is typed: { page: number, limit: number, sort?: 'name' | 'createdAt' | 'email' }
}
```
**Then** query parameters are validated and coerced to correct types
**And** invalid parameters return 400 with validation error

**Given** a query parameter has multiple values `/api/tags?id=1&id=2&id=3`
**When** I access it:
```typescript
const ids = url.searchParams.getAll('id') // ['1', '2', '3']
```
**Then** I get an array of values

**Technical Notes:**
- `parseQuery` helper for schema-based validation
- Use standard URLSearchParams API
- Coercion for numbers, booleans from string values
- Default values in schema

**Prerequisites:** Story 2.4

---

## Story 2.9: Middleware Composition

As a **developer**,
I want to define reusable middleware functions,
So that I can share logic across routes.

**Acceptance Criteria:**

**Given** I define a middleware function:
```typescript
// src/middleware/auth.ts
import type { Middleware } from 'ixflare'

export const requireAuth: Middleware = async (ctx, next) => {
  const token = ctx.request.headers.get('Authorization')
  if (!token) {
    throw new AuthError('UNAUTHORIZED', 'Missing authorization header')
  }

  const user = await verifyToken(token)
  ctx.user = user // Add to context

  return next() // Continue to next middleware/handler
}
```
**When** I apply it to a route (FR30):
```typescript
// src/routes/api/me.ts
export const middleware = [requireAuth]

export const GET: RouteHandler = async ({ user }) => {
  // user is available from middleware context
  return Response.json(user)
}
```
**Then** the middleware runs before the handler
**And** context is typed with user property (FR33)

**Given** I want to compose multiple middleware (FR31):
```typescript
export const middleware = [
  requireAuth,
  requireRole('admin'),
  rateLimit({ max: 100, window: '1m' }),
]
```
**Then** middleware runs in order (left to right)
**And** each can modify context or short-circuit the chain

**Given** middleware needs to run after the handler:
```typescript
export const timing: Middleware = async (ctx, next) => {
  const start = Date.now()
  const response = await next()
  const duration = Date.now() - start
  response.headers.set('X-Response-Time', `${duration}ms`)
  return response
}
```
**Then** post-processing logic runs after the handler returns

**Technical Notes:**
- Middleware signature: `(ctx, next) => Promise<Response>`
- Context is mutable for adding data
- Use TypeScript module augmentation for context typing
- Error boundaries catch middleware errors (FR35)

**Prerequisites:** Story 2.4

---

## Story 2.10: Global & Route-Group Middleware

As a **developer**,
I want to apply middleware globally or to groups of routes,
So that I don't repeat middleware configuration.

**Acceptance Criteria:**

**Given** I define global middleware in `edge.config.ts`:
```typescript
export default defineConfig({
  middleware: [
    logging(),
    cors({ origin: '*' }),
    securityHeaders(),
  ],
})
```
**When** any route is accessed
**Then** global middleware runs first (FR32)

**Given** I create a middleware file in a route directory `src/routes/api/_middleware.ts`:
```typescript
// Applies to all routes under /api/*
export const middleware = [requireAuth, rateLimit()]
```
**When** any route under `/api/` is accessed
**Then** this middleware runs (after global, before route-specific)

**Given** I want to apply middleware to individual routes (FR171):
```typescript
// src/routes/admin/users.ts
export const middleware = [requireRole('admin')]
```
**Then** this middleware only applies to this specific route

**Given** the middleware chain is:
1. Global middleware (edge.config.ts)
2. Route-group middleware (_middleware.ts files, nested)
3. Route-specific middleware (route file exports)
**When** a request is processed
**Then** middleware runs in this exact order

**Technical Notes:**
- `_middleware.ts` convention for directory-level middleware
- Middleware inherits down the route tree
- Can opt-out of parent middleware if needed
- Clear debugging output for middleware chain in dev mode

**Prerequisites:** Story 2.9

---

## Story 2.11: Built-in Rate Limiting

As a **developer**,
I want built-in rate limiting for my API routes,
So that I can protect against abuse without external services.

**Acceptance Criteria:**

**Given** I configure rate limiting on a route:
```typescript
import { rateLimit } from 'ixflare'

export const middleware = [
  rateLimit({
    max: 100,           // Max requests
    window: '15m',      // Time window
    keyBy: 'ip',        // Rate limit key (ip, user, apiKey)
  }),
]
```
**When** a client exceeds 100 requests in 15 minutes
**Then** they receive 429 Too Many Requests (FR162)
**And** the response includes `Retry-After` header

**Given** I want different strategies (FR160):
```typescript
// By IP address (default)
rateLimit({ max: 100, window: '1m', keyBy: 'ip' })

// By authenticated user
rateLimit({ max: 1000, window: '1h', keyBy: 'user' })

// By API key
rateLimit({ max: 10000, window: '1d', keyBy: 'apiKey' })

// Custom key function
rateLimit({
  max: 50,
  window: '1m',
  keyBy: (ctx) => ctx.request.headers.get('X-Tenant-ID'),
})
```
**Then** rate limits are tracked per the specified key

**Given** I want configurable thresholds (FR161):
```typescript
rateLimit({
  max: 100,
  window: '15m',
  // Sliding window for smoother rate limiting
  algorithm: 'sliding-window',
  // Custom response
  onLimit: (ctx) => Response.json(
    { error: 'Rate limit exceeded', retryAfter: 60 },
    { status: 429 }
  ),
})
```
**Then** the rate limiter uses the specified algorithm
**And** custom responses are returned when limited

**Technical Notes:**
- Use KV for distributed rate limit counters (FR128)
- Implement sliding window algorithm for accuracy
- Include rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Edge-native: works across all Cloudflare locations

**Prerequisites:** Story 2.9

---

## Story 2.12: Request/Response Transformation

As a **developer**,
I want to transform requests and responses in middleware,
So that I can implement cross-cutting concerns like logging and compression.

**Acceptance Criteria:**

**Given** I want to log all requests:
```typescript
export const logging: Middleware = async (ctx, next) => {
  const { request } = ctx
  console.log(`→ ${request.method} ${new URL(request.url).pathname}`)

  const response = await next()

  console.log(`← ${response.status} (${Date.now() - ctx.startTime}ms)`)
  return response
}
```
**When** requests are processed (FR34)
**Then** request and response details are logged

**Given** I want to transform request headers:
```typescript
export const addRequestId: Middleware = async (ctx, next) => {
  const requestId = crypto.randomUUID()
  ctx.request.headers.set('X-Request-ID', requestId)
  ctx.requestId = requestId

  const response = await next()
  response.headers.set('X-Request-ID', requestId)
  return response
}
```
**Then** headers are modified on both request and response

**Given** I want to handle errors globally:
```typescript
export const errorHandler: Middleware = async (ctx, next) => {
  try {
    return await next()
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json({
        error: {
          code: error.code,
          message: error.message,
          status: error.status,
        },
      }, { status: error.status })
    }
    // Unexpected error
    console.error(error)
    return Response.json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    }, { status: 500 })
  }
}
```
**Then** all errors are caught and formatted consistently (FR35)

**Technical Notes:**
- Middleware can modify request before passing to next
- Middleware can modify response after receiving from next
- Error boundaries should be early in the chain
- Clone requests/responses if needed for multiple reads

**Prerequisites:** Story 2.9

---

**Epic 2 Complete: Core Runtime & Routing**

**Stories Created:** 12
**FR Coverage:** FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR30, FR31, FR32, FR33, FR34, FR35, FR116, FR117, FR118, FR119, FR128, FR160, FR161, FR162, FR171
**Technical Context Used:** File-based routing, Vite plugin for route codegen, middleware composition, rate limiting with KV
**UX Patterns Incorporated:** Clear error messages for route conflicts, First-Time Setup Flow stage 3 (Local Development)

---
