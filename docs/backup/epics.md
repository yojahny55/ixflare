# Ixflare (cloudfare-edge-framework) - Epic Breakdown

**Author:** Yojahny
**Date:** 2025-12-04
**Project Level:** Fullstack Framework
**Target Scale:** Edge-native, Global Distribution (300+ Cloudflare locations)

---

## Overview

This document provides the complete epic and story breakdown for Ixflare, decomposing the requirements from the [PRD](./prd/index.md) into implementable stories with full technical context from [Architecture](./architecture/index.md) and [UX Design](./ux-design-specification/index.md).

**Living Document Notice:** Stories include complete implementation details from all three source documents.

---

## Context Validation

### Documents Loaded

| Document | Status | Location |
|----------|--------|----------|
| PRD | ✅ Loaded | `docs/prd/` (sharded, 11 files) |
| Architecture | ✅ Loaded | `docs/architecture/` (sharded, 8 files) |
| UX Design | ✅ Loaded | `docs/ux-design-specification/` (sharded, 14 files) |

### Key Context Summary

**From PRD:**
- **Total MVP FRs:** 168 functional requirements
- **Core Features:** Routing (11 FRs), EdgeRecord ORM (17 FRs), SSR (9 FRs), Middleware (10 FRs), CLI (17 FRs), Testing (9 FRs), DX Polish (9 FRs)
- **Infrastructure:** Project Lifecycle (48 FRs), Cross-Cutting Concerns (38 FRs)
- **Target Users:** Jordan (experienced devs), Alex (beginners), Sarah (enterprise)

**From Architecture:**
- **Package Structure:** Monorepo with `ixflare` (runtime ~39KB), `vite-plugin-ixflare`, `create-ixflare`, `cli`
- **Data Architecture:** TypeScript schemas (Drizzle-style), D1 primary, KV cache, DO coordination
- **Auth:** Custom WebCrypto JWT (~2KB), OAuth primitives, RBAC + Policies
- **Frontend:** React 19, file convention hydration (`*.client.tsx`), Tailwind default
- **Implementation Sequence:** Monorepo → Core runtime → Config → EdgeRecord → Auth → CLI → SSR → Logging → Templates

**From UX Design:**
- **Design System:** Tailwind CSS + Headless UI + React
- **Critical Flows:** First-time setup (<30min to deploy), Documentation discovery, Plugin development, Learning/onboarding, Enterprise evaluation, Contribution
- **Custom Components:** Terminal Output, Code Block, Progress Stepper, Search, Plugin Card, Certification Badge, Metrics Dashboard, Interactive Code Editor, Request Waterfall, Status Timeline

---

## Functional Requirements Inventory

### MVP Functional Requirements (168 Total)

#### Core Features (82 FRs)

**1. Routing & Request Handling (11 FRs)**
- FR8: File-based route conventions
- FR9: Nested route layouts with parent-child relationships
- FR10: Type-safe route parameters with validation
- FR11: API routes with HTTP method handlers (GET, POST, PUT, DELETE, PATCH)
- FR12: Route loaders for data fetching
- FR13: Automatic route discovery from file structure
- FR14: Route conflict handling with clear errors
- FR116: Request body parsing with content-type detection
- FR117: Typed responses (JSON, HTML, binary, stream)
- FR118: HTTP header reading/setting
- FR119: Type-safe query parameter parsing

**2. EdgeRecord ORM (17 FRs)**
- FR15: Type-safe model schemas
- FR16: CRUD operations with consistent API across tiers
- FR17: Automatic storage tier selection (KV/D1/DO)
- FR18: Automatic caching of frequently accessed data
- FR19: Automatic cache invalidation
- FR20: Database migrations for schema changes
- FR21: Type-safe query builders
- FR22: Model relationships (one-to-many, many-to-many)
- FR23: Multi-tier data consistency handling
- FR101: Consistency requirements per model
- FR125: Transactions with automatic rollback
- FR126: Database seeding for dev/testing
- FR127: Soft deletes with automatic filtering
- FR148: Pagination helpers (offset, cursor-based)
- FR150: Sensible tier selection defaults
- FR151: Override automatic tier selection
- FR152: Data migration between tiers based on access patterns
- FR166: D1 connection pooling
- FR176: TTL configuration for caching

**3. Server-Side Rendering (9 FRs)**
- FR24: React component rendering at edge
- FR25: Progressive HTML streaming
- FR26: Selective component hydration
- FR27: Per-route rendering strategy optimization
- FR28: SSR error boundaries with graceful degradation
- FR29: Rendered HTML caching at edge
- FR153: Streaming error boundaries with fallback HTML
- FR154: `<head>` before `<body>` enforcement
- FR155: Hydration manifest generation

**4. Middleware & Request Processing (10 FRs)**
- FR30: Type-safe middleware functions
- FR31: Middleware composition chains
- FR32: Global and route-group middleware
- FR33: Typed context through middleware chain
- FR34: Request/response transformation patterns
- FR35: Middleware error boundaries
- FR128: Built-in edge-native rate limiting
- FR160: Configurable rate limiting strategies
- FR161: Configurable rate limiting windows/thresholds
- FR162: Rate limit exceeded responses (429 + Retry-After)
- FR171: Individual route middleware

**5. CLI Commands (17 FRs)**
- FR42: Local dev server with HMR
- FR43: Production bundle optimization
- FR44: Deploy to Cloudflare Workers
- FR45: Local production preview
- FR46: Dependency management with type safety
- FR47: Database migrations from CLI
- FR102: TypeScript type generation
- FR103: Deployment history for rollback
- FR104: Rescue checkpoints
- FR105: HMR state preservation
- FR106: Tree-shaking, code splitting, minification
- FR107: Environment variable loading with precedence
- FR147: Type checking via CLI
- FR163: Migration rollback
- FR164: Live log streaming
- FR167: Eject to custom configuration
- FR158: Automatic route-based code splitting
- FR159: Server-only code removal from client bundles

**6. Testing Framework (9 FRs)**
- FR36: Unit tests with simulated Workers environment
- FR37: Integration tests for multi-tier storage
- FR38: Type-safe test utilities
- FR39: Local tests simulating edge execution
- FR40: CI/CD integration
- FR41: Route handler testing with mocks
- FR130: Fixture management
- FR131: Coverage reports with thresholds
- FR132: Snapshot testing for SSR

**7. Developer Experience Polish (9 FRs)**
- FR50: Progressive help
- FR51: Rescue checkpoint creation
- FR52: Rescue checkpoint restoration
- FR96: Operation duration tracking
- FR108: Actionable error messages with docs links
- FR110: Progress indicators for >5s operations
- FR111: Color-coded CLI output with --no-color
- FR113: Wizard and quickstart modes
- FR133: Framework version notifications
- FR134: WebSocket connections via Durable Objects
- FR136: Interactive Quick Start playground
- FR137: Error messages with syntax highlighting
- FR156: WebSocket routing helpers
- FR157: WebSocket auto-reconnection

#### Infrastructure & Foundation (86 FRs)

**8. Project Lifecycle (48 FRs)**

*Initialization & Setup (12 FRs):*
- FR1: Single command project creation
- FR2: Project type selection
- FR3: Starter template selection
- FR4: Package manager preference
- FR5: Auto-detect package manager
- FR6: Project structure generation
- FR7: TypeScript configuration scaffolding
- FR122: Minimal template with example patterns
- FR123: Automatic dependency installation
- FR124: First-time deployment guidance
- FR143: Deployed URL display
- FR145: .gitignore generation

*Templates (6 FRs):*
- FR62: Template browsing
- FR63: Core template initialization
- FR64: Template metadata display
- FR65: Template health indicators
- FR97: Template health dashboard
- FR100: Template CI validation

*Documentation (7 FRs):*
- FR55: Quick Start guide (<5 min)
- FR56: Core Concepts documentation
- FR57: Deep Dive guides
- FR58: Auto-generated API reference
- FR59: Troubleshooting hub (top 10 errors)
- FR60: Role-based documentation navigation
- FR174: Copy-paste recipe library

*Deployment (8 FRs):*
- FR69: Single command deployment
- FR70: Edge-optimized bundles
- FR71: Multi-environment deployment
- FR72: Per-environment settings
- FR73: Deployment configuration validation
- FR74: Deployment rollback
- FR165: Environment variable display before deploy
- FR168: Post-deployment smoke test

*Configuration & Environment (7 FRs):*
- Environment variable management
- Secrets management
- Configuration validation
- Edge location testing
- Framework version compatibility
- FR169: Environment-specific secrets
- FR170: Request size limit validation

*Migration (4 FRs):*
- FR75: Project type migration
- FR76: Add frontend to api-backend
- FR77: Remove frontend from fullstack
- FR78: Migration plan generation

*Productivity Tools (4 FRs):*
- Database GUI (`ix db:studio`)
- Performance budgets
- FR144: Static asset serving
- FR173: Local D1 database for offline dev

**9. Cross-Cutting Concerns (38 FRs)**

*Security (8 FRs):*
- FR79: CSRF protection
- FR80: Secure cookie handling
- FR129: XSS prevention (auto-sanitization)
- FR138: Dependency vulnerability scanning
- FR139: Secret encryption and log redaction
- FR140: HTTP to HTTPS redirect

*Error Handling (4 FRs):*
- Client-side error boundaries
- Custom error pages (404, 500)
- Error logging
- Graceful degradation

*HTTP Standards (6 FRs):*
- Health check endpoints
- Request ID tracking
- Response compression
- Redirect management
- CORS preflight optimization
- Graceful Worker shutdown

*Edge-Native Constraints (5 FRs):*
- Bundle size validation (1MB limit)
- CPU time limit warnings
- Memory usage warnings
- FR120: Global state persistence warnings
- FR121: Edge location metadata access

*Performance & Caching (1 FR):*
- Cache-Control header management

*Extensibility (2 FRs):*
- FR141: Lifecycle hooks for plugins
- FR142: Custom CLI commands

*UX Enhancements - Tier 2 (4 FRs):*
- FR109: Troubleshooting search (beta)
- FR112: Template preview screenshots (beta)
- FR114: Detailed health indicators (beta)
- FR115: Checkpoint visual confirmation (beta)

---

## Epic Structure Plan

### Design Principles Applied

1. **User-Value First**: Each epic enables developers to accomplish something meaningful
2. **Architecture Alignment**: Follows the implementation sequence from Architecture document
3. **Incremental Delivery**: Each epic is independently valuable and deployable
4. **Natural Dependencies**: Dependencies flow from technical necessity, not artificial constraints

### Epic Overview

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

### Epic 1: Foundation & Project Setup

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

### Epic 2: Core Runtime & Routing

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

### Epic 3: EdgeRecord ORM & Data Layer

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

### Epic 4: Server-Side Rendering & Frontend

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

### Epic 5: Authentication & Security

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

### Epic 6: CLI Developer Experience

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

### Epic 7: Testing Framework

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

### Epic 8: Deployment & Production

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

### Epic 9: Documentation & Onboarding

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

### Epic 10: Templates & Polish

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

## Technical Context Summary

### Implementation Sequence (from Architecture)

1. **Epic 1:** Monorepo structure + build pipeline
2. **Epic 2:** Core runtime with router + middleware
3. **Epic 3:** EdgeRecord ORM with Drizzle Kit
4. **Epic 4:** SSR + Islands architecture
5. **Epic 5:** Authentication system
6. **Epic 6:** CLI commands
7. **Epic 7:** Testing framework
8. **Epic 8:** Deployment + production operations
9. **Epic 9:** Documentation
10. **Epic 10:** Templates + polish

