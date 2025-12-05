# Epic 1: Foundation & Project Setup

**Epic Goal:** Enable developers to create new Ixflare projects with a single command, with proper configuration, TypeScript setup, and project structure ready for development.

**FR Coverage:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR107, FR122, FR123, FR124, FR141, FR142, FR143, FR145, FR169, FR170

---

## Story 1.1: Monorepo Structure & Build Pipeline

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

## Story 1.2: Create-Ixflare Scaffolder CLI

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

## Story 1.3: Project Type Selection & Structure Generation

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

## Story 1.4: Edge Configuration System

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

## Story 1.5: TypeScript Configuration & Type Safety

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

## Story 1.6: Environment Variable Management

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

## Story 1.7: Lifecycle Hooks & Extensibility

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

## Story 1.8: First-Time Deployment Guidance

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
