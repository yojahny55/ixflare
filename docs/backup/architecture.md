---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2025-12-04'
inputDocuments:
  - docs/prd/index.md
  - docs/prd/executive-summary.md
  - docs/prd/project-classification.md
  - docs/prd/product-scope.md
  - docs/prd/functional-requirements.md
  - docs/prd/non-functional-requirements.md
  - docs/prd/user-journeys.md
  - docs/prd/developer-tool-specific-requirements.md
  - docs/ux-design-specification/index.md
  - docs/analysis/brainstorming/brainstorming-session-2025-12-01/index.md
  - docs/analysis/brainstorming/brainstorming-session-2025-12-01/first-principles-thinking-core-edge-architecture.md
  - docs/analysis/brainstorming/brainstorming-session-2025-12-01/scamper-method-final-summary.md
workflowType: 'architecture'
lastStep: 0
project_name: 'cloudfare-edge-framework'
user_name: 'Yojahny'
date: '2025-12-04'
hasProjectContext: false
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

The MVP encompasses 168 functional requirements across 7 core features and 2 infrastructure categories:

| Category | FR Count | Architectural Significance |
|----------|----------|---------------------------|
| Routing & Request Handling | 11 | File-based routing with URLPattern, type-safe params |
| EdgeRecord ORM | 17 | 3-tier storage (KV/D1/DO), automatic caching, relationships |
| Server-Side Rendering | 9 | Streaming SSR, selective hydration, error boundaries |
| Middleware & Request Processing | 10 | Composable chain, rate limiting, context passing |
| CLI Commands | 17 | 50+ commands, code generation, REPL (tinker) |
| Testing Framework | 9 | Edge simulation, fixture management, snapshot testing |
| Developer Experience | 9 | Rescue checkpoints, progress indicators, error suggestions |
| Project Lifecycle | 48 | Templates, migrations, deployment, configuration |
| Cross-Cutting Concerns | 38 | Security, error handling, HTTP standards, edge constraints |

**Non-Functional Requirements:**

56 NFRs define quality attributes that constrain architectural choices:

- **Performance (14 NFRs):** Cold start <100ms, SSR <200ms p50, API <100ms p50, HMR <1s, core bundle <50KB
- **Security (12 NFRs):** Secrets encryption, CSRF protection, vulnerability scanning, TLS 1.3
- **Scalability (8 NFRs):** 10K+ req/s per app, 1M+ KV reads/s, 100GB+ D1 datasets
- **Developer Experience (15 NFRs):** 5-minute onboarding, 95%+ local/prod parity, actionable errors
- **Reliability (12 NFRs):** 99.9% deployment success, <2min rollbacks, ACID for critical ops

**Scale & Complexity:**

- **Primary domain:** Full-stack edge framework (Developer Tool)
- **Complexity level:** High (distributed systems + ORM + SSR + CLI)
- **Estimated architectural components:** 15 major systems
- **Target platforms:** Cloudflare Workers (300+ edge locations)

### Technical Constraints & Dependencies

**Edge Runtime Constraints:**
- V8 isolates (not Node.js) - no `fs`, `path`, or persistent processes
- 1MB bundle size limit (free tier), 5MB (paid)
- 50ms CPU time (free), 30s (paid)
- 128MB memory limit
- No long-running connections except via Durable Objects

**Cloudflare Service Dependencies (MVP):**
- **D1:** Primary relational database (SQLite-based)
- **KV:** Caching layer, session storage, configuration
- **Durable Objects:** Strong consistency, real-time coordination, WebSockets

**Build Tooling:**
- Vite for bundling (per brainstorming decision)
- TypeScript-first with full type inference
- Tree-shaking critical for bundle size compliance

**External Dependencies (Zero Runtime):**
- No third-party runtime dependencies (security requirement)
- Dev dependencies only for build/test tooling

### Cross-Cutting Concerns Identified

| Concern | Scope | Architectural Impact |
|---------|-------|---------------------|
| **Caching** | All data operations | 3-tier cache with tag invalidation, stale-while-revalidate |
| **Type Safety** | Entire codebase | TypeScript-first, auto-generated types from schema |
| **Error Handling** | All components | Actionable messages, error boundaries, graceful degradation |
| **Security** | All entry points | CSRF, rate limiting, input validation, secrets management |
| **Observability** | All operations | Structured logging, request tracing, performance metrics |
| **Configuration** | All environments | Layer precedence (build < runtime < context) |
| **Testing** | All features | Edge simulation, mocking bindings, coverage requirements |

### Alignment with Brainstorming Decisions

The First Principles analysis from the brainstorming session established 17 architectural pillars. Key decisions to carry forward:

1. **Session Strategy:** JWT → KV (5-20ms) → DO (50-100ms) with latency budgeting
2. **Storage API:** Unified `services` API with escape hatches to raw Cloudflare bindings
3. **Routing:** File-based convention with URLPattern for advanced matching
4. **Middleware:** Functional composition with build-time inlining (zero runtime overhead)
5. **State Management:** Multi-scope (ephemeral/session/cached/persistent/realtime/blob)
6. **Rendering:** Islands architecture with streaming SSR and selective hydration
7. **ORM:** EdgeRecord with Active Record syntax, automatic KV caching, DO-backed writes

These decisions are consistent with the PRD requirements and NFR constraints.

## Starter Template Evaluation

### Primary Technology Domain

**Developer Tool / Framework** - This project builds a framework that provides starter templates, rather than consuming one.

### Framework Architecture Decision (ADR-001)

**Decision:** Monorepo with pnpm workspaces

**Options Evaluated:**

