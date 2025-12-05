# Epic 4: Server-Side Rendering & Frontend

**Epic Goal:** Enable developers to build React applications that render on the edge with streaming HTML, selective hydration for interactivity, and optimized client bundles.

**FR Coverage:** FR24, FR25, FR26, FR27, FR28, FR29, FR105, FR153, FR154, FR155, FR158, FR159

---

## Story 4.1: React Component Rendering at Edge

As a **developer**,
I want to render React components on the edge,
So that users receive fast, SEO-friendly HTML responses.

**Acceptance Criteria:**

**Given** I create a page component:
```typescript
// src/routes/index.tsx
export async function loader() {
  const posts = await Post.orderBy('createdAt', 'desc').limit(10).all()
  return { posts }
}

export default function HomePage({ data }: PageProps) {
  return (
    <main className="container mx-auto">
      <h1 className="text-3xl font-bold">Latest Posts</h1>
      <ul>
        {data.posts.map(post => (
          <li key={post.id}>
            <a href={`/posts/${post.id}`}>{post.title}</a>
          </li>
        ))}
      </ul>
    </main>
  )
}
```
**When** a request comes to `/`
**Then** the component is rendered to HTML on the edge (FR24)
**And** the HTML response includes the rendered content
**And** the response is returned with proper HTML content-type

**Given** I use React 19 features
**When** I use Server Components:
```typescript
// Server Component (default)
export default async function UserProfile({ userId }: Props) {
  const user = await User.find(userId) // Direct async in component
  return <div>{user.name}</div>
}
```
**Then** async components are supported natively (Architecture: React 19)

**Given** I want to use TypeScript with JSX
**When** I create `.tsx` files
**Then** TypeScript + JSX is fully supported with proper types

**Technical Notes:**
- Implement in `packages/ixflare/src/ssr/render.ts`
- Use React 19's renderToReadableStream for edge rendering
- Support both Server Components and traditional components
- TypeScript JSX transform configured in Vite

**Prerequisites:** Epic 2 (routing), Epic 3 (data fetching)

---

## Story 4.2: Progressive HTML Streaming

As a **developer**,
I want HTML to stream progressively to the browser,
So that users see content faster without waiting for all data.

**Acceptance Criteria:**

**Given** I have a page with slow data fetches:
```typescript
export default async function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<StatsLoading />}>
        <SlowStats /> {/* Takes 2 seconds */}
      </Suspense>
      <Suspense fallback={<ChartLoading />}>
        <SlowChart /> {/* Takes 3 seconds */}
      </Suspense>
    </div>
  )
}
```
**When** the page is requested (FR25)
**Then** the shell HTML streams immediately
**And** `<StatsLoading />` placeholder is shown first
**And** when SlowStats resolves, it replaces the placeholder via streaming
**And** the page becomes interactive incrementally

**Given** streaming is enabled
**When** I inspect the response headers
**Then** `Transfer-Encoding: chunked` is set
**And** HTML chunks arrive progressively

**Given** I want to ensure proper HTML structure (FR154)
**When** the page streams
**Then** `<head>` content is always sent before `<body>` content
**And** critical CSS/scripts are in the head
**And** the document is always valid HTML

**Technical Notes:**
- Use React 19's renderToReadableStream
- Suspense boundaries define streaming chunks
- Abort controller integration for timeouts (Architecture: Performance)
- Shell renders first, suspended content streams later

**Prerequisites:** Story 4.1

---

## Story 4.3: Selective Component Hydration (Islands)

As a **developer**,
I want only interactive components to hydrate on the client,
So that I minimize JavaScript payload and improve performance.

**Acceptance Criteria:**

**Given** I create a client component using file convention:
```typescript
// src/components/Counter.client.tsx
'use client'

import { useState } from 'react'

export const island = true  // Marks as island

export default function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  )
}
```
**When** the page renders (FR26)
**Then** Counter is server-rendered to HTML
**And** Counter hydrates on the client (becomes interactive)
**And** non-client components remain static HTML (no JS)

