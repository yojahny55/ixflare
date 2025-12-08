# @ixflare/tsconfig

Shared TypeScript configurations for Ixflare projects.

## Installation

```bash
pnpm add -D @ixflare/tsconfig
```

## Usage

### Base Configuration (Workers)

For Cloudflare Workers projects:

```json
{
  "extends": "@ixflare/tsconfig/base",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "edge.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### React Configuration

For React projects with SSR:

```json
{
  "extends": "@ixflare/tsconfig/react"
}
```

### Node.js Configuration

For Node.js-only packages (CLI, build tools):

```json
{
  "extends": "@ixflare/tsconfig/node"
}
```

## Features

- **Strict mode** enabled for maximum type safety
- **ESNext target** for modern JavaScript
- **Bundler module resolution** for Workers compatibility
- **Cloudflare Workers types** included
- **Verbatim module syntax** for correct imports/exports

## Configurations

### base.json

Core configuration for Cloudflare Workers projects. Includes:

- ES2022 target and lib
- Strict type checking
- Workers types from `@cloudflare/workers-types`

### react.json

Extends base configuration with React support:

- DOM and DOM.Iterable lib
- react-jsx transform
- React type definitions

### node.json

Extends base configuration for Node.js:

- Node.js type definitions
- Appropriate lib settings

## License

MIT