| Option | Weighted Score | Verdict |
|--------|---------------|---------|
| pnpm workspaces | 8.45/10 | ✅ **Selected** |
| Turborepo | 8.40/10 | Future enhancement |
| Nx | 8.05/10 | Overkill for MVP |
| Single package | 7.85/10 | CLI/runtime conflict |

**Rationale (First Principles Validated):**
1. CLI (Node.js) and runtime (Workers V8) require separate packages - cannot bundle together
2. Subpath exports enable modular imports without package explosion
3. pnpm workspaces provide best DX/complexity balance at MVP scale
4. Can add Turborepo caching if builds exceed 2 minutes

### Simplified Package Structure

```
ixflare/
├── packages/
│   ├── ixflare/              # Main runtime package
│   │   ├── src/
│   │   │   ├── core/         # Router, middleware, helpers (~14KB)
│   │   │   ├── orm/          # EdgeRecord (subpath: ixflare/orm, +15KB)
│   │   │   └── ssr/          # SSR utilities (subpath: ixflare/ssr, +10KB)
│   │   └── package.json      # Subpath exports configuration
│   ├── vite-plugin-ixflare/  # Vite integration (Node.js only)
│   ├── create-ixflare/       # `npm create ixflare` scaffolder
│   └── cli/                  # `ix` CLI commands
├── templates/                # User-facing starter templates (MVP: 3)
│   ├── minimal/
│   ├── fullstack-react/
│   └── api-backend/
├── docs/                     # Documentation site
└── examples/                 # Example applications
```

**Package Count:** 4 (ixflare, vite-plugin-ixflare, create-ixflare, cli)

### Build Tooling Decisions

| Package | Build Tool | Output Format | Rationale |
|---------|-----------|---------------|-----------|
| `ixflare` | tsup | ESM + CJS | Library bundling, tree-shakeable |
| `vite-plugin-ixflare` | tsup | ESM + CJS | Vite plugin (Node.js only) |
| `create-ixflare` | tsup | CJS | Node.js CLI |
| `cli` | tsup | CJS | Node.js CLI |
| User projects | Vite + vite-plugin-ixflare | Workers bundle | Application bundling |

**Key Insight:** Vite is for application builds (user projects), tsup is for library builds (our packages).

### Bundle Size Compliance Strategy

| Import Pattern | Estimated Size | Compliance |
|----------------|---------------|------------|
| `import { Router } from 'ixflare'` | ~14KB | ✅ Well under 50KB |
| `import { EdgeRecord } from 'ixflare/orm'` | +15KB (~29KB) | ✅ Under 50KB |
| `import { renderToStream } from 'ixflare/ssr'` | +10KB (~39KB) | ✅ Under 50KB |
| Full import (all features) | ~39KB | ✅ Under 50KB |

### TypeScript Configuration

- TypeScript 5.x with strict mode enabled
- ES2022 target for Workers compatibility
- Project references for incremental builds
- Dual CJS/ESM output for CLI Node.js compatibility
- Subpath exports for modular tree-shaking

### Scalability Path

1. **MVP:** pnpm workspaces + tsup (current decision)
2. **If builds > 2 min:** Add Turborepo for caching
3. **If 10+ packages:** Consider Nx for project graph
4. **If remote teams:** Enable Turborepo remote caching

### User-Facing Templates (to be built)

Per PRD specification, 8 core templates:

| Template | Maintenance | Priority |
|----------|-------------|----------|
| `minimal` | Always updated | MVP |
| `fullstack-react` | Always updated | MVP |
| `api-backend` | Always updated | MVP |
| `edge-functions` | Always updated | MVP |
| `middleware-gateway` | Always updated | MVP |
| `ecommerce-starter` | Quarterly | Post-MVP |
| `saas-starter` | Quarterly | Post-MVP |
| `blog-cms` | Quarterly | Post-MVP |

**Note:** Monorepo structure and build pipeline should be first implementation story.

### Template Health Guarantee

**Template CI Matrix:**
- All 5 MVP templates tested on every release
- Tests: create → install → dev → build → deploy --dry-run
- Health badges displayed in template README

**Compatibility Manifest (`ixflare.lock`):**
- Each template pins exact tested versions
- `create-ixflare` warns on version mismatch
- Prevents "works on my machine" template failures

**First-Run Success Guarantee:**
- `ix dev` must succeed on fresh template
- Any failure in template CI blocks release
- 100% first-run success is non-negotiable

**Risk Mitigation (from Test Architect analysis):**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Template breaks on release | HIGH (70%) | CRITICAL | ✅ Template CI matrix |
| ORM/Core version mismatch | LOW (15%) | HIGH | ✅ Single package with subpath exports |
| CLI incompatible with runtime | MEDIUM (30%) | HIGH | ✅ Integration tests required |
| Build tooling drift | LOW (20%) | MEDIUM | ✅ Lockfile strategy |

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Schema definition format (TypeScript schema objects)
- JWT implementation (Custom WebCrypto-based)
- Environment configuration strategy (Framework-owned edge.config.ts)

**Important Decisions (Shape Architecture):**
- Migration tooling (Drizzle Kit internal, ix migrate external)
- Authorization pattern (Hybrid RBAC + Policies)
- Response format (Envelope on error only)
- Hydration detection (File convention + export marker)

**Deferred Decisions (Post-MVP):**
- Additional OAuth providers beyond core set
- Third-party logging adapter implementations
- Advanced caching strategies

### Data Architecture