### Cross-Component Dependencies (from Architecture)

- EdgeRecord depends on: config system, D1/KV bindings
- Auth depends on: session (KV/DO), config system
- SSR depends on: router, hydration detection, React 19
- CLI depends on: config system, Drizzle Kit, Vite

### Package Ownership

| Package | Epic Coverage |
|---------|---------------|
| `ixflare` (runtime) | Epic 2, 3, 4, 5 |
| `vite-plugin-ixflare` | Epic 2, 4, 6 |
| `create-ixflare` | Epic 1, 10 |
| `cli` | Epic 6, 7, 8 |

---

## Epic 1: Foundation & Project Setup

**Epic Goal:** Enable developers to create new Ixflare projects with a single command, with proper configuration, TypeScript setup, and project structure ready for development.

**FR Coverage:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR107, FR122, FR123, FR124, FR141, FR142, FR143, FR145, FR169, FR170

---

### Story 1.1: Monorepo Structure & Build Pipeline

As a **framework developer**,
I want the Ixflare monorepo to be properly structured with build tooling,
So that all packages can be developed, tested, and published consistently.

**Acceptance Criteria:**

**Given** I clone the Ixflare repository
**When** I run `pnpm install`
**Then** all workspace dependencies are installed correctly

**And** the following package structure exists:
```
ixflare/
├── packages/
│   ├── ixflare/           # Main runtime (~39KB max)
│   ├── vite-plugin-ixflare/  # Vite integration (Node.js only)
│   ├── create-ixflare/    # Project scaffolder
│   └── cli/               # ix CLI commands
├── templates/
│   ├── minimal/
│   ├── fullstack-react/
│   └── api-backend/
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

**And** `pnpm build` compiles all packages in dependency order
**And** `pnpm test` runs all package tests
**And** `pnpm lint` validates code quality across all packages

**Technical Notes:**
- Use pnpm workspaces for package management (Architecture: Simplified Package Structure)
- Use Turborepo for build orchestration (Architecture: turbo.json)
- Use tsup for package bundling (Architecture: tsup.config.ts)
- Shared TypeScript config in `tsconfig.base.json`
- ESLint with `eslint-plugin-ixflare` for code boundary enforcement

**Prerequisites:** None (first story)

---

### Story 1.2: Create-Ixflare Scaffolder CLI

As a **developer**,
I want to create a new Ixflare project with `npx create-ixflare-app my-app`,
So that I can start building without manual setup.

**Acceptance Criteria:**

**Given** I have Node.js 18+ installed
**When** I run `npx create-ixflare-app my-app`
**Then** I am prompted to select a project type:
  - fullstack (React + API)
  - api-backend (API only)
  - minimal (bare minimum)

**And** I am prompted to select a package manager (npm, pnpm, bun)
**And** the project is created in `./my-app/` directory
**And** dependencies are automatically installed (FR123)
**And** I see the deployed application URL format in success message (FR143)

**Given** a lockfile exists in current directory (package-lock.json, pnpm-lock.yaml, bun.lockb)
**When** I run `npx create-ixflare-app` without specifying package manager
**Then** the package manager is auto-detected from the lockfile (FR5)

**Given** I want to skip prompts
**When** I run `npx create-ixflare-app my-app --template api-backend --pm pnpm`
**Then** the project is created with specified options without prompts

**Technical Notes:**
- Implement in `packages/create-ixflare/src/` (Architecture: Project Structure)
- Use `prompts` or `enquirer` for interactive CLI
- Copy templates from `templates/` directory
- Replace template variables (project name, etc.)
- Run `pnpm install` / `npm install` / `bun install` based on selection

**Prerequisites:** Story 1.1

---

### Story 1.3: Project Type Selection & Structure Generation

As a **developer**,
I want to select my project type during initialization,
So that I get the appropriate file structure for my use case.

**Acceptance Criteria:**

**Given** I select "fullstack" project type (FR2)
**When** the project is created
**Then** the following structure is generated (FR6):
```
my-app/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── index.tsx        # / route (SSR)
│   │   └── api/
│   │       └── v1/
│   │           └── users.ts  # /api/v1/users
│   ├── components/
│   ├── models/
│   ├── schemas/
│   └── types/
├── public/
├── tests/
├── edge.config.ts
├── wrangler.toml
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── .gitignore
```

**Given** I select "api-backend" project type
**When** the project is created
**Then** no React/frontend files are included
**And** the `src/routes/` contains only API route examples

**Given** I select "minimal" project type
**When** the project is created
**Then** only essential files are included (FR122):
  - Example route demonstrating routing pattern
  - Example EdgeRecord model demonstrating ORM
  - Example test demonstrating testing pattern

**Technical Notes:**
- Templates in `templates/minimal/`, `templates/fullstack-react/`, `templates/api-backend/`
- Use shared fragments from `templates/_fragments/` (Architecture: Template Composition)
- Generate appropriate `.gitignore` for edge projects (FR145)

**Prerequisites:** Story 1.2

---

### Story 1.4: Edge Configuration System

As a **developer**,
I want a centralized `edge.config.ts` file for framework configuration,
So that I have a single source of truth for my application settings.

**Acceptance Criteria:**

**Given** a new project is created
**When** I open `edge.config.ts`
**Then** I see a typed configuration file with sensible defaults:
```typescript
import { defineConfig } from 'ixflare'

