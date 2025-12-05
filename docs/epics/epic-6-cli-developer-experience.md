# Epic 6: CLI Developer Experience

**Epic Goal:** Enable developers to use intuitive CLI commands for local development, code generation, database management, and debugging with fast feedback loops and helpful error messages.

**FR Coverage:** FR42, FR43, FR44, FR45, FR46, FR47, FR50, FR51, FR52, FR96, FR102, FR103, FR104, FR108, FR110, FR111, FR113, FR133, FR147, FR163, FR164, FR167

---

## Story 6.1: Local Development Server with HMR

As a **developer**,
I want a local dev server with hot module replacement,
So that I can see changes instantly without full page reloads.

**Acceptance Criteria:**

**Given** I have an Ixflare project
**When** I run `ix dev` (FR42):
```bash
$ ix dev

  ╭─────────────────────────────────────────╮
  │                                         │
  │   Ixflare v1.0.0                        │
  │                                         │
  │   ➜  Local:   http://localhost:3000     │
  │   ➜  Network: http://192.168.1.5:3000   │
  │                                         │
  │   Ready in 312ms                        │
  │                                         │
  ╰─────────────────────────────────────────╯
```
**Then** the dev server starts with Miniflare for Workers simulation
**And** Vite handles frontend bundling with HMR
**And** the terminal shows color-coded output (FR111)

**Given** I edit a `.tsx` file
**When** I save the file
**Then** changes appear in browser within 200ms (Architecture: HMR <200ms)
**And** React component state is preserved where possible (FR105)

**Given** I edit a server-side route handler
**When** I save the file
**Then** the server reloads automatically
**And** the next request uses updated code

**Given** I want to use a different port
**When** I run `ix dev --port 8080`
**Then** the server starts on port 8080
**And** port conflicts are detected with suggestions

**Technical Notes:**
- Implement in `packages/cli/src/commands/dev.ts`
- Use Vite for frontend with `vite-plugin-ixflare`
- Use Miniflare for Workers simulation (Architecture: Local Development)
- Combine with chokidar for file watching

**Prerequisites:** Epic 1 complete

---

## Story 6.2: Production Build & Optimization

As a **developer**,
I want to build optimized production bundles,
So that my application is fast and efficient in production.

**Acceptance Criteria:**

**Given** I want to build for production
**When** I run `ix build` (FR43):
```bash
$ ix build

Building for production...

✓ TypeScript compilation complete
✓ Server bundle: 38KB (gzip)
✓ Client bundles:
    routes/index: 12KB
    routes/dashboard: 18KB
    shared: 24KB
✓ Assets optimized

Build complete in 2.3s
Output: dist/
```
**Then** production bundles are created with optimizations (FR106):
- Tree-shaking removes unused code
- Code splitting by route
- Minification applied
- Source maps generated

**Given** bundle size exceeds limits
**When** I run `ix build`
**Then** I see a warning:
```
⚠️ Bundle size warning:
  Server bundle: 1.2MB (exceeds 1MB Workers limit)

  Suggestions:
  • Check for large dependencies: ix analyze
  • Consider lazy loading: docs.ixflare.dev/optimization
```

**Given** I want to analyze bundle contents
**When** I run `ix build --analyze`
**Then** a visual bundle analyzer opens
**And** I can see what's contributing to bundle size

**Technical Notes:**
- Use Vite/Rollup for bundling
- Terser for minification
- Validate against Cloudflare Workers 1MB limit
- Generate bundle stats for analysis

**Prerequisites:** Story 6.1

---

## Story 6.3: Deployment Command

As a **developer**,
I want to deploy my application with a single command,
So that I can ship updates quickly.

**Acceptance Criteria:**

**Given** I have a built application
**When** I run `ix deploy` (FR44):
```bash
$ ix deploy

Deploying to Cloudflare Workers...

✓ Build verified
✓ Uploading to Cloudflare (38KB)
✓ Configuring D1 database
✓ Configuring KV namespaces
✓ Deploying Worker

✓ Deployed successfully!

🌍 https://my-app.workers.dev

Deployment ID: abc123
```
**Then** the application is deployed to Cloudflare Workers
**And** the deployment URL is shown (FR143)

**Given** I want to deploy to a specific environment (FR71)
**When** I run `ix deploy --env staging`
**Then** the application deploys to the staging environment
**And** environment-specific variables are used (FR72)

**Given** I want to see what will be deployed (FR165)
**When** I run `ix deploy --dry-run`
**Then** I see the deployment plan without executing:
```
Dry run - no changes will be made:

Environment: production
  Variables to set:
    DATABASE_URL: ***hidden***
    API_KEY: ***hidden***

  Resources:
    Worker: my-app
    D1: my-app-db
    KV: my-app-cache
```

