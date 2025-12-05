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
  hmr?: boolean      // Default: true
  ssr?: boolean      // Default: false
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
import { useLayoutData } from 'ixflare'

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

Export named functions for HTTP methods:

```typescript
// src/routes/api/users.ts

export async function GET(ctx: RouteContext) {
  const users = await db.users.findMany()
  return Response.json(users)
}

export async function POST(ctx: RouteContext) {
  const data = await ctx.request.json()
  const user = await db.users.create(data)
  return Response.json(user, { status: 201 })
}
```

Supported methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`

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
  active: z.string().transform(v => v === 'true' || v === '1'),

  // Enums
  sort: z.enum(['asc', 'desc']).default('asc'),

  // String formats
  slug: z.string().regex(/^[a-z0-9-]+$/i).min(1).max(100),
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
  path: string          // /blog/:slug
  file: string          // blog/[slug].tsx
  params: RouteParam[]  // [{ name: 'slug', type: 'dynamic' }]
  handlers: HttpMethod[] // ['GET', 'POST']
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

### File Watching

The plugin automatically watches for route file changes:
- **File added** → Route manifest regenerated
- **File modified** → Manifest updated if handlers changed
- **File deleted** → Route removed from manifest
- **File renamed** → Treated as delete + add

### Hot Module Replacement

Route changes trigger HMR updates automatically. No manual refresh needed.

## Architecture Notes

### Plugin Composition

This plugin focuses solely on **file-based routing**. Workers runtime features (D1, KV, R2, Durable Objects) are provided by `@cloudflare/vite-plugin`.

See: [ADR-001: Cloudflare Vite Plugin Integration](../../docs/architecture/adr-001-cloudflare-vite-plugin-integration.md)

### Zero Runtime Dependencies

This is a build-time plugin (`@node-only`). It has no runtime dependencies and does not add to your Workers bundle size.

## License

MIT
