# {{projectName}}

An API backend built with Ixflare for Cloudflare Workers.

## Getting Started

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy
```

## First-Time Deployment

Deploy your API to Cloudflare Workers edge network globally! The guided setup makes it effortless.

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier available)
- Node.js 18+ installed

### Quick Start Guide

First deployment? Ixflare walks you through it:

```bash
npm run deploy
# → First-time deployment detected!
# → To deploy to Cloudflare Workers, you need:
#    1. A Cloudflare account (free)
#    2. An API token with Workers permissions
# → Let's set this up:
```

### Authentication Options

#### Option 1: Browser Login (Local Development)

Easiest for local development:

```bash
npm run deploy
# → Choose "Browser login"
# → Browser opens automatically
# → Authenticate with Cloudflare
# → Return to terminal
# ✅ Authentication successful!
```

#### Option 2: API Token (Production/CI)

For CI/CD pipelines and automation:

1. Visit [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Copy the token and set it:
   ```bash
   export CLOUDFLARE_API_TOKEN="your-token-here"
   ```

### Configuration

Add your account ID to `wrangler.toml`:

```toml
name = "{{projectName}}"
main = "dist/index.js"
compatibility_date = "2024-01-01"
account_id = "your-account-id"  # From dash.cloudflare.com
```

### Deploy Your API

```bash
npm run deploy
```

The deployment process:
1. ✓ Checks prerequisites (wrangler, authentication)
2. ✓ Validates bundle size (<3MB for free tier)
3. ✓ Validates request limits (100MB max)
4. ✓ Builds your API
5. ✓ Uploads to Cloudflare Workers
6. ✓ Returns your live API URL

**Your API is live at:** `https://your-api.your-subdomain.workers.dev`

### Environment-Specific Deployments

Deploy to multiple environments:

```bash
# Staging environment
IXFLARE_ENV=staging npm run deploy

# Production environment (default)
npm run deploy
```

Configure in `wrangler.toml`:

```toml
[env.staging]
vars = { DB_URL = "https://staging-db.example.com" }

[env.production]
vars = { DB_URL = "https://prod-db.example.com" }
```

### Managing API Secrets

Set sensitive API keys and credentials:

```bash
# Set database connection string
wrangler secret put DATABASE_URL

# Set third-party API keys
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put SENDGRID_API_KEY
```

### CI/CD Integration

Skip interactive first-time setup in CI:

```bash
# GitHub Actions, GitLab CI, etc.
ix deploy --skip-first-time

# Or set environment variables
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
npm run deploy
```

## Project Structure

```
{{projectName}}/
├── src/
│   ├── index.ts           # Entry point
│   └── routes/
│       └── api/
│           └── v1/
│               └── users.ts  # Example API route
├── edge.config.ts         # Ixflare configuration
├── wrangler.toml          # Cloudflare configuration
└── vite.config.ts         # Build configuration
```

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/v1/users` - List users (example)
- `POST /api/v1/users` - Create user (example)

## Environment Variables

### Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your API keys and secrets to `.env.local`

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

export async function GET({ env }: LoaderArgs<Env>) {
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

Automate API operations with lifecycle hooks and custom CLI commands.

### Lifecycle Hooks

Configure in `edge.config.ts`:

```typescript
export default defineConfig({
  name: 'my-api',
  hooks: {
    'pre-deploy': async ({ environment }) => {
      // Run database migrations before deployment
      await runMigrations(environment)
    },
    'post-deploy': async ({ url }) => {
      // Run API smoke tests after deployment
      await testEndpoints(url)
    },
  },
})
```

**Hook phases:**
- `pre-build`: Before build (e.g., generate OpenAPI spec)
- `post-build`: After build (e.g., analyze bundle size)
- `pre-deploy`: Before deployment (e.g., run migrations)
- `post-deploy`: After deployment (e.g., warm cache, notify monitoring)

### Custom Commands

Add API-specific commands:

```typescript
export default defineConfig({
  name: 'my-api',
  commands: {
    'api:test': {
      description: 'Run API integration tests',
      handler: async () => {
        // Testing logic
      },
    },
    'cache:warm': {
      description: 'Pre-warm API cache',
      handler: async () => {
        // Cache warming logic
      },
    },
  },
})
```

Run with `ix api:test` or `ix cache:warm`. List all with `ix --help`.

## Learn More

- [Ixflare Documentation](https://ixflare.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
