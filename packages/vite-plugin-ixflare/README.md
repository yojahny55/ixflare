# vite-plugin-ixflare

File-based routing Vite plugin for Cloudflare Workers applications.

## Features

- **File-based routing** - Automatically discover routes from your file structure
- **Dynamic parameters** - Support for `[param]` and `[...catchAll]` routes
- **Hot Module Replacement (HMR)** - Instant route updates during development
- **Route conflict detection** - Clear error messages for conflicting routes
- **Virtual module** - Access route manifest via `virtual:ixflare-routes`
- **TypeScript-first** - Full type safety with TypeScript

## Installation

```bash
pnpm add vite-plugin-ixflare
```

## Usage

### Basic Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { ixflarePlugin } from 'vite-plugin-ixflare'

export default defineConfig({
  plugins: [
    cloudflare(), // Cloudflare Workers runtime
    ixflarePlugin(), // File-based routing
  ],
})
```

### Plugin Options

```typescript
interface IxflarePluginOptions {
  routesDir?: string // Default: 'src/routes'
  hmr?: boolean // Default: true
  ssr?: boolean // Default: false
}
```

## File-Based Routing Conventions

### Static Routes

Create files in `src/routes/` to define routes:

```
src/routes/
├── index.tsx           → /
├── about.tsx           → /about
└── contact.tsx         → /contact
```

### Nested Routes

Use folders to create nested routes:

```
src/routes/
├── blog/
│   ├── index.tsx       → /blog
│   └── archive.tsx     → /blog/archive
└── api/
    └── v1/
        └── users.ts    → /api/v1/users
```

### Dynamic Parameters

Use `[param]` syntax for dynamic route segments:

```
src/routes/
├── users/
│   ├── [id].tsx        → /users/:id
│   └── [id]/
│       └── posts.tsx   → /users/:id/posts
└── blog/
    └── [slug].tsx      → /blog/:slug
