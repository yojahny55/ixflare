# Core Architectural Decisions

## Decision Priority Analysis

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

## Data Architecture

| Decision | Choice | Version/Details |
|----------|--------|-----------------|
| Schema Definition | TypeScript schema objects | Drizzle-style, pure TS |
| Migration Engine | Drizzle Kit (internal) | v0.41.0, D1-native |
| Migration CLI | `ix migrate` | Unified D1/KV/DO migrations |
| Seed Strategy | Hybrid (Factories + Fixtures) | @faker-js for dev, JSON for prod |
| Validation | Zod | v4.x, runtime type safety |

## Authentication & Security

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

## API & Communication Patterns

| Decision | Choice | Details |
|----------|--------|---------|
| Response Format | Envelope on error only | Naked success, structured error |
| Error Codes | Namespaced | `DOMAIN.SPECIFIC_ERROR` pattern |
| API Versioning | URL path (`/api/v1/`) | API routes only, SSR unversioned |

## Frontend Architecture

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

## Infrastructure & Deployment

| Decision | Choice | Details |
|----------|--------|---------|
| Environment Config | `edge.config.ts` | Merges defaults → wrangler → .env → runtime |
| CI/CD Approach | Hybrid | `ix deploy` CLI + GitHub/GitLab templates |
| Logging | Hybrid structured logger | CF Analytics default + optional adapters |

## Security Hardening (from Security Audit)

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

## Performance Optimizations (from Profiler Panel)

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

## System Architecture Insights (from Graph of Thoughts)

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

## User Experience Additions (from Focus Group)

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

## Revised Decisions (from Party Mode)

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

## Decision Impact Analysis

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