**Given** deployment configuration has errors (FR73)
**When** I run `ix deploy`
**Then** validation errors are shown before deployment starts:
```
❌ Deployment validation failed:

  • Missing required secret: STRIPE_SECRET_KEY
  • D1 binding 'DB' not found in wrangler.toml

Fix these issues and try again.
```

**Technical Notes:**
- Implement in `packages/cli/src/commands/deploy.ts`
- Use Wrangler API under the hood
- Validate configuration before deployment
- Store deployment history for rollback (FR103)

**Prerequisites:** Story 6.2

---

## Story 6.4: Production Preview

As a **developer**,
I want to preview production builds locally,
So that I can catch issues before deploying.

**Acceptance Criteria:**

**Given** I have built my application
**When** I run `ix preview` (FR45):
```bash
$ ix preview

Starting production preview...

✓ Using production build from dist/
✓ Miniflare simulating Workers environment
✓ D1 using local SQLite database

  ➜  Preview: http://localhost:3001

Note: This simulates production behavior locally.
```
**Then** the production build runs in a local Workers simulation
**And** I can test production behavior without deploying

**Given** I want to test with production data
**When** I run `ix preview --env production`
**Then** the preview connects to production D1 (read-only recommended)
**And** a warning is shown about production data access

**Given** I make changes during preview
**When** I save files
**Then** changes are NOT automatically reloaded (this is preview, not dev)
**And** I'm prompted to rebuild: `Run 'ix build' to see changes`

**Technical Notes:**
- Use Miniflare in production mode
- Load production build from `dist/`
- Optionally connect to remote bindings for integration testing
- Clear separation from dev mode behavior

**Prerequisites:** Story 6.2

---

## Story 6.5: TypeScript Type Generation

As a **developer**,
I want auto-generated TypeScript types for my application,
So that I get full type safety for routes, models, and env.

**Acceptance Criteria:**

**Given** I have defined models and routes
**When** I run `ix generate:types` (FR102):
```bash
$ ix generate:types

Generating TypeScript types...

✓ Route types: src/types/routes.d.ts
✓ Model types: src/types/models.d.ts
✓ Env types: src/types/env.d.ts

Types generated successfully!
```
**Then** type definition files are created

**Given** I have environment variables in `.env.example`
**When** types are generated
**Then** `env.d.ts` includes typed env:
```typescript
declare module 'ixflare' {
  interface Env {
    DATABASE_URL: string
    JWT_SECRET: string
    STRIPE_API_KEY: string
  }
}
```

**Given** I have route files
**When** types are generated
**Then** route params and loaders are typed:
```typescript
// Generated from src/routes/users/[userId].tsx
declare module '@/routes/users/[userId]' {
  export interface Params {
    userId: string
  }
  export interface LoaderData {
    user: User
  }
}
```

**Given** types are outdated
**When** I run `ix dev`
**Then** types are regenerated automatically on file changes

**Technical Notes:**
- Implement in `packages/cli/src/commands/generate.ts`
- Parse route files for params and loader return types
- Parse `.env.example` for environment types
- Watch mode in development

**Prerequisites:** Epic 1

---

## Story 6.6: Database Migration CLI

As a **developer**,
I want CLI commands for database migrations,
So that I can evolve my schema safely.

**Acceptance Criteria:**

**Given** I modify my model schemas
**When** I run `ix migrate:generate create-posts` (FR47):
```bash
$ ix migrate:generate create-posts

Comparing schema with database...

Changes detected:
  + Table: posts
    + Column: id (INTEGER PRIMARY KEY)
    + Column: title (TEXT NOT NULL)
    + Column: content (TEXT)
    + Column: author_id (INTEGER REFERENCES users)
    + Column: created_at (DATETIME)
    + Column: updated_at (DATETIME)

✓ Generated: migrations/0002_create_posts.sql
```
**Then** a migration file is created with the SQL

**Given** I have pending migrations
**When** I run `ix migrate`:
```bash
$ ix migrate

Pending migrations:
  • 0002_create_posts.sql

Applying migrations...
✓ 0002_create_posts.sql (23ms)

All migrations applied!
```
**Then** migrations run against D1

**Given** I need to rollback (FR163)
**When** I run `ix migrate:rollback`:
```bash
$ ix migrate:rollback

Last migration: 0002_create_posts.sql

? Rollback this migration? (y/N) y

✓ Rolled back: 0002_create_posts.sql
```
**Then** the migration is reversed

