# Project Structure & Boundaries

## Complete Project Directory Structure

```
ixflare/
├── README.md                           # Quick start, badges, links
├── ARCHITECTURE.md                     # Monorepo structure overview
├── CONTRIBUTING.md                     # Contribution guidelines
├── LICENSE                             # MIT License
├── package.json                        # Root workspace scripts
├── pnpm-workspace.yaml                 # Workspace configuration
├── pnpm-lock.yaml                      # Lockfile
├── turbo.json                          # Build orchestration (future-proofing)
├── tsconfig.base.json                  # Shared TypeScript config
├── .gitignore
├── .prettierrc
├── .eslintrc.js
├── .changeset/
│   └── config.json                     # Changesets for versioning
├── .github/
│   ├── CODEOWNERS                      # Package ownership
│   ├── workflows/
│   │   ├── ci.yml                      # Main CI pipeline
│   │   ├── release.yml                 # Automated releases
│   │   └── template-health.yml         # Template validation
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── .vscode/
│   ├── extensions.json                 # Recommended extensions
│   ├── settings.json                   # Workspace settings
│   └── launch.json                     # Debug configurations
├── scripts/
│   ├── build.sh                        # Build all packages
│   ├── release.sh                      # Release workflow
│   ├── dev-setup.sh                    # First-time setup
│   └── template-test.sh                # Test all templates
├── docs/
│   ├── index.md                        # Documentation home
│   ├── getting-started/
│   │   ├── installation.md
│   │   ├── quick-start.md
│   │   └── first-app.md
│   ├── guides/
│   │   ├── routing.md
│   │   ├── edge-record.md
│   │   ├── authentication.md
│   │   ├── ssr-islands.md
│   │   └── deployment.md
│   ├── api-reference/
│   │   ├── router.md
│   │   ├── middleware.md
│   │   ├── edge-record.md
│   │   ├── auth.md
│   │   └── cli.md
│   └── contributing/
│       ├── development.md
│       └── architecture.md
├── packages/
│   ├── README.md                       # Package dependency graph
│   ├── ixflare/                        # Main runtime package (~39KB max)
│   │   ├── package.json                # Subpath exports configured
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts                # Main exports
│   │   │   ├── config/
│   │   │   │   ├── schema.ts           # edge.config.ts schema (shared)
│   │   │   │   ├── loader.ts           # Config loading logic
│   │   │   │   └── defaults.ts         # Default configuration
│   │   │   ├── core/                   # Router, middleware (~14KB)
│   │   │   │   ├── router.ts
│   │   │   │   ├── middleware.ts
│   │   │   │   ├── context.ts
│   │   │   │   └── helpers.ts
│   │   │   ├── edge-record/            # ORM (~15KB, subpath: ixflare/orm)
│   │   │   │   ├── index.ts
│   │   │   │   ├── model.ts
│   │   │   │   ├── query-builder.ts
│   │   │   │   ├── relations.ts
│   │   │   │   ├── cache.ts
│   │   │   │   └── schema.ts
│   │   │   ├── auth/                   # Authentication
│   │   │   │   ├── jwt.ts              # Custom WebCrypto JWT
│   │   │   │   ├── session.ts          # KV + DO sessions
│   │   │   │   ├── oauth.ts            # OAuth primitives
│   │   │   │   └── rbac.ts             # RBAC + Policies
│   │   │   ├── ssr/                    # SSR utilities (~10KB, subpath: ixflare/ssr)
│   │   │   │   ├── index.ts
│   │   │   │   ├── render.ts
│   │   │   │   ├── streaming.ts
│   │   │   │   └── islands.ts
│   │   │   ├── client/                 # Client-side hydration
│   │   │   │   ├── index.ts
│   │   │   │   └── hydrate.ts
│   │   │   ├── errors/
│   │   │   │   ├── index.ts
│   │   │   │   ├── base.ts             # AppError base class
│   │   │   │   ├── auth.ts             # AuthError
│   │   │   │   ├── validation.ts       # ValidationError
│   │   │   │   ├── not-found.ts        # NotFoundError
│   │   │   │   ├── forbidden.ts        # ForbiddenError
│   │   │   │   ├── conflict.ts         # ConflictError
│   │   │   │   ├── infra.ts            # InfraError
│   │   │   │   └── http.ts             # Generic HttpError
│   │   │   ├── logging/
│   │   │   │   ├── index.ts
│   │   │   │   └── logger.ts
│   │   │   ├── types/
│   │   │   │   ├── index.ts
│   │   │   │   ├── shared.ts           # Cross-package types
│   │   │   │   ├── config.ts
│   │   │   │   ├── context.ts
│   │   │   │   └── events.ts
│   │   │   └── utils/
│   │   │       ├── index.ts
│   │   │       └── transform.ts        # snake_case ↔ camelCase
│   │   └── tests/                      # Runtime unit tests
│   │       ├── core/
│   │       ├── edge-record/
│   │       ├── auth/
│   │       ├── ssr/
│   │       └── utils/
│   ├── vite-plugin-ixflare/            # Vite integration (Node.js only)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── plugin.ts               # Main Vite plugin
│   │   │   ├── dev-server.ts           # Dev server with Miniflare
│   │   │   ├── build.ts                # Production build
│   │   │   ├── router-codegen.ts       # File-based routing
│   │   │   └── hmr.ts                  # Hot module replacement
│   │   └── tests/
│   │       ├── plugin.test.ts
│   │       └── build.test.ts
│   ├── create-ixflare/                 # npm create ixflare scaffolder
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts                # Entry point
│   │   │   ├── cli.ts                  # CLI prompts
│   │   │   ├── scaffold.ts             # Template copying
│   │   │   └── utils.ts
│   │   └── tests/
│   │       ├── cli.test.ts
│   │       └── templates/              # Template validity tests
│   │           ├── minimal.test.ts
│   │           ├── fullstack-react.test.ts
│   │           └── api-backend.test.ts
│   └── cli/                            # ix CLI commands
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       ├── src/
│       │   ├── index.ts
│       │   ├── commands/
│       │   │   ├── dev.ts              # ix dev
│       │   │   ├── build.ts            # ix build
│       │   │   ├── deploy.ts           # ix deploy
│       │   │   ├── migrate.ts          # ix migrate
│       │   │   ├── generate.ts         # ix generate
│       │   │   ├── tinker.ts           # ix tinker (REPL)
│       │   │   └── config.ts           # ix config
│       │   ├── generators/
│       │   │   ├── model.ts
│       │   │   ├── migration.ts
│       │   │   └── component.ts
│       │   └── utils/
│       │       ├── wrangler.ts         # Wrangler integration
│       │       └── drizzle.ts          # Drizzle Kit integration
│       └── tests/
│           ├── commands/
│           └── generators/
├── templates/
│   ├── README.md                       # Template overview
│   ├── ci/                             # CI/CD templates
│   │   ├── github-actions.yml
│   │   └── gitlab-ci.yml
│   ├── _fragments/                     # Shared template fragments
│   │   ├── base-config.ts
│   │   ├── eslint-base.js
│   │   └── tsconfig-base.json
│   ├── minimal/                        # Minimal starter (MVP)
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── edge.config.ts
│   │   ├── wrangler.toml
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── .env.example
│   │   └── src/
│   │       ├── index.ts
│   │       └── routes/
│   │           └── index.ts
│   ├── fullstack-react/                # Full-stack React (MVP)
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── edge.config.ts
│   │   ├── wrangler.toml
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── .env.example
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       │   ├── index.tsx
│   │       │   └── api/
│   │       │       └── users.ts
│   │       ├── components/
│   │       │   └── ui/
│   │       ├── features/
│   │       ├── schemas/
│   │       └── types/
│   └── api-backend/                    # API-only backend (MVP)
│       ├── README.md
│       ├── package.json
│       ├── edge.config.ts
│       ├── wrangler.toml
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── .env.example
│       └── src/
│           ├── index.ts
│           ├── routes/
│           │   └── api/
│           │       └── v1/
│           ├── models/
│           ├── services/
│           └── schemas/
├── tests/
│   ├── integration/                    # Cross-package integration tests
│   │   ├── runtime-cli.test.ts
│   │   └── vite-plugin-runtime.test.ts
│   └── e2e/                            # Full framework E2E tests
│       ├── create-and-deploy.test.ts
│       └── template-smoke.test.ts
└── examples/                           # Working example applications
    ├── README.md
    ├── todo-app/                       # Simple todo application
    │   ├── README.md
    │   ├── package.json
    │   └── src/
    └── api-example/                    # API-focused example
        ├── README.md
        ├── package.json
        └── src/
```

