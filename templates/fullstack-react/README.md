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

## Learn More

- [Ixflare Documentation](https://ixflare.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [React Documentation](https://react.dev)