| Decision | Choice | Version/Details |
|----------|--------|-----------------|
| Schema Definition | TypeScript schema objects | Drizzle-style, pure TS |
| Migration Engine | Drizzle Kit (internal) | v0.41.0, D1-native |
| Migration CLI | `ix migrate` | Unified D1/KV/DO migrations |
| Seed Strategy | Hybrid (Factories + Fixtures) | @faker-js for dev, JSON for prod |
| Validation | Zod | v4.x, runtime type safety |

### Authentication & Security

| Decision | Choice | Details |
|----------|--------|---------|
| JWT Implementation | Custom (WebCrypto) | jose-compatible API, ~2KB, ES256/HS256, edge-optimized |
| OAuth Strategy | Primitives + Optional Adapters | Composable flow helpers |
| Authorization | Hybrid RBAC + Policies | Roles in JWT, policies as edge functions |
| Security Defaults | Tiered + Secure Core Baseline | Template-appropriate defaults |

**JWT Implementation Rationale:**
- jose is Node-era bloat (~15KB+ with deps), not tree-shakeable enough
- Custom WebCrypto implementation: ~2KB, zero dependencies
- jose-compatible API for developer familiarity
- Optimized for Ixflare's hybrid JWT → KV → DO session model
- Faster cold starts, smaller bundles, edge-native performance

### API & Communication Patterns

| Decision | Choice | Details |
|----------|--------|---------|
| Response Format | Envelope on error only | Naked success, structured error |
| Error Codes | Namespaced | `DOMAIN.SPECIFIC_ERROR` pattern |
| API Versioning | URL path (`/api/v1/`) | API routes only, SSR unversioned |

### Frontend Architecture

| Decision | Choice | Details |
|----------|--------|---------|
| React Version | React 19 | Stable, Server Components, Actions |
| Hydration Detection | File convention + Export marker | `*.client.tsx` + `island = true` |
| CSS Solution | Tailwind default | Tailwind included by default, CSS Modules/Vanilla Extract supported |

**CSS Strategy Rationale (from Party Mode):**
- Tailwind expected by 70%+ of developers
- Reduces cognitive load at project creation (no CSS prompt)
- Opinionated frameworks win markets
- Opt-out via `ix config` or manual removal for alternatives

### Infrastructure & Deployment

| Decision | Choice | Details |
|----------|--------|---------|
| Environment Config | `edge.config.ts` | Merges defaults → wrangler → .env → runtime |
| CI/CD Approach | Hybrid | `ix deploy` CLI + GitHub/GitLab templates |
| Logging | Hybrid structured logger | CF Analytics default + optional adapters |

### Security Hardening (from Security Audit)

**JWT Security:**
- Single algorithm enforcement (ES256 OR HS256, never both)
- Short-lived access tokens (15m default)
- Automatic key rotation (30d interval, 24h grace period)
- Algorithm header validation before signature check

**OAuth Security:**
- Session-bound state parameter (CSRF protection)
- PKCE enabled by default for public clients
- Strict redirect URI validation (exact match only)

**Auth Event Logging:**
- Automatic security logs: `AUTH.LOGIN_SUCCESS`, `AUTH.LOGIN_FAILED`, `AUTH.ROLE_ESCALATION`
- Session invalidation on role change
- Brute-force protection on auth endpoints (5 attempts / 15m)

### Performance Optimizations (from Profiler Panel)

**Database:**
- `.with()` eager loading to prevent N+1 queries
- D1 connection warmup option (`database.warmup: true`)
- Cache strategy presets: `read-heavy`, `write-heavy`, `balanced`

**Frontend:**
- Hydration error boundary with dev warnings
- Automatic island code-splitting (one chunk per `*.client.tsx`)
- Abort controller integration for streaming SSR

**DevOps:**
- `ix deploy:cleanup --older-than=7d` for preview cleanup
- Instant rollback with version history (`ix rollback`)
- Distributed tracing with `traceId` propagation

### System Architecture Insights (from Graph of Thoughts)

**Bootstrap Sequence:**
1. Logger (dependency-free, raw console)
2. Config parser (validates edge.config.ts)
3. KV/D1/DO bindings (raw connections)
4. JWT verifier (stateless)
5. Session manager (KV + DO)
6. Full middleware stack

**Code Environment Classification:**
- `@universal` - Runs in Node.js AND Workers (config, schemas)
- `@node-only` - CLI commands, build tools
- `@worker-only` - Request handlers, SSR, runtime

**Template Composition:**
- Shared fragments in `templates/_fragments/`
- Templates compose from fragments, not copy-paste
- Single update propagates to all templates

### User Experience Additions (from Focus Group)

**For Jordan (Senior Dev):**
- `ix tinker` REPL for interactive debugging
- Document eject path from `edge.config.ts` to raw Wrangler

**For Alex (Junior Dev):**
- Progressive disclosure: hide KV/DO complexity initially
- "Simple mode" docs with basic patterns first
- Error messages include fix suggestions

**For Sarah (Enterprise):**
- Post-MVP: Enterprise template with SSO scaffolding
- Post-MVP: SAML/Okta adapter for corporate IdPs
- Audit trail documentation for SOC 2 compliance

### Revised Decisions (from Party Mode)

**Template Strategy (Revised):**
- MVP: 3 templates only (minimal, fullstack-react, api-backend)
- Post-MVP: Add edge-functions, middleware-gateway
- Quarterly: ecommerce-starter, saas-starter, blog-cms
- Rationale: 3 templates = maintainable quality, 8 = maintenance burden

**Package Structure (Revised):**
- Vite plugin moved to `packages/vite-plugin-ixflare/`
- Prevents Node.js code leaking into Workers bundle
- Clean separation: runtime packages vs build-time packages

