/**
 * Mock KVNamespace for testing
 */
export class MockKVNamespace implements KVNamespace {
  private store = new Map<string, { value: string; expiration?: number }>()

  async get(key: string): Promise<string | null>
  async get(key: string, type: 'text'): Promise<string | null>
  async get(key: string, type: 'json'): Promise<Record<string, unknown> | null>
  async get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
  async get(key: string, type: 'stream'): Promise<ReadableStream | null>
  async get(
    key: string,
    type?: 'text' | 'json' | 'arrayBuffer' | 'stream'
  ): Promise<string | Record<string, unknown> | ArrayBuffer | ReadableStream | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    // Check expiration
    if (entry.expiration && Date.now() > entry.expiration) {
      this.store.delete(key)
      return null
    }

    if (!type || type === 'text') {
      return entry.value
    }

    if (type === 'json') {
      return JSON.parse(entry.value)
    }

    // arrayBuffer and stream not implemented for mock
    throw new Error(`MockKV: ${type} type not implemented`)
  }

  async put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: { expiration?: number; expirationTtl?: number }
  ): Promise<void> {
    let expiration: number | undefined
    if (options?.expirationTtl) {
      expiration = Date.now() + options.expirationTtl * 1000
    } else if (options?.expiration) {
      expiration = options.expiration * 1000
    }

    this.store.set(key, {
      value: typeof value === 'string' ? value : '<binary>',
      expiration,
    })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string; expiration?: number }[]
    list_complete: boolean
    cursor?: string
  }> {
    const keys: { name: string; expiration?: number }[] = []

    for (const [name, entry] of this.store.entries()) {
      // Check expiration
      if (entry.expiration && Date.now() > entry.expiration) {
        this.store.delete(name)
        continue
      }

      // Apply prefix filter
      if (options?.prefix && !name.startsWith(options.prefix)) {
        continue
      }

      keys.push({ name, expiration: entry.expiration })

      // Apply limit
      if (options?.limit && keys.length >= options.limit) {
        break
      }
    }

    return {
      keys,
      list_complete: true,
    }
  }

  /**
   * Helper for testing: get all stored keys
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
  getRaw(key: string): string | undefined {
    return this.store.get(key)?.value
  }
}
