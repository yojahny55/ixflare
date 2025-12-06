# Ixflare Project Templates

This directory contains starter templates for creating new Ixflare projects with `create-ixflare`.

## Available Templates

| Template | Description | Use Case |
|----------|-------------|----------|
| `minimal` | Bare minimum edge project | Learning, simple APIs, quick prototypes |
| `api-backend` | API-only backend | REST APIs, microservices, webhooks |
| `fullstack-react` | React + API + SSR | Full web applications with React UI |

## Template Structure

### minimal/
```
minimal/
├── src/
│   ├── index.ts          # Entry point
│   ├── routes/
│   │   └── index.ts      # Example route handler
│   ├── models/
│   │   └── example.ts    # Example EdgeRecord model
│   └── types/
│       └── index.ts      # Type definitions
├── tests/
│   └── example.test.ts   # Example test
├── package.json
├── edge.config.ts
├── wrangler.toml
├── vite.config.ts
├── tsconfig.json
├── _gitignore            # Renamed to .gitignore on scaffold
└── _env.example          # Renamed to .env.example on scaffold
```

### api-backend/
```
api-backend/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   └── api/
│   │       └── v1/
│   │           ├── health.ts   # Health check endpoint
│   │           └── users.ts    # Example CRUD endpoint
│   ├── models/
│   │   └── user.ts
│   ├── schemas/
│   │   └── user.ts             # Zod validation schemas
│   ├── services/
│   │   └── user-service.ts     # Business logic layer
│   └── types/
│       └── index.ts
├── tests/
│   ├── routes/
│   │   └── api/
│   │       └── v1/
│   │           └── users.test.ts
│   └── services/
│       └── user-service.test.ts
├── package.json
├── edge.config.ts
├── wrangler.toml
├── vite.config.ts
├── tsconfig.json
├── _gitignore
└── _env.example
```

### fullstack-react/
```
fullstack-react/
├── src/
│   ├── index.ts
│   ├── main.tsx              # React client entry
│   ├── App.tsx               # Root React component
│   ├── index.css             # Global styles (Tailwind)
│   ├── routes/
│   │   ├── index.tsx         # Root SSR page component
│   │   └── api/
│   │       └── v1/
│   │           └── users.ts  # Example API endpoint
│   ├── components/
│   │   └── ui/
│   │       └── button.tsx    # Example UI component
│   ├── models/
│   │   └── user.ts
│   ├── schemas/
│   │   └── user.ts
│   └── types/
│       └── index.ts
├── public/                   # Static assets
│   └── .gitkeep
├── tests/
│   └── routes/
│       └── api/
│           └── v1/
│               └── users.test.ts
├── package.json
├── edge.config.ts
├── wrangler.toml
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── _gitignore
└── _env.example
```

## Shared Fragments

The `_fragments/` directory contains reusable configuration files that are shared across templates:

| Fragment | Purpose |
|----------|---------|
| `base-config.ts` | Common edge.config.ts settings |
| `tsconfig-base.json` | TypeScript compiler options |
| `eslint-base.js` | ESLint rules for edge runtime |

Templates can reference these fragments for consistency. The scaffolding process handles incorporating these into final project configs.

## Template Variables

Templates support the following placeholder variables that are replaced during scaffolding:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{projectName}}` | Project name as provided by user | `my-app` |
| `{{projectNameKebab}}` | Project name in kebab-case | `my-app` |
| `{{projectNamePascal}}` | Project name in PascalCase | `MyApp` |

## File Naming Conventions

- Files prefixed with `_` are renamed to `.` during scaffolding (e.g., `_gitignore` → `.gitignore`)
- Binary files (PNG, JPG, fonts) are copied without modification
- SVG files support template variable replacement
- Text files support template variable replacement

## Adding a New Template

1. Create a new directory under `templates/`
2. Add required files following the structure above
3. Use template variables for project-specific values
4. Add the template to `create-ixflare` CLI options
5. Write tests in `packages/create-ixflare/tests/templates/`

## Testing Templates

Each template should have corresponding tests that verify:

- Directory structure completeness
- Required files exist
- Template variable replacement works
- No forbidden files included (e.g., React in api-backend)

Run tests with:
```bash
pnpm test --filter=create-ixflare
```