**Given** I use the island in a server component:
```typescript
// src/routes/index.tsx (Server Component)
import Counter from '@/components/Counter.client'

export default function HomePage() {
  return (
    <div>
      <h1>Welcome</h1>  {/* Static, no hydration */}
      <p>This is static content</p>  {/* Static */}
      <Counter />  {/* Island: hydrates */}
    </div>
  )
}
```
**Then** only the Counter component hydrates
**And** the rest of the page remains static HTML

**Given** I check the client bundle
**When** I build for production
**Then** only island components are in the client bundle (FR159)
**And** server-only code is removed from client bundles
**And** each island has its own code chunk (Architecture: Island Code-Splitting)

**Technical Notes:**
- `*.client.tsx` file convention (Architecture: Hydration Detection)
- `island = true` export marker for explicit opt-in
- Automatic code-splitting per island
- Hydration manifest generated at build time (FR155)

**Prerequisites:** Story 4.1

---

## Story 4.4: Hydration Manifest Generation

As a **developer**,
I want the framework to generate a hydration manifest,
So that the client knows which components to hydrate.

**Acceptance Criteria:**

**Given** I have a page with islands
**When** the page is built (FR155)
**Then** a hydration manifest is generated:
```json
{
  "islands": {
    "Counter": {
      "chunk": "/assets/Counter-abc123.js",
      "props": ["initialCount"],
      "marker": "data-island-counter"
    },
    "SearchBox": {
      "chunk": "/assets/SearchBox-def456.js",
      "props": ["placeholder", "onSearch"],
      "marker": "data-island-searchbox"
    }
  }
}
```

**Given** the page is served
**When** the HTML includes islands
**Then** each island has a marker attribute:
```html
<div data-island-counter data-props='{"initialCount":0}'>
  <button>Count: 0</button>
</div>
```
**And** the hydration script loads only needed chunks

**Given** the page loads in the browser
**When** the hydration script runs
**Then** it finds all `data-island-*` elements
**And** loads their corresponding chunks
**And** hydrates each island with its serialized props

**Technical Notes:**
- Manifest generated at build time by Vite plugin
- Props are serialized to JSON in HTML attributes
- Lazy load chunks only when island is visible (optional)
- Support for nested islands

**Prerequisites:** Story 4.3

---

## Story 4.5: Per-Route Rendering Strategy

As a **developer**,
I want to choose the rendering strategy per route,
So that I can optimize based on page requirements.

**Acceptance Criteria:**

**Given** I want to configure rendering per route (FR27)
**When** I export a config:
```typescript
// src/routes/blog/[slug].tsx
export const config = {
  // SSR (default): Render on every request
  rendering: 'ssr',
}

// src/routes/docs/[...path].tsx
export const config = {
  // SSG: Pre-render at build time
  rendering: 'ssg',
  // Revalidate every hour
  revalidate: 3600,
}

// src/routes/dashboard.tsx
export const config = {
  // CSR: Client-side only, no SSR
  rendering: 'csr',
}
```
**Then** the route uses the specified strategy

**Given** I use SSG with dynamic params
**When** I provide paths to pre-render:
```typescript
export async function getStaticPaths() {
  const posts = await Post.select('slug').all()
  return posts.map(post => ({ params: { slug: post.slug } }))
}

export const config = {
  rendering: 'ssg',
  revalidate: 3600, // ISR: regenerate after 1 hour
}
```
**Then** pages are pre-rendered at build time
**And** stale pages are regenerated on request (ISR)

**Given** I use edge caching for SSR
**When** I configure caching (FR29):
```typescript
export const config = {
  rendering: 'ssr',
  cache: {
    maxAge: 60,  // Cache for 60 seconds
    staleWhileRevalidate: 300,  // Serve stale for 5 min while revalidating
  },
}
```
**Then** rendered HTML is cached at the edge
**And** cache headers are set appropriately

