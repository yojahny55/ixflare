# Project Context Analysis

## Requirements Overview

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

## Technical Constraints & Dependencies

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

## Cross-Cutting Concerns Identified

| Concern | Scope | Architectural Impact |
|---------|-------|---------------------|
| **Caching** | All data operations | 3-tier cache with tag invalidation, stale-while-revalidate |
| **Type Safety** | Entire codebase | TypeScript-first, auto-generated types from schema |
| **Error Handling** | All components | Actionable messages, error boundaries, graceful degradation |
| **Security** | All entry points | CSRF, rate limiting, input validation, secrets management |
| **Observability** | All operations | Structured logging, request tracing, performance metrics |
| **Configuration** | All environments | Layer precedence (build < runtime < context) |
| **Testing** | All features | Edge simulation, mocking bindings, coverage requirements |

## Alignment with Brainstorming Decisions

The First Principles analysis from the brainstorming session established 17 architectural pillars. Key decisions to carry forward:

1. **Session Strategy:** JWT → KV (5-20ms) → DO (50-100ms) with latency budgeting
2. **Storage API:** Unified `services` API with escape hatches to raw Cloudflare bindings
3. **Routing:** File-based convention with URLPattern for advanced matching
4. **Middleware:** Functional composition with build-time inlining (zero runtime overhead)
5. **State Management:** Multi-scope (ephemeral/session/cached/persistent/realtime/blob)
6. **Rendering:** Islands architecture with streaming SSR and selective hydration
7. **ORM:** EdgeRecord with Active Record syntax, automatic KV caching, DO-backed writes

These decisions are consistent with the PRD requirements and NFR constraints.
