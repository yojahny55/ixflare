# Epic Structure Plan

## Design Principles Applied

1. **User-Value First**: Each epic enables developers to accomplish something meaningful
2. **Architecture Alignment**: Follows the implementation sequence from Architecture document
3. **Incremental Delivery**: Each epic is independently valuable and deployable
4. **Natural Dependencies**: Dependencies flow from technical necessity, not artificial constraints

## Epic Overview

| Epic | Title | User Value | FRs Covered | Dependencies |
|------|-------|------------|-------------|--------------|
| 1 | Foundation & Project Setup | Developers can create and configure new Ixflare projects | 25 FRs | None |
| 2 | Core Runtime & Routing | Developers can define routes and handle HTTP requests | 21 FRs | Epic 1 |
| 3 | EdgeRecord ORM & Data Layer | Developers can model, query, and persist data across storage tiers | 19 FRs | Epic 2 |
| 4 | Server-Side Rendering & Frontend | Developers can build React applications with SSR and selective hydration | 12 FRs | Epic 2, 3 |
| 5 | Authentication & Security | Developers can implement secure auth flows and protect their applications | 14 FRs | Epic 2, 3 |
| 6 | CLI Developer Experience | Developers can use productive CLI commands for development workflow | 25 FRs | Epic 1-5 |
| 7 | Testing Framework | Developers can write and run comprehensive tests | 12 FRs | Epic 1-5 |
| 8 | Deployment & Production | Developers can deploy, monitor, and maintain production applications | 20 FRs | Epic 1-7 |
| 9 | Documentation & Onboarding | Developers can learn and get help effectively | 11 FRs | Epic 1-8 |
| 10 | Templates & Polish | Developers can start from production-ready templates | 9 FRs | Epic 1-9 |

**Total: 168 FRs across 10 epics**

---

## Epic 1: Foundation & Project Setup

**User Value Statement:** Developers can create new Ixflare projects with a single command, selecting their preferred project type and package manager, with proper TypeScript configuration and project structure ready for development.

**PRD Coverage:** FR1-FR7, FR122-FR124, FR143, FR145, FR107, FR169-FR170, FR141-FR142

**Technical Context (Architecture):**
- Monorepo structure with pnpm workspaces
- `create-ixflare` package for project scaffolding
- `edge.config.ts` as framework-owned configuration
- Environment variable precedence: wrangler.toml → .env.production → .env.local → .env
- Code environment classification: `@universal`, `@node-only`, `@worker-only`

**UX Integration:**
- First-Time Setup Flow stages 1-2 (Discovery & Project Initialization)
- Terminal Output Component for CLI feedback
- Progress indicators for installation

**Dependencies:** None (foundation epic)

**Stories:** 8 stories covering project creation, configuration, and environment setup

---

## Epic 2: Core Runtime & Routing

**User Value Statement:** Developers can define type-safe routes using file-based conventions, handle HTTP requests with proper method handlers, and compose middleware chains for request processing.

**PRD Coverage:** FR8-FR14, FR30-FR35, FR116-FR119, FR128, FR160-FR162, FR171

**Technical Context (Architecture):**
- `packages/ixflare/src/core/` for router and middleware
- File-based routing with automatic discovery
- `vite-plugin-ixflare` for route codegen
- Middleware composition with typed context
- Rate limiting strategies (IP, user, API key based)

**UX Integration:**
- First-Time Setup Flow stage 3 (Local Development)
- Hot reload feedback (<200ms)
- Error messages with actionable suggestions

**Dependencies:** Epic 1 (project structure must exist)

**Stories:** 10 stories covering routing, middleware, and request handling

---

## Epic 3: EdgeRecord ORM & Data Layer

**User Value Statement:** Developers can define data models with type-safe schemas, perform CRUD operations, and leverage automatic caching across Cloudflare's storage tiers (KV, D1, Durable Objects) without managing complexity.

**PRD Coverage:** FR15-FR23, FR101, FR125-FR127, FR148, FR150-FR152, FR166, FR176

**Technical Context (Architecture):**
- `packages/ixflare/src/edge-record/` for ORM implementation
- TypeScript schema objects (Drizzle-style)
- Drizzle Kit for migration generation
- Automatic tier selection: KV (cache) → D1 (relational) → DO (coordination)
- Cache strategy presets: `read-heavy`, `write-heavy`, `balanced`
- `.with()` eager loading to prevent N+1 queries

**UX Integration:**
- First-Time Setup Flow stage 4 (First Database Query)
- Query response <10ms locally
- EdgeRecord API reference documentation

**Dependencies:** Epic 2 (routes needed to expose data)

**Stories:** 12 stories covering models, queries, relationships, caching, and migrations

---

## Epic 4: Server-Side Rendering & Frontend

**User Value Statement:** Developers can build React applications that render on the edge with streaming HTML, selective hydration for interactivity, and optimized client bundles.

**PRD Coverage:** FR24-FR29, FR153-FR155, FR158-FR159, FR105

**Technical Context (Architecture):**
- `packages/ixflare/src/ssr/` for SSR utilities
- React 19 with Server Components and Actions
- Hydration detection: `*.client.tsx` file convention + `island = true` export
- Automatic island code-splitting (one chunk per client component)
- Abort controller integration for streaming
- Server-only code removal from client bundles

**UX Integration:**
- Design System: Tailwind CSS default + Headless UI
- Component Strategy specifications
- Code Block with Copy Component for examples

**Dependencies:** Epic 2 (router), Epic 3 (data fetching in loaders)

**Stories:** 8 stories covering SSR, streaming, hydration, and frontend tooling

---

## Epic 5: Authentication & Security