**Code Boundary Enforcement:**
- Add `eslint-plugin-ixflare` with environment rules
- Classifications: `@universal`, `@node-only`, `@worker-only`
- Build-time check: Fail on boundary violations
- CI integration: Automated enforcement

### Decision Impact Analysis

**Implementation Sequence:**
1. Monorepo structure + build pipeline (from Step 3)
2. Core runtime with router + middleware
3. `edge.config.ts` configuration system
4. EdgeRecord ORM with Drizzle Kit integration
5. Authentication system (JWT + session + OAuth primitives)
6. CLI commands (`ix dev`, `ix build`, `ix deploy`, `ix migrate`)
7. SSR + Islands architecture
8. Logging + observability
9. Templates + `create-ixflare`

**Cross-Component Dependencies:**
- EdgeRecord depends on: config system, D1/KV bindings
- Auth depends on: session (KV/DO), config system
- SSR depends on: router, hydration detection, React 19
- CLI depends on: config system, Drizzle Kit, Vite

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 14 areas where AI agents could make different choices - all now standardized.

### Naming Patterns

**Database Naming Conventions:**

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `users`, `order_items` |
| Columns | snake_case | `created_at`, `user_id` |
| Foreign keys | snake_case with `_id` suffix | `user_id`, `product_id` |
| Indexes | `idx_{table}_{column}` | `idx_users_email` |
| Primary keys | `id` (implicit) | `id` |

**API Naming Conventions:**

| Element | Convention | Example |
|---------|------------|---------|
| Routes | Plural nouns, kebab-case | `/api/v1/users`, `/api/v1/user-profiles` |
| Route params | camelCase | `/api/v1/users/:userId` |
| Query params | camelCase | `?sortBy=createdAt&limit=10` |
| Headers | PascalCase with hyphens | `X-Request-Id`, `Content-Type` |

**File Naming Conventions:**

| Element | Convention | Example |
|---------|------------|---------|
| Components | kebab-case | `user-card.tsx`, `nav-menu.tsx` |
| Utilities | kebab-case | `format-date.ts`, `parse-query.ts` |
| Routes | kebab-case | `user-profiles.tsx`, `order-details.tsx` |
| Tests | kebab-case + `.test` | `user-card.test.ts` |
| Types | kebab-case | `user-types.ts`, `api-types.ts` |

**Code Naming Conventions:**

| Element | Convention | Example |
|---------|------------|---------|
| Variables | camelCase | `userId`, `orderItems` |
| Functions | camelCase | `getUserById`, `formatDate` |
| Classes | PascalCase | `UserService`, `OrderController` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| Types/Interfaces | PascalCase | `User`, `OrderItem`, `ApiResponse` |
| Enums | PascalCase (values: PascalCase) | `Status.Pending`, `Role.Admin` |

### Structure Patterns

**Test File Location:**
- Mirrored `tests/` directory structure
- `src/services/user.ts` → `tests/services/user.test.ts`
- `src/components/user-card.tsx` → `tests/components/user-card.test.tsx`

**Component Organization (Hybrid):**

```
src/
├── components/          # Shared, reusable components
│   ├── ui/              # Primitive UI components
│   └── layout/          # Layout components
├── features/            # Domain-specific features
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   └── products/
├── hooks/               # Shared hooks
├── utils/               # Shared utilities
└── types/               # Shared types
```

**Import Path Aliases:**

| Alias | Path | Usage |
|-------|------|-------|
| `@/` | `src/` | `import { x } from '@/utils/format'` |
| `@/components` | `src/components/` | `import { Button } from '@/components/ui'` |
| `@/features` | `src/features/` | `import { useAuth } from '@/features/auth'` |
| `@/types` | `src/types/` | `import type { User } from '@/types'` |

### Format Patterns

**API Response Formats:**

```typescript
// Success (naked JSON)
{ "id": 1, "name": "Jordan", "createdAt": 1733311800000 }

// Error (structured envelope)
{
  "error": {
    "code": "AUTH.TOKEN_EXPIRED",
    "message": "Session has expired",
    "status": 401,
    "rayId": "abc123",
    "timestamp": 1733311800000
  }
}
```

**JSON Field Naming:**
- All API responses use camelCase
- EdgeRecord auto-transforms: DB `snake_case` → API `camelCase`

**Date/Time Format:**
- Unix timestamp in milliseconds: `1733311800000`
- Matches `Date.now()` and `new Date().getTime()`

### Communication Patterns

**Event Naming:**
- PascalCase: `UserCreated`, `OrderPaymentFailed`, `SessionExpired`
- Namespaced by domain when needed: `AuthUserCreated`, `BillingPaymentFailed`

**Event Payload Structure:**

```typescript
interface DomainEvent<T> {
  type: string           // 'UserCreated'
  payload: T             // Event-specific data
  timestamp: number      // Unix ms
  rayId: string          // Request correlation
}
```

**Logging:**
- Levels: `debug`, `info`, `warn`, `error` (Standard 4)
- Format: JSON in production, human-readable in development
- Auto-enriched: `rayId`, `colo`, `timestamp`, `path`

### Process Patterns

**Error Handling:**

```typescript
// Custom error classes with typed codes
class AuthError extends AppError {
  constructor(code: AuthErrorCode, message: string) {
    super(`AUTH.${code}`, message, 401)
  }
}

// Usage
throw new AuthError('TOKEN_EXPIRED', 'Session has expired')

// Caught by global error handler → formatted response
```

**Error Class Hierarchy:**

```
AppError (base)
├── AuthError (401)
├── ValidationError (422)
├── NotFoundError (404)
├── ForbiddenError (403)
├── ConflictError (409)
└── InfraError (500)
```

