/**
 * @module tests/edge-record/relations/mock-d1-relations
 * @description Enhanced mock D1Database for testing relationships with IN clause support
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
 * Create an enhanced mock D1Database for testing relationships
 * Supports IN clauses for eager loading
 */
export function createRelationMockD1Database(): D1Database {
  // Map of table name -> Map of id -> record
  const tables: Map<string, Map<number, Record<string, unknown>>> = new Map()
  const nextIds: Map<string, number> = new Map()

  function getTable(tableName: string): Map<number, Record<string, unknown>> {
    if (!tables.has(tableName)) {
      tables.set(tableName, new Map())
      nextIds.set(tableName, 1)
    }
    return tables.get(tableName)!
  }

  function getNextId(tableName: string): number {
    const id = nextIds.get(tableName) || 1
    nextIds.set(tableName, id + 1)
    return id
  }

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
            const tableMatch = query.match(/INSERT INTO\s+(?:"|`)?([\w_]+)(?:"|`)?/i)
            const tableName = tableMatch ? tableMatch[1] : 'unknown'
            const table = getTable(tableName)

            const fieldsMatch = query.match(/\(([^)]+)\)\s*VALUES/i)
            const fields = fieldsMatch
              ? fieldsMatch[1].split(',').map((f) => f.trim().replace(/^["'`]|["'`]$/g, ''))
              : []

            const record: Record<string, unknown> = {}
            let insertedId: number

            // Check if id is provided in values
            const idIndex = fields.findIndex((f) => f === 'id')
            if (idIndex !== -1 && boundValues[idIndex] != null) {
              insertedId = boundValues[idIndex] as number
              record.id = insertedId
            } else {
              insertedId = getNextId(tableName)
              record.id = insertedId
            }

            fields.forEach((field, index) => {
              if (field !== 'id') {
                record[field] = boundValues[index]
              }
            })

            table.set(insertedId, record)

            return {
              results: [] as T[],
              success: true,
              meta: {
                duration: 1,
                changes: 1,
                last_row_id: insertedId,
                rows_read: 0,
                rows_written: 1,
              },
            }
          }

          return {
            results: [] as T[],
            success: true,
            meta: { duration: 1, changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0 },
          }
        },

        async all<T = unknown>(): Promise<D1Result<T>> {
          // Handle SELECT
          if (query.toUpperCase().includes('SELECT')) {
            const tableMatch = query.match(/FROM\s+(?:"|`)?([\w_]+)(?:"|`)?/i)
            const tableName = tableMatch ? tableMatch[1] : null

            if (!tableName) {
              return {
                results: [] as T[],
                success: true,
                meta: { duration: 1, changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0 },
              }
            }

            const table = getTable(tableName)
            let records = Array.from(table.values())

            // Handle WHERE IN clause
            if (query.toUpperCase().includes('WHERE') && query.toUpperCase().includes(' IN ')) {
              const whereMatch = query.match(/WHERE\s+(?:"|`)?([\w_]+)(?:"|`)?\s+IN\s*\(([^)]+)\)/i)
              if (whereMatch) {
                const fieldName = whereMatch[1]
                const placeholderCount = whereMatch[2].split(',').length

                // Get the IN values from boundValues
                const inValues = boundValues.slice(0, placeholderCount)

                records = records.filter((record) => {
                  return inValues.includes(record[fieldName])
                })
              }
            }

            // Handle simple WHERE clause with = operator
            else if (query.toUpperCase().includes('WHERE')) {
              const whereMatch = query.match(/WHERE\s+(?:"|`)?([\w_]+)(?:"|`)?\s*=\s*\?/i)
              if (whereMatch && boundValues.length > 0) {
                const fieldName = whereMatch[1]
                const value = boundValues[0]

                records = records.filter((record) => {
                  return record[fieldName] === value
                })
              }
            }

            return {
              results: records as T[],
              success: true,
              meta: {
                duration: 1,
                changes: 0,
                last_row_id: 0,
                rows_read: records.length,
                rows_written: 0,
              },
            }
          }

          return {
            results: [] as T[],
            success: true,
            meta: { duration: 1, changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0 },
          }
        },

        async first<T = unknown>(): Promise<T | null> {
          const result = await statement.all<T>()
          return result.results[0] || null
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
        meta: { duration: 1, changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0 },
      }
    },
  }
}