**Technical Notes:**
- Default to SSR for maximum flexibility
- SSG generates static HTML at build time
- ISR (Incremental Static Regeneration) for stale-while-revalidate
- CSR skips server rendering, useful for auth-only pages

**Prerequisites:** Story 4.1

---

## Story 4.6: SSR Error Boundaries

As a **developer**,
I want graceful error handling during SSR,
So that errors don't crash the entire page.

**Acceptance Criteria:**

**Given** a component throws during server render (FR28)
**When** I wrap it in an error boundary:
```typescript
import { ErrorBoundary } from 'ixflare/ssr'

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <ErrorBoundary fallback={<p>Failed to load stats</p>}>
        <Stats />  {/* May throw */}
      </ErrorBoundary>
      <OtherContent />  {/* Still renders */}
    </div>
  )
}
```
**Then** only the failing component shows the fallback
**And** the rest of the page renders successfully
**And** the error is logged for debugging

**Given** streaming is active when an error occurs (FR153)
**When** a Suspense boundary errors during streaming:
```typescript
<Suspense fallback={<Loading />}>
  <AsyncComponent />  {/* Throws after stream started */}
</Suspense>
```
**Then** the fallback HTML is sent instead
**And** an error script notifies the client
**And** the page remains functional

**Given** the entire page fails to render
**When** a top-level error occurs
**Then** a custom error page is shown:
```typescript
// src/routes/_error.tsx
export default function ErrorPage({ error }: ErrorProps) {
  return (
    <div>
      <h1>Something went wrong</h1>
      <p>{error.message}</p>
    </div>
  )
}
```

**Technical Notes:**
- Use React 19 error boundary APIs
- Streaming error recovery sends script to update DOM
- Log errors with request context (rayId, path)
- Custom error pages per route group supported

**Prerequisites:** Story 4.2

---

## Story 4.7: HMR State Preservation

As a **developer**,
I want Hot Module Replacement to preserve component state,
So that I can iterate quickly without losing context.

**Acceptance Criteria:**

**Given** I have an island with local state:
```typescript
// Counter.client.tsx
export default function Counter() {
  const [count, setCount] = useState(5) // User clicked 5 times
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
}
```
**When** I edit the component and save (FR105)
**Then** the component hot-reloads
**And** the count state (5) is preserved
**And** I see the UI update without page refresh

**Given** I edit a server component
**When** I save the file
**Then** only affected routes are re-rendered
**And** the browser receives the updated HTML
**And** islands preserve their state

**Given** I make a breaking change (rename export)
**When** HMR can't preserve state
**Then** a full reload is triggered automatically
**And** a console message explains why

**Technical Notes:**
- Implement in `packages/vite-plugin-ixflare/src/hmr.ts`
- Use React Fast Refresh for component state preservation
- Vite handles module graph updates
- Fallback to full reload when necessary

**Prerequisites:** Story 4.3

---

## Story 4.8: Automatic Route-Based Code Splitting

As a **developer**,
I want each route to have its own code bundle,
So that users only download code for the current page.

**Acceptance Criteria:**

**Given** I have multiple routes:
```
src/routes/
├── index.tsx
├── about.tsx
├── blog/
│   ├── index.tsx
│   └── [slug].tsx
└── dashboard/
    ├── index.tsx
    └── settings.tsx
```
**When** I build for production (FR158)
**Then** each route has a separate chunk:
```
dist/
├── routes/
│   ├── index-abc123.js
│   ├── about-def456.js
│   ├── blog/
│   │   ├── index-ghi789.js
│   │   └── slug-jkl012.js
│   └── dashboard/
│       ├── index-mno345.js
│       └── settings-pqr678.js
└── shared/
    └── common-stu901.js  # Shared dependencies
```

