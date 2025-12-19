/**
 * Type definitions for the eject command
 */

export interface EjectOptions {
  /**
   * Only generate wrangler.toml, keep Vite managed by framework
   */
  configOnly?: boolean

  /**
   * Skip confirmation prompt (for CI/scripting)
   */
  yes?: boolean

  /**
   * Show help message
   */
  help?: boolean
}

export interface EjectResult {
  /**
   * Whether the ejection was successful
   */
  success: boolean

  /**
   * List of files that were generated
   */
  generatedFiles: string[]

  /**
   * List of backup files created
   */
  backupFiles: Array<{ original: string; backup: string }>

  /**
   * Errors encountered during ejection
   */
  errors?: string[]
}

export interface ProjectState {
  /**
   * Whether the project has already been ejected
   */
  isEjected: boolean

  /**
   * Whether edge.config.ts exists
   */
  hasEdgeConfig: boolean

  /**
   * Whether wrangler.toml exists
   */
  hasWranglerToml: boolean

  /**
   * Whether vite.config.ts exists
   */
  hasViteConfig: boolean
}

export interface EdgeConfig {
  /**
   * Application name (required)
   */
  name: string

  /**
   * Cloudflare Workers compatibility date
   */
  compatibilityDate?: string

  /**
   * Cloudflare Workers compatibility flags
   */
  compatibilityFlags?: string[]

  /**
   * Resource bindings
   */
  bindings: {
    d1?: D1Binding[]
    kv?: KVBinding[]
    r2?: R2Binding[]
    durableObjects?: DurableObjectBinding[]
  }

  /**
   * Environment variables
   */
  env?: Record<string, string | number | boolean>

  /**
   * Vite configuration
   */
  vite?: ViteConfigOptions

  /**
   * Database configuration
   */
  database?: {
    binding: string
    warmup?: boolean
  }

  /**
   * Cache configuration
   */
  cache?: {
    binding: string
    defaultTtl?: number
  }

  /**
   * Security configuration
   */
  security?: {
    csrf?: boolean | Record<string, unknown>
    headers?: boolean | Record<string, unknown>
  }

  /**
   * Lifecycle hooks (cannot be ejected)
   */
  hooks?: Record<string, unknown>

  /**
   * Custom commands (cannot be ejected)
   */
  commands?: Record<string, unknown>

  /**
   * Middleware (cannot be ejected)
   */
  middleware?: unknown[]
}

export interface D1Binding {
  binding: string
  databaseName: string
  databaseId?: string
  previewDatabaseId?: string
  migrationsDir?: string
}

export interface KVBinding {
  binding: string
  id?: string
  previewId?: string
}

export interface R2Binding {
  binding: string
  bucketName: string
  jurisdiction?: string
  previewBucketName?: string
}

export interface DurableObjectBinding {
  name: string
  className: string
  scriptName?: string
  environment?: string
}

export interface ViteConfigOptions {
  /**
   * Whether to include React plugin
   */
  react?: boolean

  /**
   * Build configuration
   */
  build?: {
    outDir?: string
    target?: string
    minify?: boolean
    sourcemap?: boolean
  }

  /**
   * Additional plugins
   */
  plugins?: unknown[]
}
