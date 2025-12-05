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

## Learn More

- [Ixflare Documentation](https://ixflare.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
