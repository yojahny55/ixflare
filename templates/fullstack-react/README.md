# {{projectName}}

A fullstack React application built with Ixflare for Cloudflare Workers.

## Getting Started

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy
```

## Architecture

This template uses a **plugin composition** pattern for local development:

```typescript
// vite.config.ts
import { cloudflare } from '@cloudflare/vite-plugin'
import { ixflare } from 'vite-plugin-ixflare'

export default defineConfig({
  plugins: [
    cloudflare(),  // Workers runtime: D1, KV, R2, workerd
    react(),       // React JSX/TSX support
    ixflare(),     // File-based routing
  ],
})
```

**Plugin Responsibilities:**
- **@cloudflare/vite-plugin**: Runs actual `workerd` runtime for production parity. Provides D1, KV, R2, Durable Objects bindings. Reads configuration from `wrangler.toml`.
- **vite-plugin-ixflare**: Discovers routes from `src/routes/`, generates route manifest, handles route-specific HMR.
- **@vitejs/plugin-react**: React JSX/TSX compilation, Fast Refresh for component HMR.

## Bindings Configuration

Configure Cloudflare bindings in `wrangler.toml`. They're automatically available in local development:

```toml
# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "my-database"

# KV Namespace
[[kv_namespaces]]
binding = "CACHE"

# R2 Bucket
[[r2_buckets]]
binding = "STORAGE"
```

Access bindings in your route handlers:

```typescript
export async function GET({ env }: RouteContext) {
  const result = await env.DB.prepare('SELECT * FROM users').all()
  return Response.json(result)
}
```

## First-Time Deployment

Deploy your React application to Cloudflare Workers in minutes! The CLI handles all the complexity.

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier available)
- Node.js 18+ installed

### Authentication

On your first deployment, Ixflare will automatically detect you're not authenticated and guide you:

```bash
npm run deploy
# → First-time deployment detected!
# → Do you have a Cloudflare account? (Y/n)
# → How would you like to authenticate?
#    1. Browser login (recommended for local dev)
#    2. API token (recommended for CI/CD)
```

#### Browser Login (Recommended)

1. Select "Browser login" from the prompts
2. Your browser will open automatically
3. Log in to Cloudflare
4. Return to terminal - you're authenticated!

#### API Token (CI/CD)

For automated deployments:

1. Create a token at [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Use the "Edit Cloudflare Workers" template
3. Set in your environment:
   ```bash
   export CLOUDFLARE_API_TOKEN="your-token-here"
   ```

### Configuration

Update `wrangler.toml` with your account ID:

```toml
name = "{{projectName}}"
main = "dist/index.js"
compatibility_date = "2024-01-01"
account_id = "your-account-id"  # Find at dash.cloudflare.com
```

### Deploy

```bash
npm run deploy
```

Ixflare will:
- ✓ Verify deployment prerequisites
- ✓ Check bundle size (React SSR apps should stay under 3MB compressed)
- ✓ Build your React application
- ✓ Deploy to Cloudflare Workers
- ✓ Show your live URL

**Your app is now live at:** `https://your-app.your-subdomain.workers.dev`

### Multi-Environment Deployment

Deploy to different environments:

```bash
# Deploy to staging
IXFLARE_ENV=staging npm run deploy

# Deploy to production (default)
npm run deploy
```

Configure environments in `wrangler.toml`:

```toml
[env.staging]
vars = { API_URL = "https://staging-api.example.com" }

[env.production]
vars = { API_URL = "https://api.example.com" }
```

### Secrets Management

Set encrypted secrets for production:

```bash
# Interactive prompt for secret value
wrangler secret put DATABASE_URL
wrangler secret put API_KEY
```

## Project Structure

```
{{projectName}}/
├── src/
│   ├── index.ts           # Worker entry point
│   ├── App.tsx            # React application
│   ├── index.css          # Global styles (Tailwind)
│   ├── components/        # React components
│   └── routes/
│       └── api/           # API routes
├── edge.config.ts         # Ixflare configuration
├── wrangler.toml          # Cloudflare configuration
├── vite.config.ts         # Build configuration
└── tailwind.config.js     # Tailwind CSS configuration
```

## Features

- React 19 with Server Components
- Tailwind CSS for styling
- API routes alongside React pages
- SSR on Cloudflare Workers

## Environment Variables

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

Customize your build and deployment pipeline with lifecycle hooks and add custom CLI commands.

### Lifecycle Hooks

Configure hooks in `edge.config.ts`:

```typescript
export default defineConfig({
  name: 'my-app',
  hooks: {
    'post-build': async ({ outputPath }) => {
      // Upload sourcemaps to error tracking service
      await uploadSourcemaps(outputPath)
    },
    'post-deploy': async ({ url }) => {
      // Notify team in Slack
      await notifySlack(`Deployed to ${url}`)
    },
  },
})
```

**Available hooks:**
- `pre-build`: Before build starts
- `post-build`: After build completes (receives `outputPath`)
- `pre-deploy`: Before deployment (receives `environment`)
- `post-deploy`: After deployment (receives `url`)

### Custom Commands

Add project-specific commands:

```typescript
export default defineConfig({
  name: 'my-app',
  commands: {
    'db:seed': {
      description: 'Seed database with sample data',
      handler: async () => {
        // Seeding logic
      },
    },
  },
})
```

Run with `ix db:seed`. View all commands with `ix --help`.

## Learn More

- [Ixflare Documentation](https://ixflare.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [React Documentation](https://react.dev)