## Architectural Boundaries

**API Boundaries:**

| Boundary | Location | Responsibility |
|----------|----------|----------------|
| Public API | `packages/ixflare/src/index.ts` | Framework exports for users |
| ORM API | `packages/ixflare/src/edge-record/index.ts` | EdgeRecord exports (subpath) |
| SSR API | `packages/ixflare/src/ssr/index.ts` | SSR exports (subpath) |
| CLI Commands | `packages/cli/src/commands/` | User-facing CLI interface |
| Vite Plugin | `packages/vite-plugin-ixflare/src/index.ts` | Build-time integration |

**Component Boundaries:**

| Component | Runs In | Depends On |
|-----------|---------|------------|
| `ixflare` runtime | Workers V8 | Nothing (zero deps) |
| `vite-plugin-ixflare` | Node.js | `ixflare` types, Vite |
| `create-ixflare` | Node.js | Templates directory |
| `cli` | Node.js | `ixflare` types, Wrangler, Drizzle Kit |

**Service Boundaries:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Application                          │
├─────────────────────────────────────────────────────────────────┤
│  Routes  │  Components  │  Services  │  Schemas  │  Types       │
├─────────────────────────────────────────────────────────────────┤
│                     ixflare Runtime                              │
│  ┌─────────┐  ┌──────────────┐  ┌──────┐  ┌───────────────┐    │
│  │  Core   │  │  EdgeRecord  │  │ Auth │  │      SSR      │    │
│  │ Router  │  │     ORM      │  │ JWT  │  │   Islands     │    │
│  │  MW     │  │              │  │ OAuth│  │   Streaming   │    │
│  └────┬────┘  └──────┬───────┘  └──┬───┘  └───────┬───────┘    │
├───────┴──────────────┴─────────────┴──────────────┴─────────────┤
│                   Cloudflare Bindings                            │
│        KV         │        D1         │    Durable Objects      │
└─────────────────────────────────────────────────────────────────┘
```

**Data Boundaries:**

| Layer | Storage | Access Pattern |
|-------|---------|----------------|
| Cache | KV | Read-heavy, eventual consistency |
| Primary | D1 | ACID transactions, relational |
| Coordination | Durable Objects | Strong consistency, real-time |

## Requirements to Structure Mapping

**Epic/Feature Mapping:**

| Epic/Feature | Primary Location | Related Locations |
|--------------|------------------|-------------------|
| Routing & Request Handling | `packages/ixflare/src/core/` | `vite-plugin-ixflare/src/router-codegen.ts` |
| EdgeRecord ORM | `packages/ixflare/src/edge-record/` | `cli/src/commands/migrate.ts` |
| Server-Side Rendering | `packages/ixflare/src/ssr/` | `packages/ixflare/src/client/` |
| Middleware & Processing | `packages/ixflare/src/core/middleware.ts` | - |
| CLI Commands | `packages/cli/src/commands/` | - |
| Testing Framework | `packages/ixflare/tests/` | `tests/integration/`, `tests/e2e/` |
| Developer Experience | `packages/cli/src/` | `docs/` |
| Project Lifecycle | `packages/create-ixflare/` | `templates/` |
| Authentication | `packages/ixflare/src/auth/` | - |

**Cross-Cutting Concerns:**

| Concern | Primary Location | Shared By |
|---------|------------------|-----------|
| Configuration | `packages/ixflare/src/config/` | All packages |
| Error Handling | `packages/ixflare/src/errors/` | All runtime code |
| Type Definitions | `packages/ixflare/src/types/shared.ts` | All packages |
| Logging | `packages/ixflare/src/logging/` | Runtime, CLI |
| Validation (Zod) | User's `src/schemas/` | Client + Server |

## Integration Points

**Internal Communication:**

| From | To | Method |
|------|----|--------|
| `cli` | `ixflare` | Import types only |
| `vite-plugin` | `ixflare` | Import config schema |
| `create-ixflare` | `templates/` | File system copy |
| Routes | EdgeRecord | Direct import |
| Routes | Auth | Middleware chain |

**External Integrations:**

| Integration | Package | Purpose |
|-------------|---------|---------|
| Wrangler | `cli`, `vite-plugin` | Deployment, dev server |
| Miniflare | `vite-plugin` | Local Workers simulation |
| Drizzle Kit | `cli` | Migration generation |
| Cloudflare API | `cli` | Direct deployments |

**Data Flow:**

```
Request → Router → Middleware Chain → Route Handler
                                           │
                      ┌────────────────────┴────────────────────┐
                      │                                         │
                      ▼                                         ▼
              EdgeRecord ORM                              SSR Renderer
                      │                                         │
         ┌───────────┼───────────┐                             │
         ▼           ▼           ▼                             ▼
        KV          D1          DO                        Response
       Cache      Primary    Realtime                    (Streaming)