**Given** I want to check migration status
**When** I run `ix migrate:status`:
```bash
$ ix migrate:status

Database: my-app-db (D1)

  ✓ 0001_create_users.sql (applied: 2024-12-01)
  ✓ 0002_create_posts.sql (applied: 2024-12-03)
  ○ 0003_add_tags.sql (pending)
```
**Then** I see applied and pending migrations

**Technical Notes:**
- Use Drizzle Kit internally (Architecture: Migration Engine)
- Store migration state in `_migrations` table
- Support both up and down migrations
- Integrate with `ix dev` for auto-migration in development

**Prerequisites:** Epic 3 (EdgeRecord)

---

## Story 6.7: Database Studio GUI

As a **developer**,
I want a visual database interface,
So that I can inspect and manage data easily.

**Acceptance Criteria:**

**Given** I want to explore my database
**When** I run `ix db:studio`:
```bash
$ ix db:studio

Starting Database Studio...

✓ Connected to: my-app-db (D1)

  ➜  Studio: http://localhost:4000

Tables:
  • users (156 records)
  • posts (432 records)
  • sessions (23 records)
```
**Then** a web-based database GUI opens

**Given** I'm in the studio interface
**When** I browse tables
**Then** I can:
- View table schema and relationships
- Browse records with pagination
- Filter and sort data
- Execute raw SQL queries
- Export data to CSV/JSON

**Given** I want to edit data
**When** I'm in development mode
**Then** I can insert, update, delete records
**And** changes are logged for undo

**Given** I'm connected to production
**When** I attempt to modify data
**Then** a confirmation dialog warns about production changes
**And** all changes are audit logged

**Technical Notes:**
- Use Drizzle Studio or custom implementation
- Read-only mode for production by default
- Support for D1, KV browsing
- Query history and saved queries

**Prerequisites:** Story 6.6

---

## Story 6.8: Rescue Checkpoints

As a **developer**,
I want to create and restore rescue checkpoints,
So that I can recover from mistakes quickly.

**Acceptance Criteria:**

**Given** I want to save current state before a risky change (FR51)
**When** I run `ix rescue:create`:
```bash
$ ix rescue:create

Creating rescue checkpoint...

✓ Database snapshot: my-app-db_2024-12-04_14:30
✓ KV snapshot: my-app-cache_2024-12-04_14:30
✓ Code state: git stash created

Checkpoint created: rescue-2024-12-04-1430

Restore with: ix rescue:restore rescue-2024-12-04-1430
```
**Then** a checkpoint of database and state is saved

**Given** something went wrong
**When** I run `ix rescue:restore rescue-2024-12-04-1430` (FR52):
```bash
$ ix rescue:restore rescue-2024-12-04-1430

⚠️ This will restore:
  • Database to snapshot from 2024-12-04 14:30
  • KV data to snapshot from 2024-12-04 14:30
  • Code to git stash (optional)

? Proceed with restore? (y/N) y

✓ Database restored
✓ KV restored
✓ Code stash applied

Checkpoint restored successfully!
```
**Then** the previous state is restored

**Given** I want to list checkpoints
**When** I run `ix rescue:list`:
```bash
$ ix rescue:list

Available checkpoints:
  rescue-2024-12-04-1430  (2 hours ago) - Pre-migration
  rescue-2024-12-03-0900  (1 day ago)   - Before refactor
  rescue-2024-12-01-1600  (3 days ago)  - Initial setup
```
**Then** I see available restore points with timestamps

**Technical Notes:**
- Store checkpoints locally and optionally in R2
- Use D1 point-in-time restore if available
- Git integration for code state
- Automatic cleanup of old checkpoints (configurable retention)

**Prerequisites:** Story 6.6

---

## Story 6.9: Actionable Error Messages

As a **developer**,
I want error messages that explain how to fix issues,
So that I can resolve problems quickly.

**Acceptance Criteria:**

**Given** an error occurs during development (FR108)
**When** the error is displayed
**Then** it includes:
```
❌ Error: Cannot find module '@/models/User'

This usually means:
  1. The file doesn't exist at src/models/User.ts
  2. There's a typo in the import path
  3. TypeScript paths aren't configured correctly

Quick fixes:
  • Create the file: touch src/models/User.ts
  • Check tsconfig.json paths configuration

📖 More info: https://ixflare.dev/errors/MODULE_NOT_FOUND
```

**Given** a configuration error occurs
**When** I run any CLI command
**Then** the error points to the specific issue:
```
❌ Configuration Error in edge.config.ts:12

  auth: {
    jwt: {
      algorithm: 'RS256',  // ← Error here
              ^^^^^^^^
    }
  }

RS256 is not supported. Use ES256 or HS256.

📖 Docs: https://ixflare.dev/docs/auth/jwt-algorithms
```

