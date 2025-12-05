/**
 * @module config/types
 * @description Configuration type definitions
 */

export interface IxflareConfig {
  /** Application name */
  name: string

  /** Database configuration */
  database?: {
    /** D1 binding name */
    binding?: string
    /** Connection warmup for cold starts */
    warmup?: boolean
  }

  /** Cache configuration */
  cache?: {
    /** KV binding name */
    binding?: string
    /** Default TTL in seconds */
    defaultTtl?: number
  }

  /** Security configuration */
  security?: {
    /** Enable CSRF protection */
    csrf?: boolean
    /** Auto-inject security headers */
    headers?: boolean
  }

  /** Lifecycle hooks */
  hooks?: {
    'pre-build'?: () => Promise<void> | void
    'post-build'?: (context: { outputPath: string }) => Promise<void> | void
    'pre-deploy'?: (context: { environment: string }) => Promise<void> | void
    'post-deploy'?: (context: { url: string }) => Promise<void> | void
  }

  /** Custom CLI commands */
  commands?: Record<string, {
    description: string
    handler: () => Promise<void> | void
  }>
}
