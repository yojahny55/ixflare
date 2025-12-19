/**
 * Edge config reader - Parses edge.config.ts and extracts configuration
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { EdgeConfig } from './types.js'

/**
 * Read and parse edge.config.ts
 *
 * Uses dynamic import to load the TypeScript config file.
 * Node.js v20.6+ supports TypeScript directly with --experimental-strip-types,
 * but for broader compatibility, we rely on the user having tsx or ts-node available.
 */
export async function readEdgeConfig(projectRoot: string): Promise<EdgeConfig> {
  const configPath = join(projectRoot, 'edge.config.ts')

  if (!existsSync(configPath)) {
    throw new Error('edge.config.ts not found in project root')
  }

  try {
    // Use tsx to load TypeScript config if available
    // This is a common dev dependency in TypeScript projects
    let config: { default: unknown }

    try {
      // Try to use tsx loader (most projects will have this)
      const tsxPath = join(projectRoot, 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs')
      if (existsSync(tsxPath)) {
        // Register tsx loader
        const { tsImport } = await import(tsxPath)
        config = await tsImport(configPath, import.meta.url)
      } else {
        // Fallback: try direct import (works if user has Node.js with TS support)
        config = await import(pathToFileURL(configPath).href)
      }
    } catch {
      // Last resort: try direct import
      config = await import(pathToFileURL(configPath).href)
    }

    if (!config?.default) {
      throw new Error('edge.config.ts must export a default configuration')
    }

    const userConfig = config.default as Record<string, unknown>

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
