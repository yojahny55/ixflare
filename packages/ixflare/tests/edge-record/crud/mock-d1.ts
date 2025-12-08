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
          // Handle INSERT ... ON CONFLICT (upsert)
          if (
            query.toUpperCase().includes('INSERT') &&
            query.toUpperCase().includes('ON CONFLICT')
          ) {
            // Parse conflict columns
            const conflictMatch = query.match(/ON CONFLICT\s*\(([^)]+)\)/i)
            const conflictColumns = conflictMatch
              ? conflictMatch[1].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
              : []

            // Parse INSERT fields
            const fieldsMatch = query.match(/INSERT INTO.*?\(([^)]+)\)\s*VALUES/i)
            const fields = fieldsMatch
              ? fieldsMatch[1].split(',').map((f) => f.trim().replace(/^"|"$/g, ''))
              : []

            // Build a record with the values
            const newRecord: Record<string, unknown> = {}
            fields.forEach((field, index) => {
              newRecord[field] = boundValues[index]
            })

            // Check if a record with matching conflict columns exists
            let existingRecord: Record<string, unknown> | undefined
            let existingId: number | undefined
            for (const [id, record] of store.entries()) {
              let matches = true
              for (const col of conflictColumns) {
                if (record[col] !== newRecord[col]) {
                  matches = false
                  break
                }
              }
              if (matches) {
                existingRecord = record
                existingId = id
                break
              }
            }

            if (existingRecord && existingId !== undefined) {
              // Parse SET clause from DO UPDATE
              const setMatch = query.match(/DO UPDATE SET\s+(.+)$/i)
              if (setMatch) {
                // Parse the set clause: "field" = excluded."field", ...
                const setParts = setMatch[1].split(',')
                for (const part of setParts) {
                  const fieldMatch = part.match(/"?(\w+)"?\s*=/)
                  if (fieldMatch) {
                    const fieldName = fieldMatch[1]
                    // Get value from newRecord (which represents "excluded")
                    if (fieldName in newRecord) {
                      existingRecord[fieldName] = newRecord[fieldName]
                    }
                  }
                }
              }

              return {
                results: [] as T[],
                success: true,
                meta: {
                  duration: 1,
                  changes: 1,
                  last_row_id: existingId,
                  rows_read: 1,
                  rows_written: 1,
                },
              }
            } else {
              // Insert new record
              const id = nextId++
              newRecord.id = id
              store.set(id, newRecord)

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
          }

          // Handle regular INSERT
          if (query.toUpperCase().includes('INSERT')) {
            const id = nextId++
            const fields = query
              .match(/\((.*?)\)/)?.[1]
              .split(',')
              .map((f) => f.trim().replace(/^"|"$/g, '')) // Strip quotes from field names
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
                const fields = setClause
                  .split(',')
                  .map((f) => f.trim().split('=')[0].trim().replace(/^"|"$/g, '')) // Strip quotes
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
          // Handle SELECT with WHERE
          if (query.toUpperCase().includes('SELECT') && query.toUpperCase().includes('WHERE')) {
            // Try to match records based on WHERE conditions
            // Parse WHERE clause to extract field names (handles both quoted "field" and unquoted field)
            const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i)
            if (whereMatch) {
              const conditions = whereMatch[1]
              // Extract field names - handle both "field_name" = ? and field_name = ?
              const fieldNames: string[] = []
              const regex = /"([^"]+)"\s*=\s*\?|(\w+)\s*=\s*\?/g
              let match
              while ((match = regex.exec(conditions)) !== null) {
                // match[1] is for "quoted", match[2] is for unquoted
                fieldNames.push(match[1] || match[2])
              }

              if (fieldNames.length > 0) {
                // Try each record to find a match
                for (const record of store.values()) {
                  let matches = true
                  fieldNames.forEach((fieldName, index) => {
                    if (record[fieldName] !== boundValues[index]) {
                      matches = false
                    }
                  })
                  if (matches) {
                    return record as T
                  }
                }
              }
            }

            // Fallback: try id-based lookup
            const id = boundValues[0] as number
            if (typeof id === 'number') {
              const record = store.get(id)
              return (record as T) || null
            }
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
