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
