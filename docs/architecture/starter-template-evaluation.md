# Starter Template Evaluation

## Primary Technology Domain

**Developer Tool / Framework** - This project builds a framework that provides starter templates, rather than consuming one.

## Framework Architecture Decision (ADR-001)

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

## Simplified Package Structure

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

## Build Tooling Decisions

| Package | Build Tool | Output Format | Rationale |
|---------|-----------|---------------|-----------|
| `ixflare` | tsup | ESM + CJS | Library bundling, tree-shakeable |
| `vite-plugin-ixflare` | tsup | ESM + CJS | Vite plugin (Node.js only) |
| `create-ixflare` | tsup | CJS | Node.js CLI |
| `cli` | tsup | CJS | Node.js CLI |
| User projects | Vite + vite-plugin-ixflare | Workers bundle | Application bundling |

**Key Insight:** Vite is for application builds (user projects), tsup is for library builds (our packages).

## Bundle Size Compliance Strategy

| Import Pattern | Estimated Size | Compliance |
|----------------|---------------|------------|
| `import { Router } from 'ixflare'` | ~14KB | ✅ Well under 50KB |
| `import { EdgeRecord } from 'ixflare/orm'` | +15KB (~29KB) | ✅ Under 50KB |
| `import { renderToStream } from 'ixflare/ssr'` | +10KB (~39KB) | ✅ Under 50KB |
| Full import (all features) | ~39KB | ✅ Under 50KB |

## TypeScript Configuration

- TypeScript 5.x with strict mode enabled
- ES2022 target for Workers compatibility
- Project references for incremental builds
- Dual CJS/ESM output for CLI Node.js compatibility
- Subpath exports for modular tree-shaking

## Scalability Path

1. **MVP:** pnpm workspaces + tsup (current decision)
2. **If builds > 2 min:** Add Turborepo for caching
3. **If 10+ packages:** Consider Nx for project graph
4. **If remote teams:** Enable Turborepo remote caching

## User-Facing Templates (to be built)

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

## Template Health Guarantee

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