**User Value Statement:** Developers can implement secure authentication flows with JWT tokens, session management, and authorization patterns while the framework handles security best practices automatically.

**PRD Coverage:** FR79-FR80, FR129, FR138-FR140, plus auth-related aspects from Architecture

**Technical Context (Architecture):**
- `packages/ixflare/src/auth/` for authentication
- Custom WebCrypto JWT (~2KB, jose-compatible API)
- Single algorithm enforcement (ES256 OR HS256)
- Short-lived access tokens (15m default)
- Automatic key rotation (30d interval, 24h grace)
- OAuth primitives + optional adapters
- Hybrid RBAC + Policies authorization
- Session: JWT → KV → DO hybrid model
- CSRF tokens on all state-changing operations
- Security headers auto-injection (CSP, HSTS, etc.)

**UX Integration:**
- Enterprise Evaluation Flow security requirements
- Security audit badges in Plugin Card Component

**Dependencies:** Epic 2 (middleware), Epic 3 (session storage)

**Stories:** 9 stories covering JWT, sessions, OAuth, authorization, and security hardening

---

## Epic 6: CLI Developer Experience

**User Value Statement:** Developers can use intuitive CLI commands for local development, code generation, database management, and debugging with fast feedback loops and helpful error messages.

**PRD Coverage:** FR42-FR47, FR50-FR52, FR96, FR102-FR104, FR108, FR110-FR111, FR113, FR133, FR147, FR163-FR164, FR167

**Technical Context (Architecture):**
- `packages/cli/src/commands/` for all CLI commands
- Vite integration via `vite-plugin-ixflare`
- Miniflare for local Workers simulation
- Drizzle Kit integration for migrations
- HMR with state preservation
- `ix tinker` REPL for interactive debugging

**UX Integration:**
- Terminal Output Component (status indicators, OS-specific errors)
- Progress Stepper for multi-step operations
- Color-coded output with --no-color flag
- Progressive help system

**Dependencies:** Epic 1-5 (CLI commands interact with all subsystems)

**Stories:** 14 stories covering dev server, build, generation, migrations, and DX features

---

## Epic 7: Testing Framework

**User Value Statement:** Developers can write and run comprehensive unit and integration tests that accurately simulate the edge execution environment, with proper mocking utilities and coverage reporting.

**PRD Coverage:** FR36-FR41, FR130-FR132

**Technical Context (Architecture):**
- Vitest as test runner
- Miniflare for Workers simulation
- Test file location: mirrored `tests/` structure
- Fixture management for reusable test data
- Coverage gates in CI
- Snapshot testing for SSR output
- Test orphan detection

**UX Integration:**
- CI/CD integration for automated testing
- Coverage reports with configurable thresholds

**Dependencies:** Epic 1-5 (tests need working subsystems to test)

**Stories:** 7 stories covering unit tests, integration tests, mocking, fixtures, and CI integration

---

## Epic 8: Deployment & Production

**User Value Statement:** Developers can deploy their applications to Cloudflare Workers with confidence, manage multiple environments, monitor production health, and rollback if issues occur.

**PRD Coverage:** FR69-FR74, FR103, FR165, FR168, FR134, FR156-FR157, plus health checks, compression, graceful shutdown

**Technical Context (Architecture):**
- `ix deploy` with automatic wrangler.toml generation
- Multi-environment support (dev, staging, production)
- Bundle size validation (<1MB for Workers)
- Deployment history for rollback
- Post-deployment smoke test
- Health check endpoints (`/_health`)
- Request ID tracking across edge locations
- Response compression (Gzip/Brotli)
- WebSocket support via Durable Objects

**UX Integration:**
- First-Time Setup Flow stage 5 (Production Deployment)
- Deployment sequence visualization
- Metrics Dashboard Component for monitoring

**Dependencies:** Epic 1-7 (full application must be testable before deploy)

**Stories:** 11 stories covering deployment, environments, monitoring, and production operations

---

## Epic 9: Documentation & Onboarding

**User Value Statement:** Developers can quickly find answers in comprehensive documentation, complete interactive tutorials, and get help through community channels when stuck.

**PRD Coverage:** FR55-FR60, FR174, FR109, FR136-FR137

**Technical Context (Architecture):**
- `docs/` directory structure with getting-started, guides, api-reference
- Auto-generated API reference from TypeScript types
- Role-based navigation (Frontend, Backend, Fullstack, Infrastructure)

**UX Integration:**
- Documentation Discovery Flow
- Learning & Onboarding Flow (8 tutorial modules)
- Search with Instant Results Component
- Code Block with Copy Component
- Interactive Code Editor Component
- Progress Stepper for tutorials

**Dependencies:** Epic 1-8 (docs must cover working features)

**Stories:** 8 stories covering Quick Start, Core Concepts, API Reference, Troubleshooting, and interactive tutorials

---

## Epic 10: Templates & Polish

**User Value Statement:** Developers can start projects from production-ready templates with best practices built-in, and the framework provides polished UX touches that make development delightful.

**PRD Coverage:** FR62-FR65, FR97, FR100, FR112, FR114-FR115

**Technical Context (Architecture):**
- `templates/` directory with minimal, fullstack-react, api-backend
- Template composition from shared `_fragments/`
- Template CI validation (tests pass, no broken examples)
- Template health indicators (test status, freshness, dependencies)

**UX Integration:**
- Template selection in First-Time Setup Flow
- Plugin Card Component for template browsing
- Certification Badge Component for template health
- Visual checkpoint confirmation

**Dependencies:** Epic 1-9 (templates must demonstrate working features)

**Stories:** 6 stories covering template creation, health validation, and UX polish

---