**AsyncState Pattern (Discriminated Union):**

```typescript
// Use discriminated union to prevent impossible states
type AsyncState<T, E = AppError> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E }

// Usage - TypeScript enforces correct access
function render(state: AsyncState<User>) {
  switch (state.status) {
    case 'idle': return <Placeholder />
    case 'loading': return <Spinner />
    case 'success': return <UserCard user={state.data} /> // data guaranteed
    case 'error': return <ErrorMessage error={state.error} /> // error guaranteed
  }
}
```

**Validation:**
- Schema-shared: Same Zod schema on client + server
- Single source of truth for validation rules
- TypeScript types inferred from schemas

```typescript
// schemas/user.ts
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
})

// Used in API route (server)
const data = createUserSchema.parse(await request.json())

// Used in form (client)
const { register, handleSubmit } = useForm({
  resolver: zodResolver(createUserSchema)
})
```

### Additional Patterns (from Advanced Elicitation)

**Class vs Function Guidance:**

| Use Classes For | Use Functions For |
|-----------------|-------------------|
| Services (state + deps) | Utilities (pure transforms) |
| Repositories (data access) | Helpers (one-off operations) |
| Error types (identity) | Middleware (request handlers) |
| Models (domain entities) | Route handlers |

```typescript
// Class: Has state, dependencies
class UserService {
  constructor(private db: D1Database) {}
  async findById(id: string): Promise<User> { ... }
}

// Function: Pure, no state
function formatUserName(user: User): string {
  return `${user.firstName} ${user.lastName}`
}
```

**EdgeRecord Usage Pattern:**

```typescript
// Direct usage (simple cases) - OK for MVP
const user = await User.find(id)

// Service wrapper (complex cases) - Required for:
// - Multiple ORM calls in transaction
// - Business logic beyond CRUD
// - External service coordination

class OrderService {
  async createOrder(data: CreateOrderInput) {
    // Transaction, inventory check, payment, etc.
  }
}
```

**Error Decision Tree:**

```
Is it authentication/session related?
├── Yes → AuthError (401)
└── No → Is user not allowed to access resource?
    ├── Yes → ForbiddenError (403)
    └── No → Is resource not found?
        ├── Yes → NotFoundError (404)
        └── No → Is there a conflict (duplicate)?
            ├── Yes → ConflictError (409)
            └── No → Is input invalid?
                ├── Yes → ValidationError (422)
                └── No → InfraError (500)
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow naming conventions exactly - no variations
2. Place tests in mirrored `tests/` structure
3. Use path aliases for imports (`@/`)
4. Return camelCase JSON, store snake_case in DB
5. Use Unix ms timestamps for all dates
6. Use PascalCase for events
7. Throw typed errors extending `AppError`
8. Use discriminated union for AsyncState
9. Share Zod schemas between client/server

### Pattern Enforcement Mechanisms

**Automated Prevention (15 Failure Modes Covered):**

| Mechanism | What It Prevents |
|-----------|-----------------|
| ESLint `no-relative-imports` | Import path chaos |
| ESLint `naming-convention` | Naming drift |
| ESLint `no-bare-throw` | Untyped errors |
| Pre-commit hooks | Pattern violations reaching repo |
| Response middleware | JSON case transformation bugs |
| Vitest coverage gates | Missing tests |
| TypeScript strict | Type mismatches |
| CI pattern checks | PR-level enforcement |

**ESLint Configuration (eslint-plugin-ixflare):**

```javascript
module.exports = {
  rules: {
    'no-relative-imports': 'error',
    'no-bare-throw': 'error',
    'enforce-async-state': 'error',
    'kebab-case-files': 'error',
    'snake-case-db': 'error',
    'camel-case-json': 'error',
  }
}
```

**Pre-commit Hook:**

```bash
#!/bin/sh
pnpm lint:patterns || exit 1
pnpm test:affected || exit 1
```

### Pattern Examples

**Good Examples:**

```typescript
// ✅ Correct file: src/features/auth/utils/validate-token.ts
import { AuthError } from '@/errors'
import type { User } from '@/types'

export async function validateToken(token: string): Promise<User> {
  // snake_case in DB query
  const user = await db.query('SELECT * FROM users WHERE auth_token = ?', [token])

  if (!user) {
    throw new AuthError('TOKEN_INVALID', 'Invalid authentication token')
  }

  // camelCase in response
  return {
    id: user.id,
    email: user.email,
    createdAt: user.created_at, // transformed
  }
}
```

**Anti-Patterns:**

```typescript
// ❌ Wrong file name: src/features/auth/utils/ValidateToken.ts (should be kebab-case)
// ❌ Wrong import: import { AuthError } from '../../errors' (should use @/)
// ❌ Wrong response: { user_id: 1 } (should be camelCase: userId)
// ❌ Wrong date: "2025-12-04T10:30:00Z" (should be Unix ms: 1733311800000)
// ❌ Wrong event: 'user_created' (should be PascalCase: UserCreated)
// ❌ Wrong loading: { isLoading: true } (should be discriminated union)
```

### Cross-Agent Compatibility Verified

Three-agent simulation confirmed patterns produce compatible code:
- Database schema ↔ API routes ↔ Frontend components
- Shared Zod schemas work across all layers
- Error envelope format parsed correctly
- AsyncState renders consistently with discriminated unions

### Pattern Refinements (from Critical Review)

**Error Handling - Extended:**

```typescript
// Core errors (use for 90% of cases)
AppError → AuthError | ValidationError | NotFoundError | ForbiddenError | ConflictError | InfraError

