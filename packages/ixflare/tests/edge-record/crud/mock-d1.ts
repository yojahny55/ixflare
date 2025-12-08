/**
 * @module tests/edge-record/crud/mock-d1
 * @description Mock D1Database for testing CRUD operations
 */

interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: {
    duration: number
    changes: number
    last_row_id: number
    rows_read: number
    rows_written: number
  }
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  run<T = unknown>(): Promise<D1Result<T>>
  all<T = unknown>(): Promise<D1Result<T>>
  first<T = unknown>(): Promise<T | null>
  raw<T = unknown>(): Promise<T[]>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<D1Result<unknown>[]>
  exec(query: string): Promise<D1Result<unknown>>
}

/**
 * Create a mock D1Database for testing
 */
export function createMockD1Database(): D1Database {
  const store: Map<number, Record<string, unknown>> = new Map()
  let nextId = 1

  return {
    prepare(query: string): D1PreparedStatement {
      let boundValues: unknown[] = []

      const statement: D1PreparedStatement = {
        bind(...values: unknown[]): D1PreparedStatement {
          boundValues = values
          return statement
        },

        async run<T = unknown>(): Promise<D1Result<T>> {
          // Handle INSERT
          if (query.toUpperCase().includes('INSERT')) {
            const id = nextId++
            const fields = query
              .match(/\((.*?)\)/)?.[1]
              .split(',')
              .map((f) => f.trim())
            const record: Record<string, unknown> = { id }

            if (fields) {
              fields.forEach((field, index) => {
                record[field] = boundValues[index]
              })
            }

            store.set(id, record)

            return {
              results: [] as T[],
              success: true,
              meta: {
                duration: 1,
                changes: 1,
                last_row_id: id,
                rows_read: 0,
                rows_written: 1,
              },
            }
          }

          // Handle UPDATE
          if (query.toUpperCase().includes('UPDATE')) {
            const id = boundValues[boundValues.length - 1] as number
            const record = store.get(id)

            if (record) {
              // Parse SET clause fields
              const setClause = query.match(/SET\s+(.*?)\s+WHERE/i)?.[1]
              if (setClause) {
                const fields = setClause.split(',').map((f) => f.trim().split('=')[0].trim())
                fields.forEach((field, index) => {
                  record[field] = boundValues[index]
                })
              }

              return {
                results: [] as T[],
                success: true,
                meta: {
                  duration: 1,
                  changes: 1,
                  last_row_id: 0,
                  rows_read: 1,
                  rows_written: 1,
                },
              }
            }
          }

          // Handle DELETE
          if (query.toUpperCase().includes('DELETE')) {
            const id = boundValues[0] as number
            const existed = store.has(id)
            store.delete(id)

            return {
              results: [] as T[],
              success: true,
              meta: {
                duration: 1,
                changes: existed ? 1 : 0,
                last_row_id: 0,
                rows_read: existed ? 1 : 0,
                rows_written: existed ? 1 : 0,
              },
            }
          }

          return {
            results: [] as T[],
            success: true,
            meta: {
              duration: 1,
              changes: 0,
              last_row_id: 0,
              rows_read: 0,
              rows_written: 0,
            },
          }
        },

        async all<T = unknown>(): Promise<D1Result<T>> {
          // Handle SELECT
          if (query.toUpperCase().includes('SELECT')) {
            const results = Array.from(store.values()) as T[]

            return {
              results,
              success: true,
              meta: {
                duration: 1,
                changes: 0,
                last_row_id: 0,
                rows_read: results.length,
                rows_written: 0,
              },
            }
          }

          return {
            results: [] as T[],
            success: true,
            meta: {
              duration: 1,
              changes: 0,
              last_row_id: 0,
              rows_read: 0,
              rows_written: 0,
            },
          }
        },

        async first<T = unknown>(): Promise<T | null> {
          // Handle SELECT with WHERE id = ?
          if (query.toUpperCase().includes('SELECT') && query.toUpperCase().includes('WHERE')) {
            const id = boundValues[0] as number
            const record = store.get(id)
            return (record as T) || null
          }

          return null
        },

        async raw<T = unknown>(): Promise<T[]> {
          return []
        },
      }

      return statement
    },

    async batch(statements: D1PreparedStatement[]): Promise<D1Result<unknown>[]> {
      const results: D1Result<unknown>[] = []

      for (const stmt of statements) {
        const result = await stmt.run()
        results.push(result)
      }

      return results
    },

    async exec(query: string): Promise<D1Result<unknown>> {
      return {
        results: [],
        success: true,
        meta: {
          duration: 1,
          changes: 0,
          last_row_id: 0,
          rows_read: 0,
          rows_written: 0,
        },
      }
    },
  }
}