**Given** syntax highlighting is available (FR137)
**When** errors contain code
**Then** code is syntax highlighted in the terminal
**And** line numbers are shown for context

**Technical Notes:**
- Implement error formatting in `packages/cli/src/errors/`
- Include error codes for searchability
- Link to documentation for each error type
- Support `--no-color` flag for CI environments (FR111)

**Prerequisites:** Epic 1

---

## Story 6.10: Progress Indicators

As a **developer**,
I want progress indicators for long-running operations,
So that I know the CLI is working and how long to wait.

**Acceptance Criteria:**

**Given** an operation takes more than 5 seconds (FR110)
**When** it's running
**Then** I see a progress indicator:
```
Deploying to production...

  [████████░░░░░░░░░░░░] 40%

  ✓ Build verified
  ✓ Uploading bundle
  ◐ Configuring bindings...
  ○ Deploying Worker
  ○ Running smoke tests
```

**Given** I run a command with multiple steps
**When** each step completes
**Then** I see real-time updates:
```
Creating project...

  ✓ Scaffolding project structure
  ✓ Installing dependencies (23s)
  ◐ Configuring TypeScript...
```

**Given** operation duration tracking is enabled (FR96)
**When** an operation completes
**Then** I see how long it took:
```
✓ Build complete in 2.3s
✓ Deployed in 12.4s
```

**Given** I want minimal output
**When** I run with `--quiet` flag
**Then** only essential output is shown (no spinners, minimal progress)

**Technical Notes:**
- Use `ora` or similar for spinners
- Track operation duration for all commands
- Support TTY detection for CI environments
- Quiet mode for scripting

**Prerequisites:** Epic 1

---

## Story 6.11: Interactive Wizard Mode

As a **new developer**,
I want guided wizards for complex operations,
So that I can complete tasks without reading documentation.

**Acceptance Criteria:**

**Given** I run `ix init` without arguments (FR113)
**When** wizard mode starts
**Then** I'm guided through project setup:
```
Welcome to Ixflare! Let's set up your project.

? What type of project are you building?
  ❯ Fullstack (React + API)
    API Backend (API only)
    Minimal (bare essentials)

? What's your project name? my-awesome-app

? Which package manager do you prefer?
  ❯ pnpm (recommended)
    npm
    bun

Creating project...
```

**Given** I run `ix deploy` for the first time
**When** no Cloudflare credentials exist
**Then** I'm guided through setup:
```
First-time deployment detected!

? Do you have a Cloudflare account? (Y/n)

Great! Let's set up your API token.

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Create a token with 'Workers' permissions
3. Paste your token below:

? API Token: ********

✓ Credentials saved!

Now deploying...
```

**Given** I prefer non-interactive mode
**When** I run with flags: `ix init --name my-app --template fullstack --pm pnpm`
**Then** wizard is skipped and options are used directly

**Technical Notes:**
- Use `enquirer` or `prompts` for interactive CLI
- Default to wizard in TTY, non-interactive in CI
- Support `--yes` flag for accepting defaults
- Remember preferences for future commands

**Prerequisites:** Epic 1

---

## Story 6.12: Framework Version Notifications

As a **developer**,
I want to be notified of framework updates,
So that I can keep my project up to date.

**Acceptance Criteria:**

**Given** a new Ixflare version is available (FR133)
**When** I run any CLI command
**Then** I see a non-intrusive notification:
```
$ ix dev

╭─────────────────────────────────────────────────────╮
│                                                     │
│   Update available: 1.0.0 → 1.1.0                   │
│   Run `pnpm update ixflare` to update               │
│                                                     │
│   Changelog: https://ixflare.dev/releases/1.1.0    │
│                                                     │
╰─────────────────────────────────────────────────────╯

Starting dev server...
```

**Given** the update is a major version (breaking changes)
**When** the notification appears
**Then** it indicates breaking changes:
```
⚠️ Major update available: 1.x → 2.0.0

This update includes breaking changes.
Migration guide: https://ixflare.dev/migrate/v2

Run `pnpm update ixflare@2` when ready.
```

**Given** I want to disable notifications
**When** I run `ix config set updateCheck false`
**Then** update notifications are disabled
**And** I can re-enable with `ix config set updateCheck true`