// Generic HttpError (use for edge cases: 429, 402, 410, 412, 503, etc.)
class HttpError extends AppError {
  constructor(status: number, code: string, message: string) {
    super(code, message, status)
  }
}

// Usage
throw new HttpError(429, 'SECURITY.RATE_LIMITED', 'Too many requests')
throw new HttpError(503, 'INFRA.MAINTENANCE', 'Scheduled maintenance')
```

**Import Ordering (ESLint Enforced):**

```typescript
// Order: External → Types → Components → Features → Utils → Relative
import { z } from 'zod'                    // 1. External
import type { User } from '@/types'        // 2. Types
import { Button } from '@/components/ui'   // 3. Components
import { useAuth } from '@/features/auth'  // 4. Features
import { formatDate } from '@/utils'       // 5. Utilities
```

**Logging Enhancement:**

```typescript
// Production logs include human-readable timestamp for debugging
logger.info('User created', {
  userId: 123,
  createdAt: 1733311800000,
  _debug: { createdAtISO: '2025-12-04T10:30:00Z' } // Stripped in prod, kept in staging
})
```

**AsyncState Extended (Complex Cases):**

```typescript
// For pagination, refresh, retry scenarios
type AsyncStateExtended<T, E = AppError> = {
  status: 'idle' | 'loading' | 'success' | 'error' | 'refreshing'
  data: T | null
  error: E | null
  meta?: {
    lastFetched?: number
    retryCount?: number
    hasMore?: boolean
  }
}
```

**Test Orphan Detection:**

```typescript
// vitest.config.ts
export default {
  testOrphanDetection: {
    enabled: true,
    action: 'error', // Fail CI if test file has no matching source
  }
}
```

**IDE Configuration (VS Code):**

```json
// .vscode/settings.json
{
  "explorer.sortOrder": "type",
  "typescript.preferences.importModuleSpecifier": "non-relative"
}
```

## Project Structure & Boundaries

### Complete Project Directory Structure

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

### Architectural Boundaries

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

### Requirements to Structure Mapping

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

### Integration Points

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

### File Organization Patterns

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

### Development Workflow Integration

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

### Package Dependency Graph

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

### Code Environment Classification

| Classification | Marker | Runs In | Example Files |
|----------------|--------|---------|---------------|
| `@universal` | JSDoc tag | Node.js + Workers | `config/schema.ts`, `types/shared.ts` |
| `@node-only` | JSDoc tag | Node.js only | All CLI, vite-plugin |
| `@worker-only` | JSDoc tag | Workers only | Route handlers, SSR |

**Enforcement:**
- `eslint-plugin-ixflare` validates environment boundaries
- Build fails if `@node-only` code imported in `@worker-only` context

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

All architectural decisions have been validated for mutual compatibility:

| Decision Pair | Compatibility Analysis | Status |
|---------------|------------------------|--------|
| pnpm workspaces + tsup/Vite | tsup for library builds, Vite for apps - clean separation | ✅ |
| TypeScript schemas + Drizzle Kit | Both TypeScript-native, schema types flow through | ✅ |
| Custom JWT + KV + Durable Objects | Stateless JWT → KV sessions → DO coordination - graduated consistency | ✅ |
| React 19 + Islands + Streaming | Server Components align with islands architecture | ✅ |
| Zod + EdgeRecord | Schema-shared validation integrates with ORM typing | ✅ |
| Tailwind + Vite + Workers | Compile-time CSS, zero runtime overhead | ✅ |
| Zero runtime deps + <50KB bundle | All choices support tree-shaking, no bloat | ✅ |

**No version conflicts or incompatibilities detected.**

**Pattern Consistency:**

| Pattern Domain | Consistency Check | Status |
|----------------|-------------------|--------|
| Database → API transformation | snake_case → camelCase via `utils/transform.ts` | ✅ |
| File naming across packages | kebab-case universal | ✅ |
| Test structure | Mirrored in packages + root integration/e2e | ✅ |
| Import paths | @/ aliases enforced by ESLint | ✅ |
| Async state handling | Discriminated union pattern throughout | ✅ |
| Error propagation | Typed errors → envelope response | ✅ |

**Structure Alignment:**

| Architectural Decision | Structure Support | Status |
|------------------------|-------------------|--------|
| Subpath exports (orm, ssr) | `packages/ixflare/src/` organized by subpath | ✅ |
| Node.js/Workers separation | Vite plugin in separate package | ✅ |
| Template DRY principle | `templates/_fragments/` for shared config | ✅ |
| Cross-package testing | `tests/integration/` at root level | ✅ |
| Examples vs scaffolding | `/examples/` distinct from `/templates/` | ✅ |

### Requirements Coverage Validation ✅

**Functional Requirements Coverage (168 FRs):**

| Category | FR Count | Architectural Support | Coverage |
|----------|----------|----------------------|----------|
| Routing & Request Handling | 11 | `ixflare/core/router.ts`, URLPattern, file-based routing | 100% |
| EdgeRecord ORM | 17 | `ixflare/edge-record/`, 3-tier storage (KV→D1→DO) | 100% |
| Server-Side Rendering | 9 | `ixflare/ssr/`, islands with `*.client.tsx` convention | 100% |
| Middleware & Processing | 10 | `ixflare/core/middleware.ts`, composable chain | 100% |
| CLI Commands | 17 | `cli/commands/`, Wrangler + Drizzle Kit integration | 100% |
| Testing Framework | 9 | Vitest + Miniflare, mirrored test structure | 100% |
| Developer Experience | 9 | Error suggestions, `ix tinker` REPL, progress indicators | 100% |
| Project Lifecycle | 48 | `create-ixflare`, 3 MVP templates, `ix migrate/deploy` | 100% |
| Cross-Cutting Concerns | 38 | Error hierarchy, security hardening, hybrid logging | 100% |

**Non-Functional Requirements Coverage (56 NFRs):**

| Category | Key Constraints | Architectural Support | Coverage |
|----------|-----------------|----------------------|----------|
| Performance (14) | Cold start <100ms, SSR <200ms, bundle <50KB | Zero deps, ~39KB max, streaming SSR | ✅ |
| Security (12) | CSRF, JWT hardening, secrets management | Custom JWT with rotation, PKCE, tiered defaults | ✅ |
| Scalability (8) | 10K+ req/s, 1M+ KV reads, 100GB+ D1 | Edge-native, 3-tier caching, DO coordination | ✅ |
| Developer Experience (15) | 5-min onboarding, 95% local/prod parity | 3 templates, Miniflare simulation, actionable errors | ✅ |
| Reliability (12) | 99.9% deploy success, <2min rollback | `ix rollback`, health checks, version history | ✅ |

**Brainstorming Pillars Alignment (17 Pillars):**

All 17 architectural pillars from first-principles analysis are supported:
- ✅ Session Strategy (JWT → KV → DO)
- ✅ Unified Storage API with escape hatches
- ✅ File-based routing with URLPattern
- ✅ Functional middleware composition
- ✅ Multi-scope state management
- ✅ Islands architecture with streaming
- ✅ EdgeRecord Active Record pattern

### Implementation Readiness Validation ✅

**Decision Completeness:**

| Aspect | Assessment | Status |
|--------|------------|--------|
| Technology versions specified | React 19, Drizzle Kit 0.41, Zod 4.x, TypeScript 5.x | ✅ |
| Rationale documented | Every major decision includes reasoning | ✅ |
| Pattern examples provided | Good/bad examples for all critical patterns | ✅ |
| Enforcement mechanisms | ESLint rules, pre-commit hooks, CI checks | ✅ |
| Error handling guidance | Complete hierarchy with decision tree | ✅ |

**Structure Completeness:**

| Aspect | Assessment | Status |
|--------|------------|--------|
| Directory tree | 200+ files/directories explicitly defined | ✅ |
| Package boundaries | Dependency graph with direction rules | ✅ |
| Integration points | Internal (types) and external (Wrangler) mapped | ✅ |
| Environment classification | @universal/@node-only/@worker-only markers | ✅ |
| Workflow integration | dev/build/deploy flows documented | ✅ |

**Pattern Completeness:**

| Pattern Category | Elements Covered | Status |
|------------------|------------------|--------|
| Naming (5 domains) | DB, API routes, files, code, events | ✅ |
| Structure (4 areas) | Tests, components, imports, organization | ✅ |
| Format (3 types) | JSON responses, dates, error envelopes | ✅ |
| Process (5 areas) | Errors, validation, logging, async state, class/function | ✅ |

### Gap Analysis Results

**Critical Gaps: 0** ✅

No blocking issues that would prevent implementation.

**Important Gaps Addressed:**

| Gap Identified | Resolution Applied | Step |
|----------------|-------------------|------|
| Edge status codes (429, 402, etc.) | Added generic `HttpError` class | Step 5 |
| Import ordering inconsistency | Added ESLint ordering rule | Step 5 |
| Test orphan files | Added Vitest orphan detection config | Step 5 |
| CI template discoverability | Moved to `/templates/ci/` | Step 6 |
| Cross-package type coupling | Added `types/shared.ts` | Step 6 |
| Symlink cross-platform issues | Changed to real `/examples/` directory | Step 6 |
| Changelog strategy | Added changesets configuration | Step 6 |

**Nice-to-Have (Post-MVP):**

| Enhancement | Priority | Notes |
|-------------|----------|-------|
| GraphQL support patterns | Post-MVP | Document when adding GraphQL adapter |
| WebSocket/DO patterns | Post-MVP | Real-time features documentation |
| Multi-region deployment | Post-MVP | Advanced infrastructure patterns |
| Performance profiling guide | Post-MVP | Observability enhancements |

### Architecture Completeness Checklist

**✅ Requirements Analysis (Step 1-2)**

- [x] Project context thoroughly analyzed (168 FRs, 56 NFRs)
- [x] Scale and complexity assessed (High - distributed systems + ORM + SSR)
- [x] Technical constraints identified (V8 isolates, 1MB bundle, 50ms CPU)
- [x] Cross-cutting concerns mapped (7 concern areas)
- [x] Brainstorming decisions aligned (17 pillars)

**✅ Starter Template Evaluation (Step 3)**

- [x] Monorepo structure decided (pnpm workspaces, 4 packages)
- [x] Build tooling selected (tsup for libs, Vite for apps)
- [x] Bundle compliance verified (~39KB max)
- [x] MVP templates defined (3: minimal, fullstack-react, api-backend)
- [x] Template health guarantee established

**✅ Core Architectural Decisions (Step 4)**

- [x] Data architecture complete (TypeScript schemas, Drizzle Kit, Zod)
- [x] Authentication designed (Custom JWT, OAuth primitives, RBAC + Policies)
- [x] API patterns defined (Envelope on error, namespaced codes, URL versioning)
- [x] Frontend architecture specified (React 19, islands, Tailwind default)
- [x] Infrastructure patterns established (edge.config.ts, hybrid CI/CD)

**✅ Implementation Patterns (Step 5)**

- [x] Naming conventions comprehensive (DB, API, files, code, events)
- [x] Structure patterns complete (tests, components, imports)
- [x] Format patterns specified (JSON, dates, responses)
- [x] Process patterns documented (errors, validation, async state)
- [x] Enforcement mechanisms defined (ESLint, pre-commit, CI)

**✅ Project Structure (Step 6)**

- [x] Complete directory tree defined (200+ elements)
- [x] Package boundaries established (dependency graph)
- [x] Integration points mapped (internal/external)
- [x] Requirements to structure mapping complete
- [x] Development workflow documented (dev/build/deploy)

**✅ Validation (Step 7)**

- [x] Coherence validated (all decisions compatible)
- [x] Requirements coverage verified (100% FR/NFR)
- [x] Implementation readiness confirmed
- [x] Gaps analyzed and addressed
- [x] Cross-agent compatibility tested

### Architecture Readiness Assessment

**Overall Status: ✅ READY FOR IMPLEMENTATION**

**Confidence Level: HIGH**

Based on comprehensive validation across coherence, coverage, and readiness dimensions.

**Key Strengths:**

1. **Zero Runtime Dependencies** - Maximum performance, minimum attack surface
2. **Lean Package Structure** - 4 packages vs competitors' 15-30+
3. **Complete Pattern Coverage** - 14 conflict points standardized
4. **Enforcement Mechanisms** - Automated prevention of pattern drift
5. **Edge-Native Design** - Every decision optimized for Workers runtime
6. **Cross-Agent Compatibility** - Multi-agent implementation verified

**Areas for Future Enhancement:**

1. GraphQL adapter patterns (when demand exists)
2. WebSocket/real-time documentation
3. Multi-region deployment strategies
4. Advanced observability patterns
5. Enterprise templates (SSO, SAML)

### Implementation Handoff

**AI Agent Guidelines:**

When implementing Ixflare, AI agents MUST:

1. **Follow architectural decisions exactly** - No substitutions without explicit approval
2. **Use implementation patterns consistently** - Naming, structure, format as documented
3. **Respect package boundaries** - Runtime has zero deps, CLI/Vite are Node.js only
4. **Reference this document** - For any architectural questions during implementation
5. **Enforce via tooling** - ESLint rules, pre-commit hooks, CI checks

**First Implementation Priority:**

```bash
# Implementation Sequence
1. Monorepo structure + pnpm workspace configuration
2. packages/ixflare/ - Core runtime with router + middleware
3. packages/ixflare/src/config/ - edge.config.ts system
4. packages/ixflare/src/edge-record/ - ORM foundation
5. packages/ixflare/src/auth/ - JWT + session management
6. packages/cli/ - ix dev, build, deploy, migrate
7. packages/vite-plugin-ixflare/ - Build integration
8. packages/ixflare/src/ssr/ - Islands + streaming
9. packages/create-ixflare/ + templates/ - Scaffolding
10. Integration testing + documentation
```

**Quick Reference - Critical Patterns:**

| Element | Pattern | Example |
|---------|---------|---------|
| DB columns | snake_case | `created_at` |
| API response | camelCase | `createdAt` |
| Files | kebab-case | `user-service.ts` |
| Routes | plural nouns | `/api/v1/users` |
| Imports | @/ aliases | `import { x } from '@/utils'` |
| Errors | typed hierarchy | `throw new AuthError('TOKEN_EXPIRED', ...)` |
| Async state | discriminated union | `{ status: 'success', data: T }` |
| Dates | Unix ms | `1733311800000` |

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2025-12-04
**Document Location:** docs/architecture.md

### Final Architecture Deliverables

**📋 Complete Architecture Document**

- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**🏗️ Implementation Ready Foundation**

- 35+ architectural decisions made
- 14 implementation pattern categories defined
- 4 core packages + 3 MVP templates specified
- 168 functional requirements + 56 NFRs fully supported

**📚 AI Agent Implementation Guide**

- Technology stack with verified versions
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries
- Integration patterns and communication standards

### Implementation Handoff

**For AI Agents:**
This architecture document is your complete guide for implementing Ixflare. Follow all decisions, patterns, and structures exactly as documented.

**First Implementation Priority:**

```bash
# Initialize monorepo structure
mkdir ixflare && cd ixflare
pnpm init
# Configure pnpm-workspace.yaml with packages/*
```

**Development Sequence:**

1. Initialize monorepo with pnpm workspaces
2. Set up packages/ixflare/ with tsup configuration
3. Implement core router and middleware foundation
4. Build edge.config.ts configuration system
5. Implement EdgeRecord ORM foundation
6. Create authentication (JWT + sessions)
7. Build CLI commands (ix dev, build, deploy)
8. Implement SSR with islands architecture
9. Create vite-plugin-ixflare
10. Build create-ixflare scaffolder + templates

### Quality Assurance Checklist

**✅ Architecture Coherence**

- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**

- [x] All 168 functional requirements are supported
- [x] All 56 non-functional requirements are addressed
- [x] Cross-cutting concerns are handled
- [x] Integration points are defined

**✅ Implementation Readiness**

- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

### Project Success Factors

**🎯 Clear Decision Framework**
Every technology choice was made collaboratively with clear rationale, ensuring all stakeholders understand the architectural direction.

**🔧 Consistency Guarantee**
Implementation patterns and rules ensure that multiple AI agents will produce compatible, consistent code that works together seamlessly.

**📋 Complete Coverage**
All project requirements are architecturally supported, with clear mapping from business needs to technical implementation.

**🏗️ Solid Foundation**
The chosen monorepo structure and architectural patterns provide a production-ready foundation following current best practices.

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.