**Given** I navigate to `/about`
**When** the page loads
**Then** only `about-def456.js` and `common-stu901.js` are loaded
**And** other route chunks are not downloaded

**Given** I use client-side navigation
**When** I click a link to `/dashboard`
**Then** the dashboard chunk is loaded on-demand
**And** navigation feels instant with prefetching

**Technical Notes:**
- Vite handles route-based splitting automatically
- Common dependencies extracted to shared chunk
- Prefetch hints for likely navigation targets
- Bundle size budget validation (<50KB per route)

**Prerequisites:** Story 4.1

---

## Story 4.9: Server-Only Code Removal

As a **developer**,
I want server-only code automatically removed from client bundles,
So that sensitive code never reaches the browser.

**Acceptance Criteria:**

**Given** I have server-only code in a route:
```typescript
// src/routes/users/[id].tsx
import { db } from '@/lib/database'  // Server-only
import { SECRET_KEY } from '@/config'  // Server-only

export async function loader({ params }) {
  // This entire function is server-only
  const user = await db.query('SELECT * FROM users WHERE id = ?', [params.id])
  return { user }
}

export default function UserPage({ data }) {
  // This renders on both server and client
  return <div>{data.user.name}</div>
}
```
**When** I build for production (FR159)
**Then** the `loader` function is NOT in the client bundle
**And** `db` and `SECRET_KEY` imports are NOT in the client bundle
**And** only the component code is included

**Given** I mark code explicitly as server-only:
```typescript
import 'server-only'  // Fails if imported in client code

export const dbConnection = createConnection(...)
```
**When** client code tries to import it
**Then** the build fails with a clear error

**Given** I check the client bundle
**When** I analyze with source-map-explorer
**Then** no server imports or secrets are present
**And** bundle size is minimized

**Technical Notes:**
- Vite plugin analyzes import graph
- `server-only` package for explicit marking
- Loader functions automatically tree-shaken
- Build fails if server code leaks to client

**Prerequisites:** Story 4.1

---

## Story 4.10: Tailwind CSS Integration

As a **developer**,
I want Tailwind CSS configured by default,
So that I can style components quickly.

**Acceptance Criteria:**

**Given** I create a fullstack project
**When** the project is generated (Architecture: CSS Solution)
**Then** Tailwind CSS is preconfigured:
- `tailwind.config.js` exists with content paths
- `postcss.config.js` includes Tailwind
- Base styles are imported in main CSS

**Given** I write components with Tailwind:
```typescript
export default function Card({ title, children }) {
  return (
    <div className="rounded-lg shadow-md p-6 bg-white dark:bg-gray-800">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {children}
    </div>
  )
}
```
**When** I view in the browser
**Then** Tailwind classes are applied correctly
**And** dark mode works based on user preference

**Given** I want to customize the design system
**When** I edit `tailwind.config.js`:
```javascript
export default {
  theme: {
    extend: {
      colors: {
        brand: '#0066cc',
      },
    },
  },
}
```
**Then** custom tokens are available in classes

**Given** I prefer a different CSS solution
**When** I run `ix config css`:
**Then** I can switch to CSS Modules or Vanilla Extract
**And** Tailwind can be removed cleanly

**Technical Notes:**
- Tailwind included by default (Architecture: CSS Strategy)
- PostCSS configured for Tailwind processing
- JIT mode for development performance
- Opt-out via `ix config` for alternatives

**Prerequisites:** Story 4.1

---

**Epic 4 Complete: Server-Side Rendering & Frontend**

**Stories Created:** 10
**FR Coverage:** FR24, FR25, FR26, FR27, FR28, FR29, FR105, FR153, FR154, FR155, FR158, FR159
**Technical Context Used:** React 19, renderToReadableStream, Islands architecture, file-based hydration detection, Vite plugin
**UX Patterns Incorporated:** Design System with Tailwind, Component Strategy, streaming for perceived performance

---
