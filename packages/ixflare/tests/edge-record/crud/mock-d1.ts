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
                const setParts = setClause.split(',')
                let valueIndex = 0

                for (const part of setParts) {
                  const trimmed = part.trim()

                  // Check for increment: field = field + ?
                  const incrementMatch = trimmed.match(/"?(\w+)"?\s*=\s*"?(\w+)"?\s*\+\s*\?/)
                  if (incrementMatch) {
                    const fieldName = incrementMatch[1]
                    const currentValue = Number(record[fieldName]) || 0
                    const incrementValue = Number(boundValues[valueIndex])
                    record[fieldName] = currentValue + incrementValue
                    valueIndex++
                    continue
                  }

                  // Check for decrement: field = field - ?
                  const decrementMatch = trimmed.match(/"?(\w+)"?\s*=\s*"?(\w+)"?\s*-\s*\?/)
                  if (decrementMatch) {
                    const fieldName = decrementMatch[1]
                    const currentValue = Number(record[fieldName]) || 0
                    const decrementValue = Number(boundValues[valueIndex])
                    record[fieldName] = currentValue - decrementValue
                    valueIndex++
                    continue
                  }

                  // Regular assignment: field = ?
                  const assignMatch = trimmed.match(/"?(\w+)"?\s*=\s*\?/)
                  if (assignMatch) {
                    const fieldName = assignMatch[1]
                    record[fieldName] = boundValues[valueIndex]
                    valueIndex++
                  }
                }
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

          // Handle SAVEPOINT commands
          if (
            query.toUpperCase().includes('SAVEPOINT') ||
            query.toUpperCase().includes('RELEASE SAVEPOINT') ||
            query.toUpperCase().includes('ROLLBACK TO SAVEPOINT')
          ) {
            return {
              results: [] as T[],
              success: true,
              meta: {
                duration: 0,
                changes: 0,
                last_row_id: 0,
                rows_read: 0,
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

        async all<T = unknown>(): Promise<D1Result<T>> {
          // Handle SELECT
          if (query.toUpperCase().includes('SELECT')) {
            let records = Array.from(store.values())

            // Apply WHERE clause filtering
            if (query.toUpperCase().includes('WHERE')) {
              const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+GROUP|\s+ORDER|\s+LIMIT|$)/i)
              if (whereMatch) {
                const fullCondition = whereMatch[1]

                // Track which params have been used for each condition
                let globalParamIndex = 0

                records = records.filter((record) => {
                  // Reset param index for each record evaluation
                  let paramIndex = globalParamIndex

                  // Parse all conditions - handle both AND and OR
                  // Split by OR first (lower precedence), then AND (higher precedence)
                  const orGroups = fullCondition.split(/\s+OR\s+/i)

                  const orResult = orGroups.some((group, groupIdx) => {
                    // For each OR group, reset param index to start of this group's params
                    // This is needed because OR branches might need same params
                    let currentParamIdx = paramIndex

                    // Split by AND
                    const andConditions = group.split(/\s+AND\s+/i)

                    const andResult = andConditions.every((condition) => {
                      // Remove outer parentheses
                      let trimmed = condition.trim()
                      while (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                        trimmed = trimmed.slice(1, -1).trim()
                      }

                      // Handle IS NULL
                      const isNullMatch = trimmed.match(/"?([^"\s]+)"?\s+IS\s+NULL/i)
                      if (isNullMatch) {
                        const fieldName = isNullMatch[1]
                        const val = record[fieldName]
                        return val === null || val === undefined
                      }

                      // Handle IS NOT NULL
                      const isNotNullMatch = trimmed.match(/"?([^"\s]+)"?\s+IS\s+NOT\s+NULL/i)
                      if (isNotNullMatch) {
                        const fieldName = isNotNullMatch[1]
                        const val = record[fieldName]
                        return val !== null && val !== undefined
                      }

                      // Handle comparison operators (>, <, >=, <=, !=, =)
                      const compMatch = trimmed.match(/"?([^"\s]+)"?\s*(>=|<=|!=|<>|>|<|=)\s*\?/)
                      if (compMatch) {
                        const fieldName = compMatch[1]
                        const operator = compMatch[2]
                        const value = boundValues[currentParamIdx++]
                        const recordValue = record[fieldName]

                        switch (operator) {
                          case '=':
                            return recordValue === value
                          case '!=':
                          case '<>':
                            return recordValue !== value
                          case '>':
                            return Number(recordValue) > Number(value)
                          case '<':
                            return Number(recordValue) < Number(value)
                          case '>=':
                            return Number(recordValue) >= Number(value)
                          case '<=':
                            return Number(recordValue) <= Number(value)
                          default:
                            return true
                        }
                      }

                      // Handle IN operator
                      const inMatch = trimmed.match(/"?([^"\s]+)"?\s+IN\s*\(([^)]+)\)/i)
                      if (inMatch) {
                        const fieldName = inMatch[1]
                        const placeholders = inMatch[2].split(',').map((p) => p.trim())
                        const values = placeholders.map(() => boundValues[currentParamIdx++])
                        return values.includes(record[fieldName])
                      }

                      // Unknown condition - pass through
                      return true
                    })

                    return andResult
                  })

                  return orResult
                })
              }
            }

            // Handle GROUP BY with aggregates
            if (query.toUpperCase().includes('GROUP BY')) {
              const groupMatch = query.match(/GROUP BY\s+"?([^"\s,]+)"?/i)
              if (groupMatch) {
                const groupField = groupMatch[1]
                const groups = new Map<unknown, Record<string, unknown>[]>()

                // Group records
                for (const record of records) {
                  const key = record[groupField]
                  if (!groups.has(key)) {
                    groups.set(key, [])
                  }
                  groups.get(key)!.push(record)
                }

                // Build grouped results
                const groupedResults: Record<string, unknown>[] = []
                for (const [key, groupRecords] of groups) {
                  const result: Record<string, unknown> = { [groupField]: key }

                  // Check for COUNT(*)
                  if (query.toUpperCase().includes('COUNT(*)')) {
                    result.count = groupRecords.length
                  }

                  // Check for SUM
                  const sumMatch = query.match(/SUM\("?([^")]+)"?\)/i)
                  if (sumMatch) {
                    const sumField = sumMatch[1]
                    result.sum = groupRecords.reduce(
                      (acc, r) => acc + (Number(r[sumField]) || 0),
                      0
                    )
                  }

                  // Check for AVG
                  const avgMatch = query.match(/AVG\("?([^")]+)"?\)/i)
                  if (avgMatch) {
                    const avgField = avgMatch[1]
                    const sum = groupRecords.reduce((acc, r) => acc + (Number(r[avgField]) || 0), 0)
                    result.avg = groupRecords.length > 0 ? sum / groupRecords.length : null
                  }

                  groupedResults.push(result)
                }

                return {
                  results: groupedResults as T[],
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
            }

            // Handle non-grouped aggregates
            if (
              query.toUpperCase().includes('COUNT(*)') &&
              !query.toUpperCase().includes('GROUP BY')
            ) {
              return {
                results: [{ count: records.length }] as T[],
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

            // Handle SUM without GROUP BY
            const sumMatch = query.match(/SUM\("?([^")]+)"?\)/i)
            if (sumMatch && !query.toUpperCase().includes('GROUP BY')) {
              const sumField = sumMatch[1]
              const sum = records.reduce((acc, r) => acc + (Number(r[sumField]) || 0), 0)
              return {
                results: [{ sum }] as T[],
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

            // Handle AVG without GROUP BY
            const avgMatch = query.match(/AVG\("?([^")]+)"?\)/i)
            if (avgMatch && !query.toUpperCase().includes('GROUP BY')) {
              const avgField = avgMatch[1]
              if (records.length === 0) {
                return {
                  results: [{ avg: null }] as T[],
                  success: true,
                  meta: {
                    duration: 1,
                    changes: 0,
                    last_row_id: 0,
                    rows_read: 0,
                    rows_written: 0,
                  },
                }
              }
              const sum = records.reduce((acc, r) => acc + (Number(r[avgField]) || 0), 0)
              return {
                results: [{ avg: sum / records.length }] as T[],
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

            // Handle MIN without GROUP BY
            const minMatch = query.match(/MIN\("?([^")]+)"?\)/i)
            if (minMatch && !query.toUpperCase().includes('GROUP BY')) {
              const minField = minMatch[1]
              if (records.length === 0) {
                return {
                  results: [{ min: null }] as T[],
                  success: true,
                  meta: { duration: 1, changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0 },
                }
              }
              const values = records
                .map((r) => r[minField])
                .filter((v) => v !== null && v !== undefined)
              const min = values.length > 0 ? Math.min(...values.map(Number)) : null
              return {
                results: [{ min }] as T[],
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

            // Handle MAX without GROUP BY
            const maxMatch = query.match(/MAX\("?([^")]+)"?\)/i)
            if (maxMatch && !query.toUpperCase().includes('GROUP BY')) {
              const maxField = maxMatch[1]
              if (records.length === 0) {
                return {
                  results: [{ max: null }] as T[],
                  success: true,
                  meta: { duration: 1, changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0 },
                }
              }
              const values = records
                .map((r) => r[maxField])
                .filter((v) => v !== null && v !== undefined)
              const max = values.length > 0 ? Math.max(...values.map(Number)) : null
              return {
                results: [{ max }] as T[],
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

            // Handle ORDER BY clause
            const orderMatch = query.match(/ORDER BY\s+"?([^"\s,]+)"?\s*(ASC|DESC)?/i)
            if (orderMatch) {
              const orderField = orderMatch[1]
              const direction = orderMatch[2]?.toUpperCase() === 'DESC' ? -1 : 1
              records.sort((a, b) => {
                const aVal = a[orderField]
                const bVal = b[orderField]
                if (aVal === bVal) return 0
                if (aVal === null || aVal === undefined) return 1
                if (bVal === null || bVal === undefined) return -1
                return aVal < bVal ? -1 * direction : 1 * direction
              })
            }

            // Handle LIMIT and OFFSET clauses
            const limitMatch = query.match(/LIMIT\s+(\d+)/i)
            const offsetMatch = query.match(/OFFSET\s+(\d+)/i)
            if (limitMatch || offsetMatch) {
              const limit = limitMatch ? parseInt(limitMatch[1], 10) : records.length
              const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0
              records = records.slice(offset, offset + limit)
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
          // Handle aggregate queries (COUNT, SUM, AVG, MIN, MAX without GROUP BY)
          if (query.toUpperCase().includes('SELECT')) {
            let records = Array.from(store.values())

            // Apply WHERE clause filtering for aggregates (same logic as all())
            if (query.toUpperCase().includes('WHERE')) {
              const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+GROUP|\s+ORDER|\s+LIMIT|$)/i)
              if (whereMatch) {
                const fullCondition = whereMatch[1]

                records = records.filter((record) => {
                  let paramIndex = 0
                  const orGroups = fullCondition.split(/\s+OR\s+/i)

                  return orGroups.some((group) => {
                    let currentParamIdx = paramIndex
                    const andConditions = group.split(/\s+AND\s+/i)

                    return andConditions.every((condition) => {
                      let trimmed = condition.trim()
                      while (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                        trimmed = trimmed.slice(1, -1).trim()
                      }

                      // Handle IS NULL
                      const isNullMatch = trimmed.match(/"?([^"\s]+)"?\s+IS\s+NULL/i)
                      if (isNullMatch) {
                        const fieldName = isNullMatch[1]
                        const val = record[fieldName]
                        return val === null || val === undefined
                      }

                      // Handle IS NOT NULL
                      const isNotNullMatch = trimmed.match(/"?([^"\s]+)"?\s+IS\s+NOT\s+NULL/i)
                      if (isNotNullMatch) {
                        const fieldName = isNotNullMatch[1]
                        const val = record[fieldName]
                        return val !== null && val !== undefined
                      }

                      // Handle comparison operators
                      const compMatch = trimmed.match(/"?([^"\s]+)"?\s*(>=|<=|!=|<>|>|<|=)\s*\?/)
                      if (compMatch) {
                        const fieldName = compMatch[1]
                        const operator = compMatch[2]
                        const value = boundValues[currentParamIdx++]
                        const recordValue = record[fieldName]

                        switch (operator) {
                          case '=':
                            return recordValue === value
                          case '!=':
                          case '<>':
                            return recordValue !== value
                          case '>':
                            return Number(recordValue) > Number(value)
                          case '<':
                            return Number(recordValue) < Number(value)
                          case '>=':
                            return Number(recordValue) >= Number(value)
                          case '<=':
                            return Number(recordValue) <= Number(value)
                          default:
                            return true
                        }
                      }

                      return true
                    })
                  })
                })
              }
            }

            // Handle COUNT(*)
            if (query.toUpperCase().includes('COUNT(*)')) {
              return { count: records.length } as T
            }

            // Handle SUM
            const sumMatch = query.match(/SUM\("?([^")]+)"?\)/i)
            if (sumMatch) {
              const sumField = sumMatch[1]
              const sum = records.reduce((acc, r) => acc + (Number(r[sumField]) || 0), 0)
              return { sum } as T
            }

            // Handle AVG
            const avgMatch = query.match(/AVG\("?([^")]+)"?\)/i)
            if (avgMatch) {
              const avgField = avgMatch[1]
              if (records.length === 0) {
                return { avg: null } as T
              }
              const sum = records.reduce((acc, r) => acc + (Number(r[avgField]) || 0), 0)
              return { avg: sum / records.length } as T
            }

            // Handle MIN
            const minMatch = query.match(/MIN\("?([^")]+)"?\)/i)
            if (minMatch) {
              const minField = minMatch[1]
              if (records.length === 0) {
                return { min: null } as T
              }
              const values = records
                .map((r) => r[minField])
                .filter((v) => v !== null && v !== undefined)
              const min = values.length > 0 ? Math.min(...values.map(Number)) : null
              return { min } as T
            }

            // Handle MAX
            const maxMatch = query.match(/MAX\("?([^")]+)"?\)/i)
            if (maxMatch) {
              const maxField = maxMatch[1]
              if (records.length === 0) {
                return { max: null } as T
              }
              const values = records
                .map((r) => r[maxField])
                .filter((v) => v !== null && v !== undefined)
              const max = values.length > 0 ? Math.max(...values.map(Number)) : null
              return { max } as T
            }

            // Handle regular SELECT with WHERE (existing logic)
            if (query.toUpperCase().includes('WHERE')) {
              const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i)
              if (whereMatch) {
                const conditions = whereMatch[1]
                const fieldNames: string[] = []
                const regex = /"([^"]+)"\s*=\s*\?|(\w+)\s*=\s*\?/g
                let match
                while ((match = regex.exec(conditions)) !== null) {
                  fieldNames.push(match[1] || match[2])
                }

                if (fieldNames.length > 0) {
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