**Technical Notes:**
- Check npm registry for latest version (cached, max 1x per day)
- Compare with installed version
- Non-blocking async check (don't slow down commands)
- Respect `NO_UPDATE_CHECK` environment variable

**Prerequisites:** Epic 1

---

## Story 6.13: Type Checking via CLI

As a **developer**,
I want to run type checking from the CLI,
So that I can catch type errors without opening an IDE.

**Acceptance Criteria:**

**Given** I want to check types
**When** I run `ix typecheck` (FR147):
```bash
$ ix typecheck

Type checking...

src/routes/users/[userId].tsx:15:7
  error TS2322: Type 'string' is not assignable to type 'number'.

    const userId: number = params.userId
                           ~~~~~~~~~~~~

Found 1 error in 1 file.
```
**Then** TypeScript errors are shown with locations

**Given** no type errors exist
**When** I run `ix typecheck`
**Then** I see success:
```
$ ix typecheck

✓ No type errors found!
```

**Given** I want to watch for type errors
**When** I run `ix typecheck --watch`
**Then** type checking runs on every file change
**And** errors are updated in real-time

**Given** I want type checking in CI
**When** I run `ix typecheck --ci`
**Then** exit code is 1 if errors exist
**And** output is formatted for CI (no colors, machine-readable)

**Technical Notes:**
- Use TypeScript compiler API under the hood
- Share tsconfig with the project
- Incremental checking for speed
- Integration with `ix build` (auto type check)

**Prerequisites:** Story 6.5

---

## Story 6.14: Live Log Streaming

As a **developer**,
I want to stream production logs in real-time,
So that I can debug issues without accessing the dashboard.

**Acceptance Criteria:**

**Given** I want to see production logs (FR164)
**When** I run `ix logs --tail`:
```bash
$ ix logs --tail

Streaming logs from: my-app (production)

[2024-12-04 14:30:01] GET /api/users 200 (23ms)
[2024-12-04 14:30:02] POST /api/posts 201 (45ms)
[2024-12-04 14:30:03] GET /api/users/123 404 (12ms)
  └─ User not found: 123

Press Ctrl+C to stop...
```
**Then** logs stream in real-time from Cloudflare

**Given** I want to filter logs
**When** I run `ix logs --tail --filter "error"`:
```bash
$ ix logs --tail --filter "error"

Only showing logs matching: error

[2024-12-04 14:30:03] ERROR POST /api/users
  └─ ValidationError: Email already exists
```
**Then** only matching logs are shown

**Given** I want logs from a specific time range
**When** I run `ix logs --since 1h --until 30m`:
**Then** historical logs are retrieved for that period

**Given** I want JSON output for parsing
**When** I run `ix logs --json`
**Then** logs are output as newline-delimited JSON

**Technical Notes:**
- Use Cloudflare's Logpush API or Workers Trace
- Support filtering by status code, path, method
- Buffer logs for smooth streaming
- Support `--env` flag for environment selection

**Prerequisites:** Story 6.3

---

## Story 6.15: Eject to Custom Configuration

As an **advanced developer**,
I want to eject from managed configuration,
So that I can customize build and deployment fully.

**Acceptance Criteria:**

**Given** I need full control over Wrangler config (FR167)
**When** I run `ix eject`:
```bash
$ ix eject

⚠️ Ejecting will:
  • Generate raw wrangler.toml from edge.config.ts
  • Generate vite.config.ts with all plugins configured
  • Remove framework abstractions

After ejecting, you'll manage configuration directly.
Some `ix` commands may not work as expected.

? Are you sure you want to eject? (y/N) y

Ejecting...

✓ Generated: wrangler.toml
✓ Generated: vite.config.ts (expanded)
✓ Updated: package.json scripts

Ejection complete!

Your project now uses raw Wrangler configuration.
Docs: https://ixflare.dev/docs/advanced/ejected-projects
```
**Then** raw configuration files are generated

**Given** I've ejected
**When** I check the generated files
**Then** `wrangler.toml` contains all settings:
```toml
name = "my-app"
main = "dist/worker.js"
compatibility_date = "2024-01-01"

[vars]
DATABASE_URL = "..."

[[d1_databases]]
binding = "DB"
database_name = "my-app-db"
database_id = "abc123"
```

**Given** I want a partial eject
**When** I run `ix eject --config-only`
**Then** only wrangler.toml is generated
**And** Vite remains managed by the framework

**Technical Notes:**
- Transform `edge.config.ts` to `wrangler.toml`
- Expose all Vite plugin configurations
- Document limitations of ejected projects
- No "un-eject" - manual process

**Prerequisites:** Story 6.3

---

**Epic 6 Complete: CLI Developer Experience**

**Stories Created:** 15
**FR Coverage:** FR42, FR43, FR44, FR45, FR46, FR47, FR50, FR51, FR52, FR96, FR102, FR103, FR104, FR108, FR110, FR111, FR113, FR133, FR147, FR163, FR164, FR167
**Technical Context Used:** Vite integration, Miniflare for Workers simulation, Drizzle Kit for migrations, Wrangler API for deployment
**UX Patterns Incorporated:** Terminal Output Component, Progress Stepper, color-coded output, progressive help system

---

# Epic 7: Testing Framework

**Epic Goal:** Enable developers to write and run comprehensive unit and integration tests that accurately simulate the edge execution environment, with proper mocking utilities and coverage reporting.

**FR Coverage:** FR36, FR37, FR38, FR39, FR40, FR41, FR130, FR131, FR132

---

## Story 7.1: Unit Testing with Workers Simulation

As a **developer**,
I want to write unit tests that run in a simulated Workers environment,
So that my tests accurately reflect production behavior.

**Acceptance Criteria:**

**Given** I create a test file `tests/routes/users.test.ts` (FR36)
**When** I write tests:
```typescript
import { describe, it, expect } from 'vitest'
import { createTestContext } from 'ixflare/testing'
import { GET } from '@/routes/api/users'

describe('GET /api/users', () => {
  it('returns a list of users', async () => {
    const ctx = createTestContext({
      request: new Request('http://localhost/api/users'),
      env: { DB: mockD1() },
    })

    const response = await GET(ctx)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(10)
  })
})
```
**Then** tests run in a simulated Workers environment via Miniflare

**Given** I run `ix test`
**When** tests execute
**Then** I see results:
```bash
$ ix test

 ✓ tests/routes/users.test.ts (3 tests) 45ms
 ✓ tests/models/User.test.ts (5 tests) 23ms

 Test Files  2 passed (2)
      Tests  8 passed (8)
   Duration  312ms
```

**Given** I want to test edge-specific APIs
**When** I use Workers APIs in tests:
```typescript
it('handles KV storage', async () => {
  const kv = mockKV({ 'key': 'value' })
  const result = await kv.get('key')
  expect(result).toBe('value')
})
```
**Then** Workers APIs (KV, D1, DO) are properly mocked

**Technical Notes:**
- Use Vitest as test runner (Architecture)
- Miniflare provides Workers simulation
- Test file location: mirrored `tests/` structure
- Support for `*.test.ts` and `*.spec.ts`

**Prerequisites:** Epic 1, Epic 2

---

## Story 7.2: Integration Testing for Multi-Tier Storage

As a **developer**,
I want to test interactions across storage tiers,
So that I can verify data flows correctly between KV, D1, and DO.

**Acceptance Criteria:**

**Given** I need to test EdgeRecord operations (FR37)
**When** I write integration tests:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDatabase, seedTestData } from 'ixflare/testing'
import { User, Post } from '@/models'

