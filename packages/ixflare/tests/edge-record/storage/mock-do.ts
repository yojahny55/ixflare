/**
 * Mock DurableObjectStorage for testing
 */
export class MockDurableObjectStorage implements DurableObjectStorage {
  private store = new Map<string, unknown>()

  async get<T = unknown>(key: string): Promise<T | undefined>
  async get<T = unknown>(keys: string[]): Promise<Map<string, T>>
  async get<T = unknown>(key: string | string[]): Promise<T | undefined | Map<string, T>> {
    if (Array.isArray(key)) {
      const result = new Map<string, T>()
      for (const k of key) {
        const value = this.store.get(k)
        if (value !== undefined) {
          result.set(k, value as T)
        }
      }
      return result
    }

    return this.store.get(key) as T | undefined
  }

  async put<T>(key: string, value: T): Promise<void>
  async put<T>(entries: Record<string, T>): Promise<void>
  async put<T>(keyOrEntries: string | Record<string, T>, value?: T): Promise<void> {
    if (typeof keyOrEntries === 'string') {
      this.store.set(keyOrEntries, value as T)
    } else {
      for (const [k, v] of Object.entries(keyOrEntries)) {
        this.store.set(k, v)
      }
    }
  }

  async delete(key: string): Promise<boolean>
  async delete(keys: string[]): Promise<number>
  async delete(key: string | string[]): Promise<boolean | number> {
    if (Array.isArray(key)) {
      let count = 0
      for (const k of key) {
        if (this.store.delete(k)) {
          count++
        }
      }
      return count
    }

    return this.store.delete(key)
  }

  async list(options?: { start?: string; end?: string; limit?: number }): Promise<Map<string, unknown>> {
    const result = new Map<string, unknown>()
    const keys = Array.from(this.store.keys()).sort()

    for (const key of keys) {
      if (options?.start && key < options.start) continue
      if (options?.end && key >= options.end) continue

      result.set(key, this.store.get(key))

      if (options?.limit && result.size >= options.limit) break
    }

    return result
  }

  async deleteAll(): Promise<void> {
    this.store.clear()
  }

  async transaction<T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T> {
    // Simple transaction implementation: apply operations to a clone,
    // then commit if successful
    const backup = new Map(this.store)

    const txn: DurableObjectTransaction = {
      get: this.get.bind(this) as DurableObjectTransaction['get'],
      put: this.put.bind(this) as DurableObjectTransaction['put'],
      delete: this.delete.bind(this) as DurableObjectTransaction['delete'],
      rollback: () => {
        this.store = backup
      },
      deleteAll: this.deleteAll.bind(this),
    }

    try {
      const result = await closure(txn)
      // Commit successful, keep changes
      return result
    } catch (error) {
      // Rollback on error
      this.store = backup
      throw error
    }
  }

  /**
   * Helper for testing: get all keys
   */
  getAllKeys(): string[] {
    return Array.from(this.store.keys())
  }

  /**
   * Helper for testing: clear all data
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Helper for testing: get raw value
   */
  getRaw(key: string): unknown {
    return this.store.get(key)
  }
}