```

### Catch-All Routes

Use `[...param]` syntax for catch-all segments:

```
src/routes/
└── docs/
    └── [...path].tsx   → /docs/*
```

### Index Files

`index.tsx` files map to the directory path:

```
src/routes/
└── blog/
    ├── index.tsx       → /blog (NOT /blog/index)
    └── [slug].tsx      → /blog/:slug
```

### Nested Layouts

Use `_layout.tsx` files to wrap routes in your directory structure:

```
src/routes/
├── _layout.tsx              → Root layout (wraps all routes)
├── index.tsx                → / (wrapped by root layout)
├── dashboard/
│   ├── _layout.tsx          → Dashboard layout
│   ├── index.tsx            → /dashboard (wrapped by root + dashboard)
│   └── settings/
│       ├── _layout.tsx      → Settings layout
│       └── profile.tsx      → /dashboard/settings/profile (all 3 layouts)
```

**Layout Component:**

```typescript
// src/routes/dashboard/_layout.tsx
import type { LayoutProps } from 'ixflare'

export default function DashboardLayout({ children }: LayoutProps) {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>{children}</main>
    </div>
  )
}
```

**Layout with Loader (Data Fetching):**

```typescript
// src/routes/dashboard/_layout.tsx
import type { LayoutProps, LayoutLoaderArgs } from 'ixflare'

// Loader runs in parallel with page loader for optimal performance
export async function loader({ env }: LayoutLoaderArgs) {
  const user = await getCurrentUser(env)
  return { user, theme: 'dark' }
}

export default function DashboardLayout({
  children,
  data
}: LayoutProps<Awaited<ReturnType<typeof loader>>>) {
  return (
    <div data-theme={data.theme}>
      <header>Welcome, {data.user.name}</header>
      {children}
    </div>
  )
}
```

**Accessing Layout Data in Child Components:**

```typescript
// Any child page/component can access parent layout data
// Note: Import from 'ixflare/ssr' to avoid React dependency in API-only apps
import { useLayoutData } from 'ixflare/ssr'

function ProfilePage() {
  const { user, theme } = useLayoutData<{ user: User; theme: string }>()
  return <div>Current theme: {theme}</div>
}
```

**Key Features:**

- Layouts nest from outermost (root) to innermost
- Layout loaders execute in **parallel** with page loaders for performance
- Layouts preserve state during navigation (no unnecessary re-renders)
- Deep nesting supported (5+ levels)

### Ignored Files

Files starting with `_` are ignored and not treated as routes:

```
src/routes/
├── _layout.tsx         → Layout component (wraps routes)
├── _middleware.ts      → Middleware (not a route)
└── index.tsx           → / (route)
```

## HTTP Method Handlers

Define handlers for different HTTP methods in the same route file:

### Function Export Pattern

```typescript
// src/routes/api/users.ts
import type { EdgeContext } from 'ixflare'

export async function GET(ctx: EdgeContext) {
  const users = await db.users.findMany()
  return Response.json(users)
}

export async function POST(ctx: EdgeContext) {
  const data = await ctx.request.json()
  const user = await db.users.create(data)
  return Response.json(user, { status: 201 })
}

export async function DELETE(ctx: EdgeContext) {
  const { id } = await ctx.request.json()
  await db.users.delete(id)
  return new Response(null, { status: 204 })
}
```

### Const Export Pattern (Alternative)

```typescript
// src/routes/api/posts.ts
import type { RouteHandler } from 'ixflare'

export const GET: RouteHandler = async (ctx) => {
  const posts = await db.posts.findMany()
  return Response.json(posts)
}

export const POST: RouteHandler = async (ctx) => {
  const data = await ctx.request.json()
  const post = await db.posts.create(data)
  return Response.json(post, { status: 201 })
}
```

### Supported Methods

- `GET` - Retrieve resources
- `POST` - Create resources
- `PUT` - Replace resources
- `PATCH` - Partially update resources
- `DELETE` - Remove resources
- `HEAD` - Auto-generated from GET (returns headers only)
- `OPTIONS` - Auto-generated (returns allowed methods)

### Automatic HEAD and OPTIONS

If you define a `GET` handler, a `HEAD` handler is automatically generated that returns the same headers but with an empty body.

An `OPTIONS` handler is also auto-generated for all routes, returning a 204 status with an `Allow` header listing all supported methods.

### 405 Method Not Allowed

If a request uses an unsupported method, the router automatically returns a 405 response with:

- Proper error JSON body
- `Allow` header listing supported methods
- RFC 9110 compliant response format

```json
{
  "error": {
    "code": "ROUTING.METHOD_NOT_ALLOWED",
    "message": "Method DELETE not allowed. Allowed: GET, HEAD, OPTIONS, POST",
    "status": 405,
    "timestamp": 1733400000000
  }
}
```

## Parameter Validation

### Type-Safe Parameters with Zod

Validate and coerce route parameters using Zod schemas:

```typescript
// src/routes/users/[userId].tsx
import { z } from 'zod'
import type { LoaderArgs } from 'ixflare'

// Export params schema for validation
export const params = z.object({
  userId: z.coerce.number().int().positive(),
})

// TypeScript automatically infers params type from schema
export async function GET({ params }: LoaderArgs<z.infer<typeof params>>) {
  // params.userId is typed as number (not string!)
  const user = await db.users.findById(params.userId)
  return Response.json(user)
}
```

### Multiple Parameters

```typescript
// src/routes/[org]/[repo]/issues/[id].tsx
import { z } from 'zod'

export const params = z.object({
  org: z.string().regex(/^[a-z0-9-]+$/i),
  repo: z.string().regex(/^[a-z0-9-]+$/i),
  id: z.coerce.number().int().positive(),
})

export async function GET({ params }: LoaderArgs<z.infer<typeof params>>) {
  const { org, repo, id } = params // All typed correctly
  return Response.json({ org, repo, issueId: id })
}
```

### Catch-All with Validation

```typescript
// src/routes/docs/[...path].tsx
import { z } from 'zod'

export const params = z.object({
  path: z.array(z.string().min(1)), // Validates each segment
})

export async function GET({ params }: LoaderArgs<z.infer<typeof params>>) {
  // params.path is string[] (e.g., ['guides', 'routing', 'basics'])
  const docPath = params.path.join('/')
  return Response.json({ path: docPath })
}
```

### URL Param Coercion

Since all URL params arrive as strings, use `z.coerce` for type conversion:

```typescript
export const params = z.object({
  // Numbers
  userId: z.coerce.number().int().positive(),
  price: z.coerce.number().min(0),

  // Booleans (use custom transform)
  active: z.string().transform((v) => v === 'true' || v === '1'),

  // Enums
  sort: z.enum(['asc', 'desc']).default('asc'),

  // String formats
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/i)
    .min(1)
    .max(100),
})
```

### Error Handling

Invalid parameters automatically return `400 Bad Request` with validation errors:

```typescript
// Request: /users/invalid
// Response: 400 Bad Request
{
  "error": {
    "code": "VALIDATION.INVALID_PARAMS",
    "message": "Parameter validation failed",
    "status": 400,
    "details": {
      "userId": ["Expected number, received string"]
    }
  }
}
```

## Virtual Module

Access the route manifest in your application:

```typescript
import manifest from 'virtual:ixflare-routes'

console.log(manifest.routes) // Array of Route objects
console.log(manifest.version) // "1.0.0"
console.log(manifest.generatedAt) // Unix timestamp
```

### Route Manifest Type

```typescript
interface RouteManifest {
  routes: Route[]
  generatedAt: number
  version: string
}

interface Route {
  path: string // /blog/:slug
  file: string // blog/[slug].tsx
  params: RouteParam[] // [{ name: 'slug', type: 'dynamic' }]
  handlers: HttpMethod[] // ['GET', 'POST']
  hasParamsSchema?: boolean // True if route exports 'params' Zod schema
  layoutChain?: string[] // Layout files from root to innermost (e.g., ['_layout.tsx', 'dashboard/_layout.tsx'])
  layoutHasLoader?: boolean[] // True for each layout that exports a loader function
}

interface RouteParam {
  name: string
  type: 'static' | 'dynamic' | 'catch-all'
}
```

## Route Conflict Detection

The plugin detects conflicting routes and provides clear error messages:

```
Route conflict detected!

Both files resolve to /about:
  • about.tsx
  • about/index.tsx

Solution: Remove one of these files.
```

### Common Conflicts

❌ **Conflict:** Both resolve to `/about`

```
src/routes/
├── about.tsx
└── about/
    └── index.tsx
```

✅ **No conflict:** Different routes

```
src/routes/
├── about.tsx           → /about
└── about/
    └── team.tsx        → /about/team
```

❌ **Conflict:** Both resolve to `/blog/:param`

```
src/routes/blog/
├── [id].tsx
└── [slug].tsx
```

## File Extensions

Supported extensions (in order of precedence):

- `.tsx` - TypeScript + JSX (SSR pages)
- `.ts` - TypeScript (API routes)
- `.jsx` - JavaScript + JSX
- `.js` - JavaScript

## Development

### Local Development Server

Start the development server with instant HMR:

```bash
ix dev
```

The dev server uses Vite with `@cloudflare/vite-plugin` for Workers runtime simulation and provides:

- **Frontend HMR (<200ms target)** - React components update with state preservation via Fast Refresh
- **Server-side HMR** - Route handlers reload automatically
- **Route manifest updates** - New routes are immediately accessible
- **Cloudflare bindings** - D1, KV, R2, Durable Objects work locally via wrangler.toml

### File Watching

The plugin automatically watches for route file changes:

- **File added** → Route manifest regenerated
- **File modified** → Manifest updated if handlers changed
- **File deleted** → Route removed from manifest
- **File renamed** → Treated as delete + add

### Hot Module Replacement (HMR)

Three types of HMR updates:

1. **Frontend Islands (.client.tsx)** - React Fast Refresh handles component updates with state preservation
2. **Server Components (routes/\*.tsx)** - Custom `ixflare:server-update` event swaps HTML while preserving island state
3. **Route Manifest** - Virtual module invalidation for new/deleted routes

**HMR Performance Monitoring:**

The plugin logs HMR update timing:

```
[ixflare] island updated: counter.client.tsx (state preserved) (45ms)
[ixflare] server-component updated: dashboard.tsx (route: /dashboard) (68ms)
⚠️ [ixflare] route updated: heavy-page.tsx (1250ms) ⚠️ Slow HMR update
```

HMR updates exceeding 1000ms trigger a performance warning.

### Cloudflare Bindings Configuration

Configure D1, KV, R2, and Durable Objects in `wrangler.toml`:

```toml
name = "my-app"
main = "./src/index.ts"
compatibility_date = "2025-01-01"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "my-app-db"
database_id = "local"  # Use "local" for local dev, or real ID for remote bindings

# KV Namespace
[[kv_namespaces]]
binding = "KV_CACHE"
id = "local"  # Use "local" for local dev

# R2 Bucket
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "my-app-storage"

# Durable Objects (advanced)
[[durable_objects.bindings]]
name = "COUNTER"
class_name = "Counter"
script_name = "my-app"
```

**Remote Bindings (GA September 2025):**

Connect to deployed resources during local development by using real IDs instead of "local":

```toml
[[d1_databases]]
binding = "DB"
database_name = "my-app-prod-db"
database_id = "a1b2c3d4-5678-90ab-cdef-1234567890ab"  # Real Cloudflare DB ID
```

**Accessing Bindings in Code:**

```typescript
// src/routes/api/users.ts
import type { EdgeContext } from 'ixflare'

export async function GET({ env }: EdgeContext) {
  // D1 Database
  const users = await env.DB.prepare('SELECT * FROM users').all()

  // KV Cache
  const cached = await env.KV_CACHE.get('user-list')

  // R2 Storage
  const avatar = await env.STORAGE.get('avatars/user-1.jpg')

  return Response.json({ users: users.results })
}
```

**Local Persistence:**

Data persists between dev server restarts in `.wrangler/state/` directory. To reset local data, delete this directory.

## Architecture Notes

### Plugin Composition

This plugin focuses solely on **file-based routing**. Workers runtime features (D1, KV, R2, Durable Objects) are provided by `@cloudflare/vite-plugin`.

See: [ADR-001: Cloudflare Vite Plugin Integration](../../docs/architecture/adr-001-cloudflare-vite-plugin-integration.md)

### Zero Runtime Dependencies

This is a build-time plugin (`@node-only`). It has no runtime dependencies and does not add to your Workers bundle size.

## License

MIT
