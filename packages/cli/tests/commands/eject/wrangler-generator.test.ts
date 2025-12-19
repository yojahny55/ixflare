/**
 * Tests for wrangler.toml generator
 */

import { describe, it, expect } from 'vitest'
import { generateWranglerToml } from '../../../src/commands/eject/wrangler-generator'
import type { EdgeConfig } from '../../../src/commands/eject/types'

describe('generateWranglerToml', () => {
  it('should generate minimal wrangler.toml', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
    }

    const toml = generateWranglerToml(config)

    expect(toml).toContain('name = "my-app"')
    expect(toml).toContain('main = "dist/worker.js"')
    expect(toml).toContain('compatibility_date = "2025-01-01"')
    expect(toml).toContain('upload_source_maps = true')
    expect(toml).toContain('minify = true')
  })

  it('should generate compatibility flags', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      compatibilityFlags: ['nodejs_compat', 'streams_enable_constructors'],
      bindings: {},
    }

    const toml = generateWranglerToml(config)

    expect(toml).toContain('compatibility_flags = ["nodejs_compat", "streams_enable_constructors"]')
  })

  it('should generate environment variables', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
      env: {
        API_URL: 'https://api.example.com',
        DEBUG: true,
        MAX_RETRIES: 3,
      },
    }

    const toml = generateWranglerToml(config)

    expect(toml).toContain('[vars]')
    expect(toml).toContain('API_URL = "https://api.example.com"')
    expect(toml).toContain('DEBUG = true')
    expect(toml).toContain('MAX_RETRIES = 3')
  })

  it('should generate D1 database bindings', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {
        d1: [
          {
            binding: 'DB',
            databaseName: 'my-app-db',
            databaseId: 'abc123',
            migrationsDir: 'migrations',
          },
        ],
      },
    }

    const toml = generateWranglerToml(config)

    expect(toml).toContain('[[d1_databases]]')
    expect(toml).toContain('binding = "DB"')
    expect(toml).toContain('database_name = "my-app-db"')
    expect(toml).toContain('database_id = "abc123"')
    expect(toml).toContain('migrations_dir = "migrations"')
  })

  it('should generate D1 binding with comment for missing database_id', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {
        d1: [
          {
            binding: 'DB',
            databaseName: 'my-app-db',
          },
        ],
      },
    }

    const toml = generateWranglerToml(config)

    expect(toml).toContain('# database_id = "YOUR_DATABASE_ID"')
    expect(toml).toContain('wrangler d1 create')
  })

  it('should generate KV namespace bindings', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {
        kv: [
          {
            binding: 'CACHE',
            id: 'xyz789',
            previewId: 'preview-123',
          },
        ],
      },
    }

    const toml = generateWranglerToml(config)

    expect(toml).toContain('[[kv_namespaces]]')
    expect(toml).toContain('binding = "CACHE"')
    expect(toml).toContain('id = "xyz789"')
    expect(toml).toContain('preview_id = "preview-123"')
  })

  it('should generate KV binding with comment for missing id', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {
        kv: [
          {
            binding: 'CACHE',
          },
        ],
      },
    }

    const toml = generateWranglerToml(config)

    expect(toml).toContain('# id = "YOUR_KV_NAMESPACE_ID"')
    expect(toml).toContain('wrangler kv:namespace create')
  })

  it('should generate R2 bucket bindings', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {
        r2: [
          {
            binding: 'BUCKET',
            bucketName: 'my-bucket',
            jurisdiction: 'eu',
            previewBucketName: 'my-bucket-preview',
          },
        ],
      },
    }

    const toml = generateWranglerToml(config)

    expect(toml).toContain('[[r2_buckets]]')
    expect(toml).toContain('binding = "BUCKET"')
    expect(toml).toContain('bucket_name = "my-bucket"')
    expect(toml).toContain('jurisdiction = "eu"')
    expect(toml).toContain('preview_bucket_name = "my-bucket-preview"')
  })

  it('should generate Durable Object bindings', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {
        durableObjects: [
          {
            name: 'COUNTER',
            className: 'Counter',
            scriptName: 'external-worker',
            environment: 'production',
          },
        ],
      },
    }

    const toml = generateWranglerToml(config)

    expect(toml).toContain('[[durable_objects.bindings]]')
    expect(toml).toContain('name = "COUNTER"')
    expect(toml).toContain('class_name = "Counter"')
    expect(toml).toContain('script_name = "external-worker"')
    expect(toml).toContain('environment = "production"')
  })

  it('should generate toml with multiple bindings', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {
        d1: [{ binding: 'DB', databaseName: 'db' }],
        kv: [{ binding: 'CACHE' }],
        r2: [{ binding: 'BUCKET', bucketName: 'bucket' }],
      },
    }

    const toml = generateWranglerToml(config)

    expect(toml).toContain('[[d1_databases]]')
    expect(toml).toContain('[[kv_namespaces]]')
    expect(toml).toContain('[[r2_buckets]]')
  })

  it('should end with newline', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
    }

    const toml = generateWranglerToml(config)

    expect(toml.endsWith('\n')).toBe(true)
  })
})