describe('User with Posts', () => {
  beforeEach(async () => {
    await createTestDatabase()
    await seedTestData('users', 'posts')
  })

  it('creates user with related posts', async () => {
    const user = await User.create({
      email: 'test@example.com',
      name: 'Test User',
    })

    const post = await Post.create({
      authorId: user.id,
      title: 'Test Post',
    })

    const loaded = await User.with('posts').find(user.id)
    expect(loaded.posts).toHaveLength(1)
    expect(loaded.posts[0].title).toBe('Test Post')
  })
})
```
**Then** tests run against a real D1 database (local SQLite)

**Given** I test caching behavior
**When** I verify cache interactions:
```typescript
it('caches frequently accessed data', async () => {
  const user = await User.find(1) // First call hits D1
  const cached = await User.find(1) // Second call hits KV cache

  expect(getCacheHits()).toBe(1)
  expect(getD1Queries()).toBe(1)
})
```
**Then** I can verify caching works correctly

**Technical Notes:**
- Use actual D1 (SQLite) for integration tests
- Mock KV/DO or use Miniflare simulation
- Reset database state between tests
- Support for transaction rollback cleanup

**Prerequisites:** Story 7.1, Epic 3

---

## Story 7.3: Type-Safe Test Utilities

As a **developer**,
I want type-safe test utilities,
So that I catch errors at compile time rather than runtime.

**Acceptance Criteria:**

**Given** I use test utilities (FR38)
**When** I create test contexts:
```typescript
import { createTestContext, mockRequest } from 'ixflare/testing'

// Full type inference for context
const ctx = createTestContext({
  request: mockRequest('GET', '/api/users'),
  params: { userId: '123' },
  env: {
    DB: mockD1(),
    CACHE: mockKV(),
  },
})

// ctx.params.userId is typed as string
// ctx.env.DB has D1 methods typed
```
**Then** all properties are properly typed

**Given** I mock models
**When** I use typed mocks:
```typescript
import { mockModel } from 'ixflare/testing'