export default defineConfig({
  // Application name (used in deployment)
  name: 'my-app',

  // Environment configuration
  env: {
    // Loaded from wrangler.toml → .env.production → .env.local → .env
  },

  // Database configuration
  database: {
    // D1 binding name
    binding: 'DB',
    // Connection warmup for cold starts
    warmup: true,
  },

  // Cache configuration
  cache: {
    // KV binding name
    binding: 'CACHE',
    // Default TTL in seconds
    defaultTtl: 3600,
  },

  // Security defaults
  security: {
    csrf: true,
    headers: true, // Auto-inject CSP, HSTS, etc.
  },
})
```

**And** TypeScript provides full autocomplete for all options
**And** invalid configuration fails with clear error messages

**Given** environment variables exist in multiple files
**When** the application loads configuration
**Then** variables are merged with precedence (FR107):
  1. wrangler.toml (highest priority)
  2. .env.production (production only)
  3. .env.local (local overrides, gitignored)
  4. .env (default values)

**Technical Notes:**
- Implement in `packages/ixflare/src/config/` (Architecture: Config Schema)
- Use Zod for configuration validation (Architecture: Validation)
- Export `defineConfig` helper for type inference
- Config loader in `packages/ixflare/src/config/loader.ts`

**Prerequisites:** Story 1.1

---

### Story 1.5: TypeScript Configuration & Type Safety

As a **developer**,
I want TypeScript configured correctly for edge development,
So that I get full type safety and IDE support.

**Acceptance Criteria:**

**Given** a new project is created
**When** I open `tsconfig.json`
**Then** it extends the base Ixflare TypeScript config (FR7):
```json
{
  "extends": "@ixflare/tsconfig/base",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "edge.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**And** the following TypeScript features are enabled:
  - Strict mode for maximum type safety
  - Path aliases (`@/` → `src/`)
  - ESNext target for modern JavaScript
  - Module resolution for Workers environment

**Given** I write code that violates environment boundaries
**When** I import `@node-only` code in a `@worker-only` file
**Then** ESLint shows an error (Architecture: Code Environment Classification)

**Given** I write route handlers
**When** I use the Ixflare API
**Then** I get full autocomplete for Request, Response, Context types

**Technical Notes:**
- Base config in `packages/ixflare/tsconfig.base.json`
- Use `@/*` path alias consistently (Architecture: Import Path Aliases)
- Configure `eslint-plugin-ixflare` for environment boundary checking
- Workers-specific lib types included

**Prerequisites:** Story 1.1

---

### Story 1.6: Environment Variable Management

As a **developer**,
I want environment variables managed securely across environments,
So that I can configure my application without hardcoding secrets.

**Acceptance Criteria:**

**Given** a new project is created
**When** I check the project structure
**Then** I see `.env.example` with documented variables:
```env
# Database
DATABASE_URL=

# Authentication
JWT_SECRET=

# External Services
API_KEY=
```

**And** `.env.local` is listed in `.gitignore`
**And** `.env` contains non-sensitive defaults

**Given** I have environment-specific secrets (FR169)
**When** I create `.env.production` and `.env.staging`
**Then** the correct file is loaded based on deployment target
**And** secrets are encrypted in configuration (Architecture: Security)
**And** secrets are redacted from logs and error messages

**Given** I access an environment variable in code
**When** the application runs
**Then** I can access it via typed `env` object:
```typescript
// In route handler
export async function loader({ env }: LoaderArgs) {
  const apiKey = env.API_KEY // TypeScript knows the type
}
```

**Technical Notes:**
- Use `dotenv` for local development
- Wrangler handles production environment variables
- Implement secret redaction in error handling (Architecture: Security)
- Generate TypeScript types from `.env.example`

**Prerequisites:** Story 1.4

---

### Story 1.7: Lifecycle Hooks & Extensibility

As a **developer**,
I want lifecycle hooks for build and deployment events,
So that I can customize the framework behavior and integrate with other tools.

**Acceptance Criteria:**

**Given** I want to run custom code before/after build
**When** I configure lifecycle hooks in `edge.config.ts` (FR141):
```typescript
export default defineConfig({
  hooks: {
    'pre-build': async () => {
      // Run before build starts
      console.log('Starting build...')
    },
    'post-build': async ({ outputPath }) => {
      // Run after build completes
      await uploadSourcemaps(outputPath)
    },
    'pre-deploy': async ({ environment }) => {
      // Run before deployment
      await runMigrations(environment)
    },
    'post-deploy': async ({ url }) => {
      // Run after deployment
      await notifySlack(`Deployed to ${url}`)
    },
  },
})
```

**Then** hooks are executed at the appropriate lifecycle stages
**And** hooks receive relevant context (output path, environment, URL)
**And** hook failures stop the pipeline with clear error messages

**Given** I want to add custom CLI commands (FR142)
**When** I configure custom commands in `edge.config.ts`:
```typescript
export default defineConfig({
  commands: {
    'db:seed': {
      description: 'Seed the database with test data',
      handler: async () => {
        // Custom seed logic
      },
    },
  },
})
```

**Then** I can run `ix db:seed` from the CLI
**And** the command appears in `ix --help`

**Technical Notes:**
- Hook system in `packages/cli/src/hooks/`
- Custom commands registered at CLI startup
- Hooks run in Node.js environment (build-time)
- Async hooks supported with proper error handling

**Prerequisites:** Story 1.4

---

### Story 1.8: First-Time Deployment Guidance

As a **new developer**,
I want guided setup for my first Cloudflare deployment,
So that I can deploy without prior Cloudflare experience.

**Acceptance Criteria:**

**Given** I run `ix deploy` for the first time (FR124)
**When** no Cloudflare authentication is configured
**Then** I see a friendly guide:
```
🚀 First-time deployment detected!

To deploy to Cloudflare Workers, you need:
1. A Cloudflare account (free): https://dash.cloudflare.com/sign-up
2. An API token with Workers permissions

Let's set this up:
? Do you have a Cloudflare account? (Y/n)
```

**And** I am guided through:
  - Creating a Cloudflare account (if needed)
  - Generating an API token with correct permissions
  - Storing the token securely

**Given** I complete the setup
**When** deployment succeeds
**Then** I see the live URL (FR143):
```
✓ Deployed successfully!

🌍 Your app is live at: https://my-app.username.workers.dev

Next steps:
  • View logs: ix logs --tail
  • Set up custom domain: ix domains add
  • Learn more: https://ixflare.dev/docs/deployment
```

**Given** request size limits would be exceeded (FR170)
**When** I run `ix build` or `ix deploy`
**Then** I see a clear warning before deployment fails:
```
⚠️ Request size validation:
  - Max request body: 100MB (Cloudflare limit)
  - Your configured limit: 10MB ✓

  Tip: Large file uploads should use R2 presigned URLs.
```

**Technical Notes:**
- Implement in `packages/cli/src/commands/deploy.ts`
- Use Wrangler API for authentication
- Store credentials in `~/.wrangler/` (standard location)
- Validate Cloudflare limits during build (Architecture: Edge-Native Constraints)

**Prerequisites:** Story 1.6

---

**Epic 1 Complete: Foundation & Project Setup**

**Stories Created:** 8
**FR Coverage:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR107, FR122, FR123, FR124, FR141, FR142, FR143, FR145, FR169, FR170
**Technical Context Used:** Monorepo structure, edge.config.ts, TypeScript configuration, environment management
**UX Patterns Incorporated:** Terminal Output Component, First-Time Setup Flow stages 1-2

---

## Epic 2: Core Runtime & Routing

**Epic Goal:** Enable developers to define type-safe routes using file-based conventions, handle HTTP requests with proper method handlers, and compose middleware chains for request processing.

**FR Coverage:** FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR30, FR31, FR32, FR33, FR34, FR35, FR116, FR117, FR118, FR119, FR128, FR160, FR161, FR162, FR171

---

### Story 2.1: File-Based Route Discovery

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

### Story 2.2: Dynamic Route Parameters

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

### Story 2.3: Nested Route Layouts

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

### Story 2.4: HTTP Method Handlers

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

### Story 2.5: Route Loaders for Data Fetching

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

### Story 2.6: Request Body Parsing

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

### Story 2.7: Response Helpers & Typed Responses

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

### Story 2.8: Query Parameter Parsing

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

### Story 2.9: Middleware Composition

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

### Story 2.10: Global & Route-Group Middleware

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

### Story 2.11: Built-in Rate Limiting

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

### Story 2.12: Request/Response Transformation

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

## Epic 3: EdgeRecord ORM & Data Layer

**Epic Goal:** Enable developers to define data models with type-safe schemas, perform CRUD operations, and leverage automatic caching across Cloudflare's storage tiers (KV, D1, Durable Objects) without managing complexity.

**FR Coverage:** FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR101, FR125, FR126, FR127, FR148, FR150, FR151, FR152, FR166, FR176

---

### Story 3.1: Type-Safe Model Schema Definition

As a **developer**,
I want to define data models with type-safe schemas,
So that I get full TypeScript support for my data structures.

**Acceptance Criteria:**

**Given** I want to define a User model
**When** I create `src/models/User.ts`:
```typescript
import { defineModel, field, timestamps } from 'ixflare/orm'

export const User = defineModel('users', {
  id: field.id(),
  email: field.string().unique(),
  name: field.string(),
  role: field.enum(['user', 'admin', 'moderator']).default('user'),
  bio: field.text().nullable(),
  avatarUrl: field.string().nullable(),
  emailVerifiedAt: field.datetime().nullable(),
  ...timestamps(), // createdAt, updatedAt
})

// TypeScript type is automatically inferred
export type User = typeof User.$infer
```
**Then** the model is registered with EdgeRecord (FR15)
**And** TypeScript infers the correct type:
```typescript
type User = {
  id: number
  email: string
  name: string
  role: 'user' | 'admin' | 'moderator'
  bio: string | null
  avatarUrl: string | null
  emailVerifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

**Given** I want to define field validations
**When** I use field modifiers:
```typescript
export const Product = defineModel('products', {
  id: field.id(),
  sku: field.string().unique().min(3).max(50),
  price: field.decimal({ precision: 10, scale: 2 }).positive(),
  stock: field.integer().min(0).default(0),
  status: field.enum(['draft', 'active', 'archived']),
})
```
**Then** validations are enforced on create/update operations

**Technical Notes:**
- Implement in `packages/ixflare/src/edge-record/` (Architecture: Project Structure)
- Drizzle-style schema definition (Architecture: Schema Definition)
- Field types map to D1 SQLite types
- Generate Zod schemas from model definitions for runtime validation

**Prerequisites:** Epic 1, Epic 2

---

### Story 3.2: CRUD Operations with Consistent API

As a **developer**,
I want to perform CRUD operations with a consistent API,
So that I can easily create, read, update, and delete records.

**Acceptance Criteria:**

**Given** I have a User model defined
**When** I perform CRUD operations:
```typescript
// Create
const user = await User.create({
  email: 'alex@example.com',
  name: 'Alex Rivera',
})

// Read by ID
const user = await User.find(1)
const user = await User.findOrFail(1) // Throws NotFoundError

// Read with conditions
const users = await User.where({ role: 'admin' }).all()
const user = await User.where({ email: 'alex@example.com' }).first()

// Update
await user.update({ name: 'Alex R.' })
// or
await User.where({ id: 1 }).update({ name: 'Alex R.' })

// Delete
await user.delete()
// or
await User.where({ id: 1 }).delete()
```
**Then** operations work consistently across all models (FR16)
**And** all operations return properly typed results

**Given** I want to create or update based on existence
**When** I use upsert:
```typescript
const user = await User.upsert(
  { email: 'alex@example.com' },  // Match criteria
  { name: 'Alex Rivera', role: 'user' }  // Values to set
)
```
**Then** the record is created if not found, or updated if found

**Given** I want to bulk operations
**When** I use bulk methods:
```typescript
// Bulk create
const users = await User.createMany([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' },
])

// Bulk update
await User.where({ role: 'user' }).update({ role: 'member' })

// Bulk delete
await User.where({ createdAt: { lt: oneYearAgo } }).delete()
```
**Then** operations are performed efficiently in batches

**Technical Notes:**
- ActiveRecord-style API for familiarity
- Return model instances, not plain objects
- Auto-transform: DB `snake_case` → API `camelCase` (Architecture: Naming Conventions)
- Timestamps automatically managed on create/update

**Prerequisites:** Story 3.1

---

### Story 3.3: Type-Safe Query Builder

As a **developer**,
I want a fluent query builder with full type safety,
So that I can construct complex queries with IDE support.

**Acceptance Criteria:**

**Given** I want to query with conditions
**When** I use the query builder (FR21):
```typescript
const users = await User
  .where({ role: 'admin' })
  .where('createdAt', '>', lastMonth)
  .orderBy('name', 'asc')
  .limit(10)
  .all()
```
**Then** the query is built correctly with full TypeScript support
**And** invalid field names cause compile-time errors

**Given** I want to use complex conditions
**When** I build the query:
```typescript
const users = await User
  .where({
    role: { in: ['admin', 'moderator'] },
    emailVerifiedAt: { isNotNull: true },
    createdAt: { gte: startDate, lte: endDate },
  })
  .orWhere({ email: { like: '%@company.com' } })
  .all()
```
**Then** conditions are combined with AND/OR logic correctly

**Given** I want to select specific fields
**When** I use select:
```typescript
const emails = await User
  .select('id', 'email', 'name')
  .where({ role: 'admin' })
  .all()
// Type: { id: number, email: string, name: string }[]
```
**Then** only selected fields are returned and typed

**Given** I want aggregate queries
**When** I use aggregate methods:
```typescript
const count = await User.where({ role: 'admin' }).count()
const total = await Order.where({ status: 'completed' }).sum('amount')
const average = await Product.avg('price')
const stats = await Order.groupBy('status').count()
```
**Then** aggregate results are properly typed

**Technical Notes:**
- Builder pattern with immutable query objects
- Type-safe field references using keyof
- Compile-time validation of field names
- SQL injection prevention via parameterized queries

**Prerequisites:** Story 3.2

---

### Story 3.4: Model Relationships

As a **developer**,
I want to define relationships between models,
So that I can easily fetch related data.

**Acceptance Criteria:**

**Given** I define relationships in models (FR22):
```typescript
export const User = defineModel('users', {
  id: field.id(),
  email: field.string().unique(),
  name: field.string(),
}, {
  relations: {
    posts: hasMany(Post, 'authorId'),
    profile: hasOne(Profile, 'userId'),
    roles: manyToMany(Role, 'user_roles'),
  },
})

export const Post = defineModel('posts', {
  id: field.id(),
  title: field.string(),
  content: field.text(),
  authorId: field.foreignKey(User),
}, {
  relations: {
    author: belongsTo(User, 'authorId'),
    tags: manyToMany(Tag, 'post_tags'),
  },
})
```
**Then** relationships are properly typed and queryable

**Given** I want to load related data eagerly
**When** I use `.with()` (Architecture: Eager Loading):
```typescript
const user = await User.with('posts', 'profile').find(1)
// user.posts is Post[]
// user.profile is Profile | null

// Nested eager loading
const posts = await Post
  .with('author', 'tags')
  .with('author.profile')
  .all()
```
**Then** related data is loaded in optimized queries (prevents N+1)

**Given** I want to query through relationships
**When** I use relationship queries:
```typescript
// Get all posts by admin users
const posts = await Post
  .whereHas('author', (query) => query.where({ role: 'admin' }))
  .all()

// Get users with at least 5 posts
const activeUsers = await User
  .withCount('posts')
  .having('postsCount', '>=', 5)
  .all()
```
**Then** relationship conditions are applied correctly

**Technical Notes:**
- Foreign key constraints in D1
- Eager loading with `.with()` to prevent N+1 queries
- Lazy loading available but discouraged
- Join tables for many-to-many (`user_roles`, `post_tags`)

**Prerequisites:** Story 3.3

---

### Story 3.5: Automatic Storage Tier Selection

As a **developer**,
I want EdgeRecord to automatically select the optimal storage tier,
So that I get the best performance without manual configuration.

**Acceptance Criteria:**

**Given** I define a model without specifying storage
**When** EdgeRecord analyzes the model (FR17, FR150):
```typescript
// High-read, simple key-value data → KV
export const Setting = defineModel('settings', {
  key: field.string().primaryKey(),
  value: field.json(),
})

// Relational data with queries → D1
export const User = defineModel('users', {
  id: field.id(),
  email: field.string().unique(),
  // ... relations defined
})

// Strong consistency required → Durable Objects
export const Counter = defineModel('counters', {
  id: field.string().primaryKey(),
  value: field.integer(),
}, {
  consistency: 'strong', // FR101
})
```
**Then** the appropriate storage tier is selected automatically:
- **KV**: Simple key-value, high read, eventual consistency OK
- **D1**: Relational data, complex queries, indexes
- **DO**: Strong consistency, real-time coordination

**Given** automatic selection doesn't fit my needs
**When** I explicitly specify the tier (FR151):
```typescript
export const Session = defineModel('sessions', {
  id: field.string().primaryKey(),
  userId: field.integer(),
  data: field.json(),
}, {
  storage: 'kv',  // Force KV storage
  ttl: 3600,      // Auto-expire after 1 hour
})
```
**Then** my specified tier is used instead

**Given** access patterns change over time
**When** data should migrate between tiers (FR152):
```typescript
export const Product = defineModel('products', {
  // ...
}, {
  cache: {
    tier: 'kv',
    populateFrom: 'd1',
    ttl: 300,  // Cache for 5 minutes
  },
})
```
**Then** frequently accessed D1 data is cached in KV

**Technical Notes:**
- Tier selection based on: schema complexity, consistency requirements, access patterns
- Default to D1 for most models (safest choice)
- KV for session-like data, settings, feature flags
- DO for counters, rate limits, real-time collaboration

**Prerequisites:** Story 3.1

---

### Story 3.6: Automatic Caching & Invalidation

As a **developer**,
I want automatic caching of frequently accessed data,
So that reads are fast without manual cache management.

**Acceptance Criteria:**

**Given** I configure caching for a model (FR18):
```typescript
export const Product = defineModel('products', {
  id: field.id(),
  name: field.string(),
  price: field.decimal(),
}, {
  cache: {
    enabled: true,
    ttl: 300,  // 5 minutes (FR176)
    strategy: 'read-heavy', // Architecture: Cache strategy presets
  },
})
```
**When** I query for a product by ID
**Then** the result is cached in KV
**And** subsequent reads hit the cache

**Given** I update a cached record
**When** I call `product.update({ price: 29.99 })` (FR19)
**Then** the cache is automatically invalidated
**And** the next read fetches fresh data from D1

**Given** I want to manually control caching
**When** I use cache methods:
```typescript
// Skip cache for this query
const product = await Product.find(1, { cache: false })

// Manually invalidate
await Product.invalidateCache(1)

// Warm cache proactively
await Product.warmCache([1, 2, 3])
```
**Then** I have full control when needed

**Given** I want different cache strategies (Architecture: Cache Strategy Presets):
```typescript
// Read-heavy: Aggressive caching, lazy invalidation
{ strategy: 'read-heavy', ttl: 3600 }

// Write-heavy: Minimal caching, immediate invalidation
{ strategy: 'write-heavy', ttl: 60 }

// Balanced: Moderate caching, smart invalidation
{ strategy: 'balanced', ttl: 300 }
```
**Then** caching behavior adapts to my workload

**Technical Notes:**
- Cache key format: `model:id` or `model:query:hash`
- Use KV for distributed cache across edge locations
- Invalidation on write, update, delete
- D1 connection warmup option for cold starts (Architecture: database.warmup)

**Prerequisites:** Story 3.5

---

### Story 3.7: Database Migrations

As a **developer**,
I want to manage database schema changes with migrations,
So that I can evolve my schema safely.

**Acceptance Criteria:**

**Given** I modify a model schema
**When** I run `ix migrate:generate` (FR20):
```bash
$ ix migrate:generate add-bio-to-users

✓ Detected changes:
  • Added column: users.bio (text, nullable)
  • Added column: users.avatar_url (text, nullable)

✓ Generated migration: migrations/001_add_bio_to_users.sql
```
**Then** a migration file is created with the SQL changes

**Given** I have pending migrations
**When** I run `ix migrate`:
```bash
$ ix migrate

Pending migrations:
  • 001_add_bio_to_users.sql
  • 002_create_posts_table.sql

? Apply 2 migrations? (Y/n)

✓ Applied: 001_add_bio_to_users.sql (12ms)
✓ Applied: 002_create_posts_table.sql (8ms)

All migrations complete!
```
**Then** migrations are applied in order
**And** migration state is tracked in D1

**Given** I need to rollback a migration (FR163)
**When** I run `ix migrate:rollback`:
```bash
$ ix migrate:rollback

Last applied migration: 002_create_posts_table.sql

? Rollback this migration? (Y/n)

✓ Rolled back: 002_create_posts_table.sql
```
**Then** the migration is reversed
**And** the down migration SQL is executed

**Given** I want to see migration status
**When** I run `ix migrate:status`:
```bash
$ ix migrate:status

Migration Status:
  ✓ 001_add_bio_to_users.sql      (applied: 2024-12-01)
  ✓ 002_create_posts_table.sql    (applied: 2024-12-02)
  ○ 003_add_tags_table.sql        (pending)
```
**Then** I see which migrations have been applied

**Technical Notes:**
- Use Drizzle Kit for migration generation (Architecture: Migration CLI)
- Migrations stored in `migrations/` directory
- Track applied migrations in `_migrations` table
- Support both up and down migrations

**Prerequisites:** Story 3.1

---

### Story 3.8: Transactions with Automatic Rollback

As a **developer**,
I want to perform multiple operations in a transaction,
So that all changes succeed or fail together.

**Acceptance Criteria:**

**Given** I need atomic operations (FR125)
**When** I use a transaction:
```typescript
import { transaction } from 'ixflare/orm'

await transaction(async (tx) => {
  // Debit from sender
  await tx.update(Account, senderId, {
    balance: { decrement: amount },
  })

  // Credit to receiver
  await tx.update(Account, receiverId, {
    balance: { increment: amount },
  })

  // Create transfer record
  await tx.create(Transfer, {
    fromId: senderId,
    toId: receiverId,
    amount,
  })
})
```
**Then** all operations succeed together
**And** if any fails, all are rolled back

**Given** I throw an error in a transaction
**When** the error occurs:
```typescript
await transaction(async (tx) => {
  await tx.create(Order, { userId, total })

  if (inventory < quantity) {
    throw new Error('Insufficient inventory')
    // Transaction automatically rolls back
  }

  await tx.update(Product, productId, {
    inventory: { decrement: quantity },
  })
})
```
**Then** the transaction is automatically rolled back
**And** no partial changes are committed

**Given** I want nested transactions
**When** I nest transaction calls:
```typescript
await transaction(async (tx) => {
  await tx.create(Order, orderData)

  // Nested transaction (savepoint)
  await transaction(async (innerTx) => {
    await innerTx.create(OrderItem, item1)
    await innerTx.create(OrderItem, item2)
  }, { parent: tx })
})
```
**Then** savepoints are used for nested transactions

**Technical Notes:**
- D1 supports transactions
- Use SQLite savepoints for nested transactions
- Auto-rollback on uncaught exceptions
- Transaction timeout to prevent long-running locks

**Prerequisites:** Story 3.2

---

### Story 3.9: Database Seeding

As a **developer**,
I want to seed the database with test/development data,
So that I can work with realistic data locally.

**Acceptance Criteria:**

**Given** I create a seed file `seeds/users.ts` (FR126):
```typescript
import { seed } from 'ixflare/orm'
import { User, Post } from '@/models'
import { faker } from '@faker-js/faker'

export default seed(async () => {
  // Create admin user
  const admin = await User.create({
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
  })

  // Create fake users with posts
  for (let i = 0; i < 10; i++) {
    const user = await User.create({
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: 'user',
    })

    // Create posts for each user
    for (let j = 0; j < 5; j++) {
      await Post.create({
        authorId: user.id,
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(3),
      })
    }
  }
})
```
**When** I run `ix db:seed`
**Then** seed data is created in the database

**Given** I want environment-specific seeds
**When** I configure seeds:
```typescript
// seeds/index.ts
export default {
  development: [
    './users.ts',
    './products.ts',
    './fixtures/sample-data.json', // JSON fixtures for prod-like data
  ],
  test: [
    './test-fixtures.ts',
  ],
}
```
**Then** appropriate seeds run per environment (Architecture: Hybrid Factories + Fixtures)

**Given** I want to reset and reseed
**When** I run `ix db:seed --fresh`:
```bash
$ ix db:seed --fresh

⚠️  This will delete all data and reseed. Continue? (y/N)

✓ Truncated all tables
✓ Running seeds...
  • users.ts (created 11 users)
  • products.ts (created 50 products)
✓ Seeding complete!
```
**Then** all data is cleared and reseeded

**Technical Notes:**
- Use @faker-js/faker for development data (Architecture: Seed Strategy)
- JSON fixtures for production-like data
- Seed order matters for foreign keys
- Idempotent seeds for safety

**Prerequisites:** Story 3.2

---

### Story 3.10: Soft Deletes

As a **developer**,
I want to soft-delete records instead of permanent deletion,
So that I can recover data and maintain audit trails.

**Acceptance Criteria:**

**Given** I enable soft deletes on a model (FR127):
```typescript
export const User = defineModel('users', {
  id: field.id(),
  email: field.string().unique(),
  name: field.string(),
  deletedAt: field.datetime().nullable(),
}, {
  softDeletes: true,
})
```
**When** I delete a record:
```typescript
await user.delete()
```
**Then** the record is soft-deleted (deletedAt is set)
**And** the record is excluded from normal queries

**Given** I query for records
**When** I use normal queries:
```typescript
// Only returns non-deleted users
const users = await User.all()
const user = await User.find(1)  // Returns null if soft-deleted
```
**Then** soft-deleted records are automatically filtered out

**Given** I want to include soft-deleted records
**When** I use `withTrashed()`:
```typescript
// Include soft-deleted
const allUsers = await User.withTrashed().all()

// Only soft-deleted
const deletedUsers = await User.onlyTrashed().all()

// Find including soft-deleted
const user = await User.withTrashed().find(1)
```
**Then** I can access soft-deleted records when needed

**Given** I want to restore a soft-deleted record
**When** I call `restore()`:
```typescript
const user = await User.withTrashed().find(1)
await user.restore()  // Sets deletedAt to null
```
**Then** the record is restored and appears in normal queries

**Given** I want to permanently delete
**When** I call `forceDelete()`:
```typescript
await user.forceDelete()  // Permanent deletion
```
**Then** the record is permanently removed from the database

**Technical Notes:**
- `deletedAt` column convention
- Global scope automatically applied
- Cascade soft deletes for relationships (optional)
- Index on `deletedAt` for query performance

**Prerequisites:** Story 3.2

---

### Story 3.11: Pagination Helpers

As a **developer**,
I want built-in pagination for large result sets,
So that I can efficiently paginate through data.

**Acceptance Criteria:**

**Given** I want offset-based pagination (FR148)
**When** I use `paginate()`:
```typescript
const result = await User
  .where({ role: 'user' })
  .orderBy('createdAt', 'desc')
  .paginate({ page: 2, perPage: 20 })

// result shape:
{
  data: User[],           // 20 users
  meta: {
    total: 156,           // Total records
    perPage: 20,
    currentPage: 2,
    lastPage: 8,
    from: 21,             // First record index
    to: 40,               // Last record index
  },
  links: {
    first: '/api/users?page=1',
    prev: '/api/users?page=1',
    next: '/api/users?page=3',
    last: '/api/users?page=8',
  }
}
```
**Then** I get paginated results with metadata

**Given** I want cursor-based pagination for large datasets
**When** I use `cursorPaginate()`:
```typescript
const result = await Post
  .orderBy('createdAt', 'desc')
  .cursorPaginate({
    cursor: 'eyJpZCI6MTAwfQ==',  // Encoded cursor
    limit: 20,
  })

// result shape:
{
  data: Post[],
  meta: {
    hasMore: true,
    nextCursor: 'eyJpZCI6MTIwfQ==',
    prevCursor: 'eyJpZCI6ODB9',
  }
}
```
**Then** I get cursor-based pagination for infinite scroll

**Given** I'm building an API
**When** I paginate in a route handler:
```typescript
export const GET: RouteHandler = async ({ request }) => {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')

  const users = await User.paginate({ page, perPage: 20 })

  return Response.json(users)
}
```
**Then** the response includes data and pagination metadata

**Technical Notes:**
- Offset pagination: Simple but slow for large offsets
- Cursor pagination: Efficient for large datasets, requires ordered column
- Auto-generate pagination links with base URL
- Respect max page size limits

**Prerequisites:** Story 3.3

---

### Story 3.12: Multi-Tier Data Consistency

As a **developer**,
I want consistent data across storage tiers,
So that cached data stays in sync with the source of truth.

**Acceptance Criteria:**

**Given** data is cached in KV and stored in D1 (FR23)
**When** I update the D1 record:
```typescript
await product.update({ price: 29.99 })
```
**Then** the KV cache is invalidated immediately
**And** the next read returns fresh data

**Given** I need strong consistency (FR101)
**When** I configure strong consistency:
```typescript
export const Inventory = defineModel('inventory', {
  productId: field.integer().primaryKey(),
  quantity: field.integer(),
}, {
  consistency: 'strong',  // Use Durable Objects
})

// Operations are strongly consistent
await Inventory.decrement(productId, 'quantity', 1)
```
**Then** Durable Objects ensure strong consistency

**Given** eventual consistency is acceptable
**When** I configure eventual consistency:
```typescript
export const PageView = defineModel('page_views', {
  pageId: field.string().primaryKey(),
  count: field.integer(),
}, {
  consistency: 'eventual',  // Use KV with periodic D1 sync
})
```
**Then** writes go to KV first, syncing to D1 periodically

**Given** I want to coordinate across storage tiers
**When** data changes:
```typescript
// Framework handles:
// 1. Write to D1 (source of truth)
// 2. Invalidate KV cache
// 3. Broadcast to DOs if subscribed
// 4. Optional: write-through to KV for hot data
```
**Then** all tiers stay synchronized

**Technical Notes:**
- D1 is always source of truth for relational data
- KV for read caching and session-like data
- DO for strong consistency and real-time coordination
- Write-through vs write-behind strategies configurable

**Prerequisites:** Story 3.5, Story 3.6

---

**Epic 3 Complete: EdgeRecord ORM & Data Layer**

**Stories Created:** 12
**FR Coverage:** FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR101, FR125, FR126, FR127, FR148, FR150, FR151, FR152, FR166, FR176
**Technical Context Used:** Drizzle-style schemas, automatic tier selection, cache strategies, D1/KV/DO coordination
**UX Patterns Incorporated:** First-Time Setup Flow stage 4 (First Database Query), query response <10ms

---

## Epic 4: Server-Side Rendering & Frontend

**Epic Goal:** Enable developers to build React applications that render on the edge with streaming HTML, selective hydration for interactivity, and optimized client bundles.

**FR Coverage:** FR24, FR25, FR26, FR27, FR28, FR29, FR105, FR153, FR154, FR155, FR158, FR159

---

### Story 4.1: React Component Rendering at Edge

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

### Story 4.2: Progressive HTML Streaming

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

### Story 4.3: Selective Component Hydration (Islands)

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

### Story 4.4: Hydration Manifest Generation

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

### Story 4.5: Per-Route Rendering Strategy

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

### Story 4.6: SSR Error Boundaries

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

### Story 4.7: HMR State Preservation

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

### Story 4.8: Automatic Route-Based Code Splitting

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

### Story 4.9: Server-Only Code Removal

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

### Story 4.10: Tailwind CSS Integration

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

## Epic 5: Authentication & Security

**Epic Goal:** Enable developers to implement secure authentication flows with JWT tokens, session management, and authorization patterns while the framework handles security best practices automatically.

**FR Coverage:** FR79, FR80, FR129, FR138, FR139, FR140, plus auth-related aspects from Architecture (JWT, OAuth, Sessions, RBAC)

---

### Story 5.1: Custom WebCrypto JWT Implementation

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

### Story 5.2: Session Management

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

### Story 5.3: OAuth Primitives & Adapters

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

### Story 5.4: Authorization with RBAC + Policies

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

### Story 5.5: Automatic Key Rotation

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

### Story 5.6: CSRF Protection

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

### Story 5.7: Secure Cookie Handling

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

### Story 5.8: Security Headers Auto-Injection

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

### Story 5.9: XSS Prevention & Auto-Sanitization

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

### Story 5.10: Dependency Vulnerability Scanning

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

### Story 5.11: Secret Management & Log Redaction

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

## Epic 6: CLI Developer Experience

**Epic Goal:** Enable developers to use intuitive CLI commands for local development, code generation, database management, and debugging with fast feedback loops and helpful error messages.

**FR Coverage:** FR42, FR43, FR44, FR45, FR46, FR47, FR50, FR51, FR52, FR96, FR102, FR103, FR104, FR108, FR110, FR111, FR113, FR133, FR147, FR163, FR164, FR167

---

### Story 6.1: Local Development Server with HMR

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

### Story 6.2: Production Build & Optimization

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

### Story 6.3: Deployment Command

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

### Story 6.4: Production Preview

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

### Story 6.5: TypeScript Type Generation

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

### Story 6.6: Database Migration CLI

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

### Story 6.7: Database Studio GUI

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

### Story 6.8: Rescue Checkpoints

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

### Story 6.9: Actionable Error Messages

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

### Story 6.10: Progress Indicators

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

### Story 6.11: Interactive Wizard Mode

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

### Story 6.12: Framework Version Notifications

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

### Story 6.13: Type Checking via CLI

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

### Story 6.14: Live Log Streaming

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

### Story 6.15: Eject to Custom Configuration

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

## Epic 7: Testing Framework

**Epic Goal:** Enable developers to write and run comprehensive unit and integration tests that accurately simulate the edge execution environment, with proper mocking utilities and coverage reporting.

**FR Coverage:** FR36, FR37, FR38, FR39, FR40, FR41, FR130, FR131, FR132

---

### Story 7.1: Unit Testing with Workers Simulation

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

### Story 7.2: Integration Testing for Multi-Tier Storage

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

### Story 7.3: Type-Safe Test Utilities

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

### Story 7.4: Route Handler Testing with Mocks

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

### Story 7.5: Local Edge Simulation Testing

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

### Story 7.6: Fixture Management

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

### Story 7.7: Coverage Reports with Thresholds

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

### Story 7.8: Snapshot Testing for SSR

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

### Story 7.9: CI/CD Integration

As a **developer**,
I want tests to run automatically in CI,
So that quality is enforced on every commit.

**Acceptance Criteria:**

**Given** I set up CI (FR40)
**When** I use the provided GitHub Actions template:
```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: ix typecheck
      - run: ix test --coverage --ci
      - run: ix build

      - uses: codecov/codecov-action@v3
        if: always()
```
**Then** tests run on every push and PR

**Given** tests fail in CI
**When** the workflow completes
**Then** I see clear failure output:
```
❌ Tests failed

  FAIL tests/routes/users.test.ts
    ✕ creates a new user (15ms)

    Expected: 201
    Received: 500

    Error: Database connection failed
```

**Given** I want test results in PR comments
**When** tests complete
**Then** a summary comment is added to the PR:
```
## Test Results ✅

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

## Epic 8: Deployment & Production

**Epic Goal:** Enable developers to deploy their applications to Cloudflare Workers with confidence, manage multiple environments, monitor production health, and rollback if issues occur.

**FR Coverage:** FR69, FR70, FR74, FR103, FR134, FR144, FR156, FR157, FR168, FR173, plus health checks, compression, graceful shutdown

---

### Story 8.1: Single Command Deployment

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

### Story 8.2: Edge-Optimized Bundles

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

### Story 8.3: Deployment Rollback

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

### Story 8.4: Post-Deployment Smoke Tests

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

### Story 8.5: Health Check Endpoints

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

### Story 8.6: Static Asset Serving

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

### Story 8.7: WebSocket Support via Durable Objects

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

### Story 8.8: Response Compression

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

### Story 8.9: Local D1 Database for Offline Development

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

### Story 8.10: Graceful Worker Shutdown

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

## Epic 9: Documentation & Onboarding

**Epic Goal:** Enable developers to quickly find answers in comprehensive documentation, complete interactive tutorials, and get help through community channels when stuck.

**FR Coverage:** FR55, FR56, FR57, FR58, FR59, FR60, FR109, FR136, FR137, FR174

---

### Story 9.1: Quick Start Guide

As a **new developer**,
I want a Quick Start guide that gets me deployed in under 5 minutes,
So that I can evaluate Ixflare quickly.

**Acceptance Criteria:**

**Given** I visit the documentation (FR55)
**When** I follow the Quick Start:
```markdown
# Quick Start

Get your first Ixflare app deployed in 5 minutes!

## 1. Create Project (30 seconds)

\`\`\`bash
npx create-ixflare-app my-app
cd my-app
\`\`\`

## 2. Start Development (10 seconds)

\`\`\`bash
ix dev
\`\`\`

Open http://localhost:3000

## 3. Deploy (2 minutes)

\`\`\`bash
ix deploy
\`\`\`

That's it! Your app is live globally. 🎉
```
**Then** I have a working app deployed

**Given** I want to try without installing
**When** I use the browser playground (FR136):
**Then** I can experiment with Ixflare in a sandboxed environment

**Given** I encounter an issue
**When** I check the Quick Start troubleshooting:
**Then** common issues have inline solutions

**Technical Notes:**
- Minimal steps to deployment
- No unnecessary configuration
- Link to deeper docs for customization
- Browser-based playground for zero-install trial

**Prerequisites:** All framework features complete

---

### Story 9.2: Core Concepts Documentation

As a **developer**,
I want clear documentation of core concepts,
So that I understand how Ixflare works.

**Acceptance Criteria:**

**Given** I want to learn the fundamentals (FR56)
**When** I read Core Concepts:
```
Core Concepts

1. File-Based Routing
   How routes map from file structure to URLs

2. EdgeRecord ORM
   Type-safe data modeling and multi-tier storage

3. Server-Side Rendering
   React rendering at the edge with streaming

4. Islands Architecture
   Selective hydration for minimal JavaScript

5. Middleware
   Request/response processing pipeline

6. Edge Configuration
   Unified configuration with edge.config.ts
```
**Then** I understand the key concepts

**Given** each concept section
**When** I read through it:
**Then** it includes:
- Clear explanation
- Code examples
- Visual diagrams where helpful
- Links to related deep dives

**Technical Notes:**
- Progressive complexity (simple → advanced)
- Cross-linking between related concepts
- Code examples that actually work
- Diagrams for architectural concepts

**Prerequisites:** Story 9.1

---

### Story 9.3: Auto-Generated API Reference

As a **developer**,
I want auto-generated API documentation,
So that I can quickly look up function signatures.

**Acceptance Criteria:**

**Given** I need API details (FR58)
**When** I browse the API Reference:
```
API Reference

ixflare
├── defineConfig()
├── defineModel()
├── defineMiddleware()
└── ...

ixflare/orm
├── field
│   ├── id()
│   ├── string()
│   ├── integer()
│   └── ...
├── query builders
└── ...

ixflare/auth
├── jwt
├── session
├── oauth
└── ...
```
**Then** all public APIs are documented

**Given** I view a function
**When** I read its documentation:
```typescript
/**
 * Creates a new model definition for EdgeRecord
 *
 * @param tableName - Database table name (snake_case)
 * @param fields - Field definitions using field.* helpers
 * @param options - Optional model configuration
 * @returns Model class with CRUD methods
 *
 * @example
 * const User = defineModel('users', {
 *   id: field.id(),
 *   email: field.string().unique(),
 * })
 */
function defineModel<T>(
  tableName: string,
  fields: FieldDefinitions,
  options?: ModelOptions
): Model<T>
```
**Then** I see types, parameters, returns, and examples

**Technical Notes:**
- Generate from TypeScript source with TSDoc
- Include type signatures
- Runnable examples where possible
- Version-specific documentation

**Prerequisites:** All framework features complete

---

### Story 9.4: Deep Dive Guides

As an **experienced developer**,
I want in-depth guides for advanced topics,
So that I can master complex features.

**Acceptance Criteria:**

**Given** I want to learn advanced topics (FR57)
**When** I browse Deep Dives:
```
Deep Dive Guides

Authentication & Security
├── Custom JWT Strategies
├── OAuth Provider Integration
├── Role-Based Access Control
└── Security Best Practices

Performance Optimization
├── Bundle Size Optimization
├── Database Query Optimization
├── Caching Strategies
└── Cold Start Mitigation

Advanced Patterns
├── Multi-Tenant Applications
├── Feature Flags
├── A/B Testing
└── Rate Limiting Strategies
```
**Then** I find comprehensive guides on advanced topics

**Given** I read a deep dive
**When** I follow along:
**Then** it includes:
- Detailed explanations with rationale
- Step-by-step implementation
- Production-ready code examples
- Performance considerations
- Common pitfalls and solutions

**Technical Notes:**
- Written for experienced developers
- Assumes knowledge of core concepts
- Real-world use cases
- Performance benchmarks where relevant

**Prerequisites:** Story 9.2

---

### Story 9.5: Troubleshooting Hub

As a **developer hitting an error**,
I want a troubleshooting hub with solutions,
So that I can fix issues without searching.

**Acceptance Criteria:**

**Given** I encounter a common error (FR59)
**When** I visit the Troubleshooting Hub:
```
Troubleshooting Hub

Top 10 Errors:

1. "Module not found: @/models/..."
   Solution: Check tsconfig paths configuration

2. "D1 database binding not found"
   Solution: Configure D1 in wrangler.toml

3. "Bundle size exceeds 1MB limit"
   Solution: Optimize imports and use code splitting

4. "CORS error: Access-Control-Allow-Origin"
   Solution: Configure CORS middleware

...
```
**Then** I find solutions to common problems

**Given** I search for an error (FR109)
**When** I type in the search box:
**Then** relevant troubleshooting articles appear instantly

**Given** my error isn't listed
**When** I check the error code:
**Then** I can look it up by code (e.g., IX_E001)
**And** find documentation for that specific error

**Technical Notes:**
- Track most common errors from telemetry
- Update based on support queries
- Error codes link to specific articles
- Include "Still stuck?" with support links

**Prerequisites:** Story 9.3

---

### Story 9.6: Role-Based Documentation Navigation

As a **developer with specific needs**,
I want documentation organized by my role,
So that I find relevant content quickly.

**Acceptance Criteria:**

**Given** I select my role (FR60)
**When** I choose from:
- Frontend Developer
- Backend Developer
- Fullstack Developer
- DevOps/Infrastructure

**Then** documentation is filtered/organized for my focus:

**Frontend Developer Path:**
```
Recommended Reading:
1. React Components at the Edge
2. Islands Architecture
3. Styling with Tailwind
4. Client-Side State Management
```

**Backend Developer Path:**
```
Recommended Reading:
1. API Route Design
2. EdgeRecord ORM
3. Authentication & Authorization
4. Database Patterns
```

**Given** I'm a beginner (Alex persona)
**When** I select "Show simpler docs":
**Then** I see:
- Basic patterns first
- Hide advanced configurations
- More step-by-step guidance
- Fewer edge cases

**Technical Notes:**
- Role selection stored in preferences
- Content tagged by role relevance
- Skill level affects content complexity
- Can always access all docs

**Prerequisites:** Story 9.1

---

### Story 9.7: Copy-Paste Recipe Library

As a **developer implementing common features**,
I want a recipe library with working code snippets,
So that I can implement features quickly.

**Acceptance Criteria:**

**Given** I need to implement a common pattern (FR174)
**When** I browse Recipes:
```
Recipe Library

Authentication
├── Email/Password Login
├── OAuth with GitHub
├── Magic Link Authentication
├── JWT Refresh Tokens

Data Patterns
├── Pagination with Cursors
├── Full-Text Search
├── Soft Deletes
├── Audit Logging

API Patterns
├── Rate Limiting
├── API Versioning
├── Webhook Handlers
├── File Uploads

UI Patterns
├── Infinite Scroll
├── Optimistic Updates
├── Form Validation
├── Toast Notifications
```
**Then** I find ready-to-use implementations

**Given** I view a recipe
**When** I read it:
```markdown
# Email/Password Login

## Prerequisites
- User model with password field
- JWT configured

## Implementation

### 1. Create Login Route

\`\`\`typescript
// src/routes/api/auth/login.ts
export const POST: RouteHandler = async ({ request }) => {
  const { email, password } = await request.json()

  const user = await User.where({ email }).first()
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    throw new AuthError('INVALID_CREDENTIALS')
  }

  const token = await jwt.sign({ userId: user.id })
  return Response.json({ token, user })
}
\`\`\`

[Copy] button copies code to clipboard
```
**Then** I can copy working code directly

**Technical Notes:**
- Complete, working examples
- One-click copy buttons
- Dependencies and prerequisites listed
- Customization notes

**Prerequisites:** Story 9.3

---

### Story 9.8: Interactive Tutorials

As a **new developer**,
I want interactive tutorials,
So that I learn by doing rather than just reading.

**Acceptance Criteria:**

**Given** I start an interactive tutorial (FR136)
**When** I begin "Build Your First API":
```
Tutorial: Build Your First API

[Progress: Step 2 of 8]

Let's create your first API endpoint!

Create a file at `src/routes/api/hello.ts`:

┌─────────────────────────────────────┐
│ // Your code here                    │
│                                      │
│                                      │
│                                      │
└─────────────────────────────────────┘

Expected:
\`\`\`typescript
export const GET = async () => {
  return Response.json({ message: 'Hello!' })
}
\`\`\`

[Run Code] [Show Solution] [Next Step]
```
**Then** I can write code and see results immediately

**Given** I complete a tutorial
**When** I finish all steps:
**Then** I receive a summary of what I learned
**And** suggestions for next tutorials

**Given** I get stuck
**When** I click "Show Solution":
**Then** the correct code is revealed
**And** explanation of why it works

**Technical Notes:**
- Browser-based code editor
- Real Workers execution via playground
- Progress saved across sessions
- Hints before showing full solutions

**Prerequisites:** All framework features

---

**Epic 9 Complete: Documentation & Onboarding**

**Stories Created:** 8
**FR Coverage:** FR55, FR56, FR57, FR58, FR59, FR60, FR109, FR136, FR137, FR174
**Technical Context Used:** TSDoc for API generation, role-based navigation, interactive playground
**UX Patterns Incorporated:** Documentation Discovery Flow, Learning & Onboarding Flow, Search with Instant Results, Code Block with Copy

---

## Epic 10: Templates & Polish

**Epic Goal:** Enable developers to start projects from production-ready templates with best practices built-in, and provide polished UX touches that make development delightful.

**FR Coverage:** FR62, FR63, FR64, FR65, FR97, FR100, FR112, FR114, FR115

---

### Story 10.1: Template Browsing & Selection

As a **developer starting a new project**,
I want to browse available templates,
So that I can choose the best starting point.

**Acceptance Criteria:**

**Given** I want to see available templates (FR62)
**When** I run `ix templates`:
```bash
$ ix templates

Available Templates:

  minimal
    Bare essentials - routing, config, one example
    ⭐ Popular | ✓ Tests passing | Updated 2 days ago

  fullstack-react
    Full-stack React app with SSR, auth, database
    ⭐ Most Popular | ✓ Tests passing | Updated 1 day ago

  api-backend
    API-only backend with authentication, rate limiting
    ⭐ Popular | ✓ Tests passing | Updated 3 days ago

Use `ix init --template <name>` to create a project.
```
**Then** I see all templates with metadata (FR64)

**Given** I want more details about a template
**When** I run `ix templates info fullstack-react`:
```bash
$ ix templates info fullstack-react

fullstack-react
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Full-stack React application with everything you
need to build a production-ready web app.

Includes:
  ✓ React 19 with SSR and Islands
  ✓ Authentication (JWT + OAuth)
  ✓ EdgeRecord ORM with D1
  ✓ Tailwind CSS styling
  ✓ Testing setup with Vitest
  ✓ CI/CD GitHub Actions workflow

Size: 45KB
Dependencies: 12

Preview: https://fullstack-react.ixflare.dev
```
**Then** I see comprehensive template information

**Given** I want to preview templates (FR112)
**When** I view template details:
**Then** I see screenshot previews of the running template

**Technical Notes:**
- Templates fetched from registry (cached)
- Include health indicators (test status, freshness)
- Link to live demos
- Screenshot generation automated

**Prerequisites:** Epic 1

---

### Story 10.2: Template Initialization

As a **developer**,
I want to initialize a project from a template,
So that I start with a working foundation.

**Acceptance Criteria:**

**Given** I select a template (FR63)
**When** I run `ix init --template fullstack-react my-app`:
```bash
$ ix init --template fullstack-react my-app

Creating project from fullstack-react template...

✓ Scaffolding project structure
✓ Configuring for: my-app
✓ Installing dependencies
✓ Initializing git repository
✓ Running initial setup

Project created! Next steps:

  cd my-app
  ix dev

Happy coding! 🚀
```
**Then** a fully configured project is created

**Given** the template has configuration options
**When** I initialize:
```bash
$ ix init --template fullstack-react my-app

? Include authentication? (Y/n) Y
? Include database seeding? (Y/n) Y
? Include example pages? (Y/n) n
```
**Then** the template is customized based on my choices

**Given** I want all defaults
**When** I run `ix init --template fullstack-react my-app --yes`:
**Then** all defaults are accepted without prompts

**Technical Notes:**
- Template variables replaced during init
- Optional sections included/excluded
- Post-init scripts for setup
- Clear next steps shown

**Prerequisites:** Story 10.1

---

### Story 10.3: Template Health Validation

As a **developer choosing a template**,
I want to see template health indicators,
So that I know templates are maintained and working.

**Acceptance Criteria:**

**Given** templates are listed (FR65, FR114)
**When** I view health indicators:
```bash
$ ix templates --health

Template Health Dashboard:

  minimal
    Tests: ✓ Passing (45/45)
    Build: ✓ Success
    Deps:  ✓ No vulnerabilities
    Age:   2 days since update
    Score: 100/100 ⭐

  fullstack-react
    Tests: ✓ Passing (128/128)
    Build: ✓ Success
    Deps:  ⚠ 1 moderate vulnerability
    Age:   1 day since update
    Score: 95/100 ⭐

  api-backend
    Tests: ✕ 2 failing
    Build: ✓ Success
    Deps:  ✓ No vulnerabilities
    Age:   5 days since update
    Score: 75/100
```
**Then** I can assess template reliability

**Given** a template has issues
**When** I try to use it:
**Then** I see a warning:
```
⚠️ This template has 2 failing tests.

It may still work, but some features might be broken.

? Continue anyway? (y/N)
```

**Given** templates are validated in CI (FR100)
**When** a template PR is opened:
**Then** CI validates:
- All tests pass
- Build succeeds
- No security vulnerabilities
- Documentation complete

**Technical Notes:**
- Health metrics from CI runs
- Vulnerability scanning with npm audit
- Freshness based on last commit
- Block unhealthy templates from being default

**Prerequisites:** Story 10.1

---

### Story 10.4: Template Health Dashboard

As a **framework maintainer**,
I want a template health dashboard,
So that I can monitor template quality.

**Acceptance Criteria:**

**Given** I'm a maintainer (FR97)
**When** I access the dashboard:
```
Template Health Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall Status: ✓ All templates healthy

Template          | Tests | Build | Deps  | Users/Week
------------------|-------|-------|-------|------------
minimal           | ✓     | ✓     | ✓     | 1,245
fullstack-react   | ✓     | ✓     | ⚠     | 3,567
api-backend       | ✓     | ✓     | ✓     | 892

Recent Issues:
- fullstack-react: 1 moderate dep vulnerability (lodash)
  Action: Update lodash to 4.17.21

CI History (last 7 days):
  ██████████████████████████████ 100% passing
```
**Then** I see aggregate health metrics

**Given** a template fails CI
**When** the failure occurs:
**Then** I'm notified via configured channels
**And** the dashboard shows the failure prominently

**Technical Notes:**
- Dashboard for maintainers only
- Aggregated metrics from CI
- Alerting integration (Slack, email)
- Historical trend tracking

**Prerequisites:** Story 10.3

---

### Story 10.5: Visual Checkpoint Confirmation

As a **developer using rescue checkpoints**,
I want visual confirmation of checkpoint operations,
So that I'm confident about what's being saved/restored.

**Acceptance Criteria:**

**Given** I create a checkpoint (FR115)
**When** it completes:
```bash
$ ix rescue:create

Creating rescue checkpoint...

╭───────────────────────────────────────────────────╮
│                                                   │
│  ✓ Checkpoint Created                             │
│                                                   │
│  Name: rescue-2024-12-04-1430                    │
│  Time: December 4, 2024 at 2:30 PM               │
│                                                   │
│  Included:                                        │
│  ├─ Database: 3 tables, 589 rows                 │
│  ├─ KV Store: 45 keys                            │
│  └─ Git State: 3 uncommitted files               │
│                                                   │
│  Restore with:                                    │
│  ix rescue:restore rescue-2024-12-04-1430        │
│                                                   │
╰───────────────────────────────────────────────────╯
```
**Then** I see exactly what was saved

**Given** I restore a checkpoint
**When** it completes:
```bash
$ ix rescue:restore rescue-2024-12-04-1430

╭───────────────────────────────────────────────────╮
│                                                   │
│  ✓ Checkpoint Restored                            │
│                                                   │
│  Restored from: December 4, 2024 at 2:30 PM      │
│                                                   │
│  Changes:                                         │
│  ├─ Database: Restored 3 tables                  │
│  │   └─ users: 156 → 142 rows (-14)             │
│  ├─ KV Store: Restored 45 keys                   │
│  └─ Git State: Applied stash                     │
│                                                   │
│  Your project is now at the checkpoint state.     │
│                                                   │
╰───────────────────────────────────────────────────╯
```
**Then** I see what changed during restore

**Technical Notes:**
- Clear visual formatting
- Show delta (what changed)
- Confirmation before destructive operations
- Success/failure states clearly indicated

**Prerequisites:** Story 6.8

---

### Story 10.6: Developer Experience Polish

As a **developer**,
I want polished CLI interactions,
So that using Ixflare feels professional and delightful.

**Acceptance Criteria:**

**Given** I use any CLI command
**When** it completes successfully:
**Then** I see consistent, well-formatted output:
- Clear success indicators (✓)
- Consistent color scheme
- Proper spacing and alignment
- Helpful next steps

**Given** an error occurs
**When** I see the error:
**Then** it's formatted helpfully:
- Clear error indicator (✕)
- Syntax-highlighted code (FR137)
- Actionable suggestions
- Documentation links

**Given** I want minimal output
**When** I use `--quiet` flag:
**Then** output is machine-parseable:
```bash
$ ix build --quiet
OK
```

**Given** I want detailed output
**When** I use `--verbose` flag:
**Then** I see additional debugging info:
```bash
$ ix build --verbose

[DEBUG] Loading config from edge.config.ts
[DEBUG] Resolved 23 routes
[DEBUG] Vite build started...
...
```

**Technical Notes:**
- Consistent design language across all commands
- Respect terminal capabilities (colors, width)
- Support for CI environments (no colors, simple output)
- Accessible to screen readers where possible

**Prerequisites:** All CLI commands

---

**Epic 10 Complete: Templates & Polish**

**Stories Created:** 6
**FR Coverage:** FR62, FR63, FR64, FR65, FR97, FR100, FR112, FR114, FR115
**Technical Context Used:** Template registry, CI validation, health metrics, visual formatting
**UX Patterns Incorporated:** Plugin Card Component, Certification Badge Component, Progress Stepper, consistent CLI design

---


## Final Validation

### FR Coverage Matrix

**Complete mapping of all 168 MVP Functional Requirements to Epics and Stories:**

#### Core Features (82 FRs)

**Routing & Request Handling (11 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR8 | File-based route conventions | Epic 2 | Story 2.1 |
| FR9 | Nested route layouts with parent-child | Epic 2 | Story 2.2 |
| FR10 | Type-safe route parameters | Epic 2 | Story 2.3 |
| FR11 | API routes with HTTP methods | Epic 2 | Story 2.4 |
| FR12 | Route loaders for data fetching | Epic 2 | Story 2.5 |
| FR13 | Automatic route discovery | Epic 2 | Story 2.1 |
| FR14 | Route conflict handling | Epic 2 | Story 2.6 |
| FR116 | Request body parsing | Epic 2 | Story 2.7 |
| FR117 | Typed responses | Epic 2 | Story 2.8 |
| FR118 | HTTP header reading/setting | Epic 2 | Story 2.7 |
| FR119 | Type-safe query parameters | Epic 2 | Story 2.3 |

**EdgeRecord ORM (17 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR15 | Type-safe model schemas | Epic 3 | Story 3.1 |
| FR16 | CRUD operations across tiers | Epic 3 | Story 3.2 |
| FR17 | Automatic storage tier selection | Epic 3 | Story 3.4 |
| FR18 | Automatic caching | Epic 3 | Story 3.5 |
| FR19 | Cache invalidation | Epic 3 | Story 3.5 |
| FR20 | Database migrations | Epic 3 | Story 3.9 |
| FR21 | Type-safe query builders | Epic 3 | Story 3.3 |
| FR22 | Model relationships | Epic 3 | Story 3.6 |
| FR23 | Multi-tier consistency | Epic 3 | Story 3.4 |
| FR101 | Consistency requirements per model | Epic 3 | Story 3.4 |
| FR125 | Transactions with rollback | Epic 3 | Story 3.7 |
| FR126 | Database seeding | Epic 3 | Story 3.10 |
| FR127 | Soft deletes | Epic 3 | Story 3.8 |
| FR148 | Pagination helpers | Epic 3 | Story 3.3 |
| FR150 | Tier selection defaults | Epic 3 | Story 3.4 |
| FR151 | Override tier selection | Epic 3 | Story 3.4 |
| FR152 | Data migration between tiers | Epic 3 | Story 3.11 |
| FR166 | D1 connection pooling | Epic 3 | Story 3.12 |
| FR176 | TTL configuration for caching | Epic 3 | Story 3.5 |

**Server-Side Rendering (9 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR24 | React component rendering at edge | Epic 4 | Story 4.1 |
| FR25 | Progressive HTML streaming | Epic 4 | Story 4.2 |
| FR26 | Selective component hydration | Epic 4 | Story 4.3 |
| FR27 | Per-route rendering strategies | Epic 4 | Story 4.4 |
| FR28 | SSR error boundaries | Epic 4 | Story 4.5 |
| FR29 | Rendered HTML caching | Epic 4 | Story 4.6 |
| FR153 | Streaming error boundaries | Epic 4 | Story 4.5 |
| FR154 | Head before body enforcement | Epic 4 | Story 4.2 |
| FR155 | Hydration manifest generation | Epic 4 | Story 4.3 |

**Middleware & Request Processing (10 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR30 | Type-safe middleware functions | Epic 2 | Story 2.9 |
| FR31 | Middleware composition chains | Epic 2 | Story 2.10 |
| FR32 | Global and route-group middleware | Epic 2 | Story 2.10 |
| FR33 | Typed context through chain | Epic 2 | Story 2.9 |
| FR34 | Request/response transformation | Epic 2 | Story 2.11 |
| FR35 | Middleware error boundaries | Epic 2 | Story 2.12 |
| FR128 | Built-in rate limiting | Epic 2 | Story 2.12 (plus Epic 5) |
| FR160 | Rate limiting strategies | Epic 5 | Story 5.9 |
| FR161 | Rate limiting windows/thresholds | Epic 5 | Story 5.9 |
| FR162 | Rate limit exceeded responses | Epic 5 | Story 5.9 |
| FR171 | Individual route middleware | Epic 2 | Story 2.10 |

**CLI Commands (17 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR42 | Local dev server with HMR | Epic 6 | Story 6.1 |
| FR43 | Production bundle optimization | Epic 6 | Story 6.3 |
| FR44 | Deploy to Cloudflare Workers | Epic 8 | Story 8.1 |
| FR45 | Local production preview | Epic 6 | Story 6.2 |
| FR46 | Dependency management | Epic 6 | Story 6.6 |
| FR47 | Database migrations from CLI | Epic 6 | Story 6.7 |
| FR102 | TypeScript type generation | Epic 6 | Story 6.5 |
| FR103 | Deployment history for rollback | Epic 8 | Story 8.4 |
| FR104 | Rescue checkpoints | Epic 6 | Story 6.10 |
| FR105 | HMR state preservation | Epic 6 | Story 6.1 |
| FR106 | Tree-shaking, code splitting, minification | Epic 6 | Story 6.3 |
| FR107 | Environment variable loading | Epic 1 | Story 1.7 |
| FR147 | Type checking via CLI | Epic 6 | Story 6.5 |
| FR163 | Migration rollback | Epic 6 | Story 6.8 |
| FR164 | Live log streaming | Epic 6 | Story 6.12 |
| FR167 | Eject to custom configuration | Epic 6 | Story 6.13 |
| FR158 | Automatic route-based code splitting | Epic 4 | Story 4.7 |
| FR159 | Server-only code removal | Epic 4 | Story 4.8 |

**Testing Framework (9 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR36 | Unit tests with Workers simulation | Epic 7 | Story 7.1 |
| FR37 | Integration tests for multi-tier storage | Epic 7 | Story 7.2 |
| FR38 | Type-safe test utilities | Epic 7 | Story 7.3 |
| FR39 | Local tests simulating edge | Epic 7 | Story 7.4 |
| FR40 | CI/CD integration | Epic 7 | Story 7.8 |
| FR41 | Route handler testing with mocks | Epic 7 | Story 7.5 |
| FR130 | Fixture management | Epic 7 | Story 7.6 |
| FR131 | Coverage reports with thresholds | Epic 7 | Story 7.7 |
| FR132 | Snapshot testing for SSR | Epic 7 | Story 7.9 |

**Developer Experience Polish (13 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR50 | Progressive help | Epic 6 | Story 6.9 |
| FR51 | Rescue checkpoint creation | Epic 6 | Story 6.10 |
| FR52 | Rescue checkpoint restoration | Epic 6 | Story 6.10 |
| FR96 | Operation duration tracking | Epic 6 | Story 6.11 |
| FR108 | Actionable error messages | Epic 6 | Story 6.14 |
| FR110 | Progress indicators | Epic 6 | Story 6.15 |
| FR111 | Color-coded CLI output | Epic 10 | Story 10.6 |
| FR113 | Wizard and quickstart modes | Epic 1 | Story 1.2 |
| FR133 | Framework version notifications | Epic 6 | Story 6.6 |
| FR134 | WebSocket connections via DO | Epic 8 | Story 8.7 |
| FR136 | Interactive Quick Start playground | Epic 9 | Story 9.1 |
| FR137 | Error messages with syntax highlighting | Epic 6 | Story 6.14 |
| FR156 | WebSocket routing helpers | Epic 8 | Story 8.8 |
| FR157 | WebSocket auto-reconnection | Epic 8 | Story 8.8 |

#### Infrastructure & Foundation (86 FRs)

**Initialization & Setup (12 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR1 | Single command project creation | Epic 1 | Story 1.1 |
| FR2 | Project type selection | Epic 1 | Story 1.2 |
| FR3 | Starter template selection | Epic 1 | Story 1.3 |
| FR4 | Package manager preference | Epic 1 | Story 1.4 |
| FR5 | Auto-detect package manager | Epic 1 | Story 1.4 |
| FR6 | Project structure generation | Epic 1 | Story 1.5 |
| FR7 | TypeScript configuration scaffolding | Epic 1 | Story 1.6 |
| FR122 | Minimal template with example patterns | Epic 10 | Story 10.1 |
| FR123 | Automatic dependency installation | Epic 1 | Story 1.1 |
| FR124 | First-time deployment guidance | Epic 8 | Story 8.3 |
| FR143 | Deployed URL display | Epic 8 | Story 8.1 |
| FR145 | .gitignore generation | Epic 1 | Story 1.5 |

**Templates (6 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR62 | Template browsing | Epic 10 | Story 10.2 |
| FR63 | Core template initialization | Epic 10 | Story 10.1, 10.3, 10.4 |
| FR64 | Template metadata display | Epic 10 | Story 10.2 |
| FR65 | Template health indicators | Epic 10 | Story 10.5 |
| FR97 | Template health dashboard | Epic 10 | Story 10.5 |
| FR100 | Template CI validation | Epic 10 | Story 10.5 |

**Documentation (7 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR55 | Quick Start guide | Epic 9 | Story 9.1 |
| FR56 | Core Concepts documentation | Epic 9 | Story 9.2 |
| FR57 | Deep Dive guides | Epic 9 | Story 9.3 |
| FR58 | Auto-generated API reference | Epic 9 | Story 9.4 |
| FR59 | Troubleshooting hub | Epic 9 | Story 9.5 |
| FR60 | Role-based documentation navigation | Epic 9 | Story 9.6 |
| FR174 | Copy-paste recipe library | Epic 9 | Story 9.7 |

**Deployment (8 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR69 | Single command deployment | Epic 8 | Story 8.1 |
| FR70 | Edge-optimized bundles | Epic 8 | Story 8.2 |
| FR71 | Multi-environment deployment | Epic 8 | Story 8.1 |
| FR72 | Per-environment settings | Epic 8 | Story 8.1 |
| FR73 | Deployment configuration validation | Epic 8 | Story 8.2 |
| FR74 | Deployment rollback | Epic 8 | Story 8.4 |
| FR165 | Environment variable display before deploy | Epic 8 | Story 8.3 |
| FR168 | Post-deployment smoke test | Epic 8 | Story 8.5 |

**Configuration & Environment (7 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| Environment variable management | Epic 1 | Story 1.7 |
| Secrets management | Epic 5 | Story 5.8 |
| Configuration validation | Epic 1 | Story 1.8 |
| Edge location testing | Epic 7 | Story 7.4 |
| Framework version compatibility | Epic 6 | Story 6.6 |
| FR169 | Environment-specific secrets | Epic 5 | Story 5.8 |
| FR170 | Request size limit validation | Epic 8 | Story 8.2 |

**Migration (4 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR75 | Project type migration | Epic 9 | Story 9.8 |
| FR76 | Add frontend to api-backend | Epic 9 | Story 9.8 |
| FR77 | Remove frontend from fullstack | Epic 9 | Story 9.8 |
| FR78 | Migration plan generation | Epic 9 | Story 9.8 |

**Productivity Tools (4 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| Database GUI (ix db:studio) | Epic 6 | Story 6.7 |
| Performance budgets | Epic 8 | Story 8.2 |
| FR144 | Static asset serving | Epic 4 | Story 4.9 |
| FR173 | Local D1 database for offline dev | Epic 3 | Story 3.12 |

**Security (6 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR79 | CSRF protection | Epic 5 | Story 5.5 |
| FR80 | Secure cookie handling | Epic 5 | Story 5.3 |
| FR129 | XSS prevention | Epic 5 | Story 5.6 |
| FR138 | Dependency vulnerability scanning | Epic 5 | Story 5.10 |
| FR139 | Secret encryption and log redaction | Epic 5 | Story 5.8 |
| FR140 | HTTP to HTTPS redirect | Epic 5 | Story 5.7 |

**Error Handling (4 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| Client-side error boundaries | Epic 4 | Story 4.10 |
| Custom error pages (404, 500) | Epic 2 | Story 2.12 |
| Error logging | Epic 8 | Story 8.9 |
| Graceful degradation | Epic 4 | Story 4.5 |

**HTTP Standards (6 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| Health check endpoints | Epic 8 | Story 8.5 |
| Request ID tracking | Epic 8 | Story 8.9 |
| Response compression | Epic 8 | Story 8.6 |
| Redirect management | Epic 2 | Story 2.11 |
| CORS preflight optimization | Epic 5 | Story 5.7 |
| Graceful Worker shutdown | Epic 8 | Story 8.10 |

**Edge-Native Constraints (5 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| Bundle size validation (1MB limit) | Epic 8 | Story 8.2 |
| CPU time limit warnings | Epic 8 | Story 8.2 |
| Memory usage warnings | Epic 8 | Story 8.2 |
| FR120 | Global state persistence warnings | Epic 6 | Story 6.14 |
| FR121 | Edge location metadata access | Epic 2 | Story 2.7 |

**Performance & Caching (1 FR)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| Cache-Control header management | Epic 4 | Story 4.6 |

**Extensibility (2 FRs)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR141 | Lifecycle hooks for plugins | Epic 1 | Story 1.8 |
| FR142 | Custom CLI commands | Epic 6 | Story 6.13 |

**UX Enhancements - Tier 2 (4 FRs - Beta)**
| FR | Description | Epic | Story |
|----|-------------|------|-------|
| FR109 | Troubleshooting search | Epic 9 | Story 9.5 |
| FR112 | Template preview screenshots | Epic 10 | Story 10.2 |
| FR114 | Detailed health indicators | Epic 10 | Story 10.5 |
| FR115 | Checkpoint visual confirmation | Epic 6 | Story 6.10 |

---

### Validation Summary

#### FR Coverage Validation
- **Total MVP FRs:** 168
- **FRs Mapped to Stories:** 168
- **Coverage:** 100% ✅

#### Architecture Integration Validation
- ✅ All API endpoints from Architecture covered in routing stories
- ✅ Data models properly created via EdgeRecord stories
- ✅ Authentication/authorization patterns consistently applied
- ✅ Performance requirements addressed (caching, connection pooling, code splitting)
- ✅ Security measures implemented (JWT, CSRF, XSS, secrets management)
- ✅ Error handling follows Architecture patterns
- ✅ Integration points between systems properly handled

#### UX Integration Validation
- ✅ User flows follow designed journeys (First-Time Setup, Plugin Development, etc.)
- ✅ Custom components implemented (Terminal Output, Progress Stepper, Code Block)
- ✅ Interaction patterns match specifications
- ✅ Responsive behavior accounted for
- ✅ Accessibility requirements included in stories
- ✅ Error states and feedback patterns implemented
- ✅ Form validation follows UX guidelines

#### Story Quality Validation
- ✅ All stories sized for single dev agent completion
- ✅ Acceptance criteria are specific and testable (BDD format)
- ✅ Technical implementation guidance is clear
- ✅ User experience details incorporated
- ✅ No forward dependencies exist
- ✅ Epic sequence delivers incremental value
- ✅ Foundation epic properly enables subsequent work

---

### Final Quality Check

| Question | Answer |
|----------|--------|
| **User Value:** Does each epic deliver something users can actually do/use? | ✅ Yes - Each epic enables concrete developer capabilities |
| **Completeness:** Are ALL PRD functional requirements covered? | ✅ Yes - 168/168 FRs mapped (100%) |
| **Technical Soundness:** Do stories properly implement Architecture decisions? | ✅ Yes - All architectural patterns referenced |
| **User Experience:** Do stories follow UX design patterns? | ✅ Yes - UX components and flows integrated |
| **Implementation Ready:** Can dev agents implement these stories autonomously? | ✅ Yes - Complete acceptance criteria with technical context |

---

## Summary

**✅ EPIC AND STORY CREATION COMPLETE**

**Output Generated:** epics.md with comprehensive implementation details

**Full Context Incorporated:**
- ✅ PRD functional requirements and scope (168 FRs)
- ✅ Architecture technical decisions and contracts
- ✅ UX Design interaction patterns and specifications

**Metrics:**
| Metric | Value |
|--------|-------|
| Total Epics | 10 |
| Total Stories | 101 |
| FRs Covered | 168/168 (100%) |
| Average Stories per Epic | 10.1 |

**Epic Distribution:**
| Epic | Stories | Primary Focus |
|------|---------|---------------|
| Epic 1: Foundation & Project Setup | 8 | Project scaffolding, configuration |
| Epic 2: Core Runtime & Routing | 12 | Router, middleware, request handling |
| Epic 3: EdgeRecord ORM & Data Layer | 12 | Models, queries, caching, migrations |
| Epic 4: Server-Side Rendering & Frontend | 10 | SSR, streaming, hydration, React 19 |
| Epic 5: Authentication & Security | 11 | JWT, sessions, OAuth, security hardening |
| Epic 6: CLI Developer Experience | 15 | Dev server, build, generation, DX features |
| Epic 7: Testing Framework | 9 | Unit/integration tests, fixtures, CI |
| Epic 8: Deployment & Production | 10 | Deploy, rollback, monitoring, WebSocket |
| Epic 9: Documentation & Onboarding | 8 | Docs, tutorials, migration guides |
| Epic 10: Templates & Polish | 6 | Templates, health checks, CLI polish |

**Ready for Phase 4:** Sprint Planning and Development Implementation

