/**
 * @module types
 * @description Shared type definitions
 */

import type { Context } from '../core/context'

export interface Env {
  DB?: D1Database
  CACHE?: KVNamespace
  [key: string]: unknown
}

export interface LoaderArgs<E = Env> {
  request: Request
  context: Context<E>
  params: Record<string, string>
  env: E
}

export interface ActionArgs<E = Env> extends LoaderArgs<E> {
  formData: () => Promise<FormData>
}

export type RouteHandler<E = Env> = (args: LoaderArgs<E>) => Response | Promise<Response>

export type Middleware<E = Env> = (
  args: LoaderArgs<E>,
  next: () => Promise<Response>
) => Response | Promise<Response>

// Cloudflare Workers types
declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement
    batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
    exec(query: string): Promise<D1ExecResult>
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement
    first<T>(column?: string): Promise<T | null>
    run(): Promise<D1Result<unknown>>
    all<T>(): Promise<D1Result<T>>
    raw<T>(): Promise<T[]>
  }

  interface D1Result<T> {
    success: boolean
    results: T[]
    meta: D1Meta
    error?: string
  }

  interface D1Meta {
    duration: number
    changes: number
    last_row_id: number
    changed_db: boolean
    size_after: number
    rows_read: number
    rows_written: number
  }

  interface D1ExecResult {
    count: number
    duration: number
  }

  interface KVNamespace {
    get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null>
    put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expiration?: number; expirationTtl?: number }): Promise<void>
    delete(key: string): Promise<void>
    list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<KVListResult>
  }

  interface KVListResult {
    keys: Array<{ name: string; expiration?: number }>
    list_complete: boolean
    cursor?: string
  }
}