const MockUser = mockModel(User, {
  find: async (id) => ({ id, email: 'test@example.com', name: 'Test' }),
  create: async (data) => ({ id: 1, ...data }),
})

// MockUser has same interface as User
// TypeScript errors if mock returns wrong shape
```
**Then** mocks have the same type as real models

**Given** I write assertions
**When** I use custom matchers:
```typescript
expect(response).toHaveStatus(200)
expect(response).toHaveHeader('Content-Type', 'application/json')
expect(response).toMatchJsonSchema(userSchema)
```
**Then** assertions are type-safe and descriptive

**Technical Notes:**
- Export typed helpers from `ixflare/testing`
- Use TypeScript generics for type inference
- Custom Vitest matchers for Response assertions
- Zod schema matching for JSON validation

**Prerequisites:** Story 7.1

---

## Story 7.4: Route Handler Testing with Mocks

As a **developer**,
I want to test route handlers in isolation,
So that I can verify behavior without real dependencies.

**Acceptance Criteria:**

**Given** I test a route handler (FR41)
**When** I mock dependencies:
```typescript
import { testHandler, mockEnv } from 'ixflare/testing'
import { POST } from '@/routes/api/users'

describe('POST /api/users', () => {
  it('creates a new user', async () => {
    const response = await testHandler(POST, {
      method: 'POST',
      body: { email: 'new@example.com', name: 'New User' },
      env: mockEnv(),
    })

    expect(response.status).toBe(201)
    const user = await response.json()
    expect(user.email).toBe('new@example.com')
  })

  it('validates email format', async () => {
    const response = await testHandler(POST, {
      method: 'POST',
      body: { email: 'invalid', name: 'Test' },
      env: mockEnv(),
    })

    expect(response.status).toBe(422)
    const error = await response.json()
    expect(error.errors).toContainEqual(
      expect.objectContaining({ field: 'email' })
    )
  })
})
```
**Then** handlers are tested in isolation

**Given** I need to test authenticated routes
**When** I mock authentication:
```typescript
it('requires authentication', async () => {
  const response = await testHandler(GET, {
    method: 'GET',
    // No auth header
  })

  expect(response.status).toBe(401)
})

it('allows authenticated users', async () => {
  const response = await testHandler(GET, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${mockJwt({ userId: 1, role: 'user' })}`,
    },
  })

  expect(response.status).toBe(200)
})
```
**Then** auth flows are easily testable

**Technical Notes:**
- `testHandler` wraps handler with test context
- Auto-cleanup of mocks after each test
- Support for middleware testing
- Request/response inspection helpers

**Prerequisites:** Story 7.1, Story 7.3

---

## Story 7.5: Local Edge Simulation Testing

As a **developer**,
I want tests to simulate real edge execution,
So that I can catch edge-specific issues before deployment.

**Acceptance Criteria:**

**Given** I want to test edge behavior (FR39)
**When** I run full integration tests:
```typescript
import { createEdgeTestServer } from 'ixflare/testing'

describe('Edge Integration', () => {
  let server: EdgeTestServer

  beforeAll(async () => {
    server = await createEdgeTestServer({
      // Uses Miniflare with full Workers runtime
      d1: true,
      kv: true,
      durableObjects: true,
    })
  })

  afterAll(() => server.close())

  it('handles complete request flow', async () => {
    // Real HTTP request to local server
    const response = await fetch(`${server.url}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', name: 'Test' }),
    })

    expect(response.status).toBe(201)
  })
})
```
**Then** tests use actual Workers runtime via Miniflare

**Given** I want to test Workers-specific limits
**When** I simulate constraints:
```typescript
it('handles CPU time limits', async () => {
  const response = await server.fetch('/api/heavy-computation', {
    // Simulate 50ms CPU limit
    cpuLimit: 50,
  })

  // Should complete within limit or handle gracefully
  expect(response.ok).toBe(true)
})
```
**Then** edge constraints are simulated

**Technical Notes:**
- Use Miniflare for full Workers simulation
- Support for CPU/memory limit testing
- Test cold starts and warmup behavior
- Multi-region simulation (optional)

**Prerequisites:** Story 7.2

---

## Story 7.6: Fixture Management

As a **developer**,
I want reusable test fixtures,
So that I can maintain consistent test data.

**Acceptance Criteria:**

**Given** I define fixtures (FR130)
**When** I create fixture files:
```typescript
// tests/fixtures/users.ts
import { defineFixture } from 'ixflare/testing'

export const users = defineFixture('users', {
  admin: {
    id: 1,
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
  },
  regularUser: {
    id: 2,
    email: 'user@example.com',
    name: 'Regular User',
    role: 'user',
  },
})

