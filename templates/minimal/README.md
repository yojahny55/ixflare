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

## Learn More

- [Ixflare Documentation](https://ixflare.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
