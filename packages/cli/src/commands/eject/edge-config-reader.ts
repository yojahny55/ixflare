/**
 * Edge config reader - Parses edge.config.ts and extracts configuration
 */

import { existsSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import type { EdgeConfig } from './types.js'

/**
 * Try to load tsx from various possible locations
 * Returns the tsImport function if found, null otherwise
 */
async function tryLoadTsx(projectRoot: string): Promise<((specifier: string, parentUrl: string) => Promise<{ default: unknown }>) | null> {
  // Common tsx paths to try (handles different package manager layouts)
  const possiblePaths = [
    join(projectRoot, 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs'),
    join(projectRoot, 'node_modules', 'tsx', 'dist', 'esm', 'api', 'index.mjs'),
    join(projectRoot, 'node_modules', '.pnpm', 'tsx@*/node_modules/tsx/dist/esm/index.mjs'),
  ]

  for (const tsxPath of possiblePaths) {
    // Handle glob pattern for pnpm
    if (tsxPath.includes('*')) {
      // Skip glob patterns - too complex for simple resolution
      continue
    }
    if (existsSync(tsxPath)) {
      try {
        const tsx = await import(tsxPath)
        if (tsx.tsImport) {
          return tsx.tsImport
        }
      } catch {
        // Continue to next path
      }
    }
  }

  return null
}

/**
 * Fallback: Use subprocess to evaluate config via npx tsx
 */
function loadConfigViaSubprocess(configPath: string): Record<string, unknown> {
  const tempFile = join(tmpdir(), `edge-config-loader-${Date.now()}.mjs`)

  try {
    // Create a loader script that imports the config and outputs JSON
    const loaderScript = `
import config from '${configPath.replace(/\\/g, '/')}';
console.log(JSON.stringify(config.default || config));
`
    writeFileSync(tempFile, loaderScript, 'utf-8')

    // Run with npx tsx
    const result = execSync(`npx tsx "${tempFile}"`, {
      cwd: configPath.substring(0, configPath.lastIndexOf('/')),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000, // 30 second timeout
    })

    return JSON.parse(result.trim())
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempFile)
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Read and parse edge.config.ts
 *
 * Uses multiple strategies to load the TypeScript config file:
 * 1. Try to import tsx directly from node_modules
 * 2. Try direct import (works with Node.js experimental TS support)
 * 3. Fall back to subprocess with npx tsx
 */
export async function readEdgeConfig(projectRoot: string): Promise<EdgeConfig> {
  const configPath = join(projectRoot, 'edge.config.ts')

  if (!existsSync(configPath)) {
    throw new Error('edge.config.ts not found in project root')
  }

  let userConfig: Record<string, unknown>

  try {
    // Strategy 1: Try to use tsx loader directly
    const tsImport = await tryLoadTsx(projectRoot)
    if (tsImport) {
      const config = await tsImport(configPath, import.meta.url)
      if (!config?.default) {
        throw new Error('edge.config.ts must export a default configuration')
      }
      userConfig = config.default as Record<string, unknown>
    } else {
      // Strategy 2: Try direct import (works if Node.js has TS support enabled)
      try {
        const config = await import(pathToFileURL(configPath).href)
        if (!config?.default) {
          throw new Error('edge.config.ts must export a default configuration')
        }
        userConfig = config.default as Record<string, unknown>
      } catch {
        // Strategy 3: Fall back to subprocess with npx tsx
        userConfig = loadConfigViaSubprocess(configPath)
      }
    }

    // Extract and transform configuration
    return transformEdgeConfig(userConfig)
  } catch (error) {
    throw new Error(
      `Failed to read edge.config.ts: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Transform user config into internal EdgeConfig format
 */
function transformEdgeConfig(userConfig: Record<string, unknown>): EdgeConfig {
  const config: EdgeConfig = {
    name: userConfig.name as string,
    compatibilityDate: getCurrentCompatibilityDate(),
    compatibilityFlags: [],
    bindings: {
      d1: [],
      kv: [],
      r2: [],
      durableObjects: [],
    },
    env: {},
  }

  // Extract environment variables
  if (userConfig.env && typeof userConfig.env === 'object') {
    config.env = userConfig.env as Record<string, string | number | boolean>
  }

  // Extract database configuration (D1)
  if (userConfig.database && typeof userConfig.database === 'object') {
    const db = userConfig.database as Record<string, unknown>
    config.bindings.d1 = [
      {
        binding: (db.binding as string) || 'DB',
        databaseName: `${config.name}-db`,
        // Note: databaseId needs to be configured manually or via wrangler d1 create
        // We'll add a comment in the generated wrangler.toml
      },
    ]
  }

  // Extract cache configuration (KV)
  if (userConfig.cache && typeof userConfig.cache === 'object') {
    const cache = userConfig.cache as Record<string, unknown>
    config.bindings.kv = [
      {
        binding: (cache.binding as string) || 'CACHE',
        // Note: id needs to be configured manually or via wrangler kv:namespace create
        // We'll add a comment in the generated wrangler.toml
      },
    ]
  }

  // Extract Vite configuration hints
  config.vite = {
    react: true, // Default assumption for Ixflare projects
    build: {
      outDir: 'dist',
      target: 'esnext',
      minify: true,
      sourcemap: true,
    },
  }

  // Store non-ejectable features for warning
  if (userConfig.hooks) {
    config.hooks = userConfig.hooks as Record<string, unknown>
  }
  if (userConfig.commands) {
    config.commands = userConfig.commands as Record<string, unknown>
  }
  if (userConfig.middleware) {
    config.middleware = userConfig.middleware as unknown[]
  }
  if (userConfig.security) {
    config.security = userConfig.security as EdgeConfig['security']
  }

  return config
}

/**
 * Get current compatibility date in YYYY-MM-DD format
 * Uses current date as default
 */
function getCurrentCompatibilityDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
