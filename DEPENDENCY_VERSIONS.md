# Dependency Versions - Single Source of Truth

This document defines the **canonical versions** for all dependencies used across the Ixflare monorepo. All packages and templates MUST use these exact versions to prevent inconsistencies.

**Last Updated:** 2025-12-05
**Created From:** Epic 1 Retrospective Action Item #1

---

## Core Runtime Dependencies

| Dependency  | Version   | Used In                  | Notes                                                      |
| ----------- | --------- | ------------------------ | ---------------------------------------------------------- |
| `zod`       | `^4.0.0`  | ixflare, templates       | Validation library - Zod 4.x for 14x faster string parsing |
| `react`     | `^19.0.0` | fullstack-react template | React 19 with Server Components                            |
| `react-dom` | `^19.0.0` | fullstack-react template | React DOM for SSR/hydration                                |

---

## Build & Development Tools

| Dependency   | Version   | Used In                  | Notes                                                       |
| ------------ | --------- | ------------------------ | ----------------------------------------------------------- |
| `typescript` | `^5.9.3`  | ALL packages & templates | TypeScript 5.x with strict mode                             |
| `tsup`       | `^8.5.0`  | ALL packages             | Build tool (consider tsdown migration - see technical debt) |
| `vitest`     | `^4.0.0`  | ALL packages & templates | Test runner                                                 |
| `vite`       | `^6.0.0`  | vite-plugin, templates   | Build tool and dev server                                   |
| `turbo`      | `^2.6.3`  | root                     | Monorepo build orchestration                                |
| `prettier`   | `^3.7.4`  | root                     | Code formatting                                             |
| `eslint`     | `^9.39.1` | root, templates          | Linting (ESLint 9.x flat config)                            |

---

## TypeScript & Type Definitions

| Dependency                         | Version    | Used In                              | Notes                             |
| ---------------------------------- | ---------- | ------------------------------------ | --------------------------------- |
| `@types/node`                      | `^22.19.1` | packages (root, cli, create-ixflare) | Node.js types                     |
| `@types/node`                      | `^20.0.0`  | ixflare package                      | Slightly older for Workers compat |
| `@types/react`                     | `^19.0.0`  | fullstack-react template             | React 19 types                    |
| `@types/react-dom`                 | `^19.0.0`  | fullstack-react template             | React DOM types                   |
| `@types/prompts`                   | `^2.4.9`   | cli, create-ixflare                  | Prompts library types             |
| `@typescript-eslint/eslint-plugin` | `^8.48.1`  | root                                 | TypeScript ESLint plugin          |
| `@typescript-eslint/parser`        | `^8.48.1`  | root                                 | TypeScript ESLint parser          |

---

## Cloudflare & Deployment

| Dependency                  | Version   | Used In            | Notes                         |
| --------------------------- | --------- | ------------------ | ----------------------------- |
| `@cloudflare/workers-types` | `^4.0.0`  | ixflare, templates | Workers runtime types         |
| `wrangler`                  | `^4.53.0` | templates          | Cloudflare CLI for deployment |

---

## UI & Styling

| Dependency             | Version  | Used In                  | Notes             |
| ---------------------- | -------- | ------------------------ | ----------------- |
| `tailwindcss`          | `^4.0.0` | fullstack-react template | CSS framework     |
| `@vitejs/plugin-react` | `^4.3.0` | fullstack-react template | Vite React plugin |

---

## CLI & Utilities

| Dependency        | Version   | Used In             | Notes                   |
| ----------------- | --------- | ------------------- | ----------------------- |
| `prompts`         | `^2.4.2`  | cli, create-ixflare | Interactive CLI prompts |
| `@changesets/cli` | `^2.29.8` | root                | Version management      |

---

## ESLint Plugins

| Dependency                         | Version   | Used In   | Notes                           |
| ---------------------------------- | --------- | --------- | ------------------------------- |
| `@eslint/js`                       | `^9.39.1` | root      | ESLint JavaScript config        |
| `@typescript-eslint/eslint-plugin` | `^8.0.0`  | templates | TypeScript ESLint for templates |
| `@typescript-eslint/parser`        | `^8.0.0`  | templates | TypeScript parser for templates |
| `eslint-plugin-import`             | `^2.31.0` | templates | Import ordering/validation      |
| `typescript-eslint`                | `^8.48.1` | root      | TypeScript ESLint integration   |

---

## Dependencies Added in Epic 2 (Story 2.0)

These dependencies were added for Vite Plugin Foundation & Router Infrastructure:

| Dependency                | Version  | Used In                                  | Notes                                                |
| ------------------------- | -------- | ---------------------------------------- | ---------------------------------------------------- |
| `chokidar`                | `^5.0.0` | vite-plugin-ixflare                      | File watching for route changes (ESM-only, Node 20+) |
| `fast-glob`               | `^3.3.3` | vite-plugin-ixflare                      | File discovery for routes                            |
| `@cloudflare/vite-plugin` | `^1.0.0` | vite-plugin-ixflare (peerDep), templates | Workers runtime integration - see ADR-001            |

### Removed Dependencies (ADR-001, 2025-12-05)

| Dependency      | Previous Version | Reason                                                                                                                                      |
| --------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~`miniflare`~~ | `^4.20251202.1`  | **REMOVED** - Miniflare is "lower level API for tools creators". Use `@cloudflare/vite-plugin` instead, which handles Miniflare internally. |

**ADR-001 Rationale:**

- Cloudflare recommends using `@cloudflare/vite-plugin` for Vite-based frameworks
- The Cloudflare plugin runs workerd for production parity
- Bindings (D1, KV, R2) configured via `wrangler.toml`
- All major frameworks (React Router v7, TanStack Start) use this approach
- See: `docs/architecture/adr-001-cloudflare-vite-plugin-integration.md`

---

## Version Update Process

When updating a dependency version:

1. **Update this file first** - Change the version in this document
2. **Update root package.json** - For shared dev dependencies
3. **Update all package.json files** - In packages/ that use the dependency
4. **Update all template package.json files** - In templates/ that use the dependency
5. **Run `pnpm install`** - To update lockfile
6. **Run `pnpm test`** - Verify no regressions
7. **Create PR** - With clear changelog

---

## Package Manager

| Tool   | Version    | Notes                    |
| ------ | ---------- | ------------------------ |
| `pnpm` | `>=10.0.0` | Required package manager |
| `node` | `>=18.0.0` | Minimum Node.js version  |

---

## Type Export Patterns (Standardized)

All packages MUST use this export pattern for proper CJS/ESM dual support:

```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  }
}
```

**Key Rules:**

- ESM types use `.d.ts` extension
- CJS types use `.d.cts` extension
- Never use `.d.mts` (causes resolution issues)
- Always specify `types` before `default` in conditional exports

---

## Technical Debt Notes

### tsup → tsdown Migration

- **Status:** Planned for Epic 2 or 3
- **Reason:** tsup is no longer actively maintained
- **Alternative:** tsdown (actively maintained fork)
- **Impact:** All packages using tsup need migration

### Zod Function Type Casts

- **Status:** Low priority
- **Location:** `packages/cli/src/hooks/index.ts`
- **Issue:** HooksRunner requires type casts for Zod function types
- **Workaround:** Using `as unknown as` pattern

---

## Validation Script

Run this command to check for version mismatches:

```bash
# Check all package.json files for version consistency
pnpm exec turbo run typecheck
```

---

_This document is the single source of truth for dependency versions. When in doubt, refer to this file._