```

## File Organization Patterns

**Configuration Files:**

| File | Location | Purpose |
|------|----------|---------|
| `edge.config.ts` | Project root | Framework configuration |
| `wrangler.toml` | Project root | Cloudflare bindings |
| `vite.config.ts` | Project root | Build configuration |
| `tsconfig.json` | Project root + packages | TypeScript settings |
| `.env` / `.env.example` | Project root | Environment variables |

**Source Organization:**

```
src/
├── index.ts              # Application entry
├── routes/               # File-based routing
│   ├── index.tsx         # / route
│   ├── about.tsx         # /about route
│   └── api/
│       └── v1/
│           └── users.ts  # /api/v1/users route
├── components/           # Shared components
│   └── ui/               # UI primitives
├── features/             # Domain features
│   └── auth/
│       ├── components/
│       ├── hooks/
│       └── utils/
├── models/               # EdgeRecord models
├── schemas/              # Zod validation schemas
├── services/             # Business logic
├── types/                # TypeScript types
└── utils/                # Utilities
```

**Test Organization:**

| Test Type | Location | Runs In |
|-----------|----------|---------|
| Unit (runtime) | `packages/*/tests/` | Vitest |
| Unit (user app) | `tests/` (mirrored) | Vitest |
| Integration | `tests/integration/` | Vitest |
| E2E | `tests/e2e/` | Playwright + Miniflare |
| Template | `packages/create-ixflare/tests/templates/` | Vitest |

**Asset Organization:**

| Asset Type | Location | Served Via |
|------------|----------|------------|
| Static files | `public/` | Direct serve |
| Images | `public/assets/` | Direct serve |
| Fonts | `public/fonts/` | Direct serve |
| CSS | `src/**/*.css` | Vite bundling |

## Development Workflow Integration

**Development Server Structure:**

```bash
ix dev
  │
  ├── Starts Vite dev server
  │     └── vite-plugin-ixflare handles:
  │           ├── File-based route generation
  │           ├── HMR for routes and components
  │           └── Miniflare for Workers simulation
  │
  └── Watches for changes:
        ├── src/**/* → Hot reload
        ├── edge.config.ts → Full restart
        └── wrangler.toml → Binding refresh