// With factory for dynamic data
export const userFactory = defineFactory('users', (overrides) => ({
  email: `user-${Date.now()}@example.com`,
  name: 'Generated User',
  role: 'user',
  ...overrides,
}))
```
**Then** fixtures are available in tests

**Given** I use fixtures in tests
**When** I load them:
```typescript
import { users, userFactory } from '@/tests/fixtures/users'

describe('User permissions', () => {
  it('admin can delete users', async () => {
    await seedFixture(users.admin)
    const ctx = createTestContext({ user: users.admin })

    // Test admin action
  })

  it('works with factory users', async () => {
    const user = await userFactory.create({ role: 'moderator' })
    // user has generated email but custom role
  })
})
```
**Then** consistent test data is easily accessible

**Technical Notes:**
- Static fixtures for predictable data
- Factories for dynamic generation
- JSON fixtures for large datasets
- Auto-cleanup of created fixtures

**Prerequisites:** Story 7.1

---

## Story 7.7: Coverage Reports with Thresholds

As a **developer**,
I want code coverage reports with configurable thresholds,
So that I can maintain test quality.

**Acceptance Criteria:**

**Given** I want to see test coverage (FR131)
**When** I run `ix test --coverage`:
```bash
$ ix test --coverage

 ✓ tests/routes/users.test.ts (3 tests)
 ✓ tests/models/User.test.ts (5 tests)

Coverage Report:

File                 | % Stmts | % Branch | % Funcs | % Lines
---------------------|---------|----------|---------|--------
All files            |   87.5  |   82.3   |   90.1  |   88.2
 src/routes/         |   92.3  |   88.1   |   95.0  |   93.1
  api/users.ts       |  100.0  |  100.0   |  100.0  |  100.0
  api/posts.ts       |   84.6  |   76.2   |   90.0  |   86.2
 src/models/         |   85.0  |   78.5   |   87.5  |   85.7
  User.ts            |   90.0  |   85.0   |   90.0  |   90.0
  Post.ts            |   80.0  |   72.0   |   85.0  |   81.4
```
**Then** I see detailed coverage by file

**Given** I configure coverage thresholds
**When** I set them in `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
})
```
**And** coverage falls below threshold
**Then** tests fail with clear message:
```
ERROR: Coverage threshold not met:
  Lines: 78.5% (threshold: 80%)
```

**Given** I want coverage in CI
**When** I run `ix test --coverage --ci`
**Then** coverage report is generated in machine-readable format
**And** can be uploaded to coverage services (Codecov, etc.)

**Technical Notes:**
- Use Vitest's built-in coverage (v8 or istanbul)
- Support HTML, JSON, LCOV output formats
- Exclude generated files and test files
- Per-file and overall thresholds

**Prerequisites:** Story 7.1

---

## Story 7.8: Snapshot Testing for SSR

As a **developer**,
I want snapshot testing for rendered HTML,
So that I can detect unintended UI changes.

**Acceptance Criteria:**

**Given** I test SSR output (FR132)
**When** I create snapshot tests:
```typescript
import { renderToString } from 'ixflare/testing'
import HomePage from '@/routes/index'

describe('HomePage SSR', () => {
  it('renders correctly', async () => {
    const html = await renderToString(
      <HomePage data={{ posts: mockPosts }} />
    )

    expect(html).toMatchSnapshot()
  })

  it('renders empty state', async () => {
    const html = await renderToString(
      <HomePage data={{ posts: [] }} />
    )

    expect(html).toMatchSnapshot()
  })
})
```
**Then** snapshots are created/compared

**Given** a snapshot changes
**When** I run tests
**Then** I see the diff:
```
Snapshot "HomePage SSR renders correctly"
does not match:

- <h1>Latest Posts</h1>
+ <h1>Recent Posts</h1>
```

**Given** the change is intentional
**When** I run `ix test --update-snapshots`
**Then** snapshots are updated

**Given** I want inline snapshots
**When** I use `toMatchInlineSnapshot`:
```typescript
expect(html).toMatchInlineSnapshot(`
  "<main class="container">
    <h1>Latest Posts</h1>
    ...
  </main>"
`)
```
**Then** snapshot is stored in the test file

**Technical Notes:**
- Use Vitest snapshot testing
- Support for HTML, JSON, and component snapshots
- Pretty-print HTML for readable diffs
- Sanitize dynamic content (dates, IDs)

**Prerequisites:** Story 7.1, Epic 4

---

## Story 7.9: CI/CD Integration

As a **developer**,
I want tests to run automatically in CI,
So that quality is enforced on every commit.

**Acceptance Criteria:**

**Given** I set up CI (FR40)
**When** I use the provided GitHub Actions template:
```yaml