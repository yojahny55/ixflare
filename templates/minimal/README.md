# {{projectName}}

A minimal Ixflare project for Cloudflare Workers.

## Getting Started

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy
```

## Project Structure

```
{{projectName}}/
├── src/
│   └── index.ts      # Entry point
├── edge.config.ts    # Ixflare configuration
├── wrangler.toml     # Cloudflare configuration
├── vite.config.ts    # Build configuration
├── .env.example      # Environment variable template
└── .env.local        # Local environment (gitignored)
```

## Environment Variables

Ixflare uses a layered approach to environment configuration:

### Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your environment-specific values to `.env.local`

3. Generate TypeScript types:
   ```bash
   ix generate:env
   ```

### Loading Precedence

Environment variables are loaded with the following precedence (highest to lowest):

1. `wrangler.toml` [vars] section (highest priority)
2. `.dev.vars` (development only - for local secrets)
3. `.env.staging` (staging environment only)
4. `.env.production` (production environment only)
5. `.env.local` (local overrides, gitignored)
6. `.env` (default values, committed)

### Typed Environment Access

Use generated types for type-safe environment access:

```typescript
import type { LoaderArgs } from 'ixflare'
import type { Env } from '@/types/env'

export async function loader({ env }: LoaderArgs<Env>) {
  const apiKey = env.API_KEY // TypeScript knows the type
  return Response.json({ apiKey })
}
```

### Security Notes

- **Never commit** `.env.local`, `.dev.vars`, or `.env.production` to version control
- Always document variables in `.env.example`
- Use `.dev.vars` for local development secrets (Cloudflare Workers local mode)
- Set production secrets using `wrangler secret put <KEY>`

## Lifecycle Hooks & Custom Commands

Ixflare supports lifecycle hooks for build and deployment customization, plus custom CLI commands.

### Lifecycle Hooks

Add hooks to `edge.config.ts` to run custom logic at different stages:

```typescript
export default defineConfig({
  name: 'my-app',
  hooks: {
    'pre-build': async () => {
      // Runs before build starts
      console.log('Running code generation...')
    },
    'post-build': async ({ outputPath }) => {
      // Runs after build completes
      console.log(`Build output: ${outputPath}`)
    },
    'pre-deploy': async ({ environment }) => {
      // Runs before deployment
      console.log(`Deploying to ${environment}`)
    },
    'post-deploy': async ({ url }) => {
      // Runs after deployment
      console.log(`Deployed to ${url}`)
    },
  },
})
```

### Custom Commands

Add custom commands to `edge.config.ts`:

```typescript
export default defineConfig({
  name: 'my-app',
  commands: {
    'db:seed': {
      description: 'Seed the database',
      handler: async () => {
        console.log('Seeding database...')
        // Your logic here
      },
    },
  },
})
```

Run with `ix db:seed`. Custom commands appear in `ix --help`.

## Learn More

- [Ixflare Documentation](https://ixflare.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