```

**Build Process Structure:**

```bash
ix build
  │
  ├── 1. Validate edge.config.ts
  ├── 2. Generate route manifest
  ├── 3. Run Vite build
  │     ├── Tree-shake unused code
  │     ├── Bundle for Workers
  │     └── Generate sourcemaps
  ├── 4. Validate bundle size (<50KB)
  └── 5. Output to dist/
```

**Deployment Structure:**

```bash
ix deploy [--env production]
  │
  ├── 1. Run ix build
  ├── 2. Run pending migrations (if any)
  ├── 3. Upload to Cloudflare
  │     └── Via Wrangler API
  ├── 4. Verify deployment health
  └── 5. Output deployment URL
```

## Package Dependency Graph

```
                    ┌─────────────────┐
                    │  create-ixflare │
                    │   (scaffolder)  │
                    └────────┬────────┘
                             │ copies from
                             ▼
                    ┌─────────────────┐
                    │    templates/   │
                    └────────┬────────┘
                             │ depends on (workspace:*)
                             ▼
┌──────────────────┐  imports   ┌─────────────────┐
│ vite-plugin-     │◄───────────│    ixflare      │
│ ixflare          │  (types)   │  (main runtime) │
│ (build-time)     │            └────────┬────────┘
└──────────────────┘                     │
                                         │ imports (types)
                                         ▼
                              ┌─────────────────┐
                              │      cli        │
                              │  (ix commands)  │
                              └─────────────────┘
```

**Dependency Direction Rules:**
- Runtime (`ixflare`) has ZERO external dependencies
- Build tools can depend on runtime types
- CLI can depend on runtime types
- Templates use `workspace:*` during dev, pinned version at publish

## Code Environment Classification

| Classification | Marker | Runs In | Example Files |
|----------------|--------|---------|---------------|
| `@universal` | JSDoc tag | Node.js + Workers | `config/schema.ts`, `types/shared.ts` |
| `@node-only` | JSDoc tag | Node.js only | All CLI, vite-plugin |
| `@worker-only` | JSDoc tag | Workers only | Route handlers, SSR |

**Enforcement:**
- `eslint-plugin-ixflare` validates environment boundaries
- Build fails if `@node-only` code imported in `@worker-only` context
