/**
 * @module tests/edge-record/schema/timestamps
 * @description Tests for timestamps helper
 */

import { describe, it, expect } from 'vitest'
import { timestamps } from '@/edge-record/schema/timestamps'

describe('timestamps()', () => {
  it('should return createdAt and updatedAt fields', () => {
    const result = timestamps()

    expect(result).toHaveProperty('createdAt')
    expect(result).toHaveProperty('updatedAt')
  })

  it('should have datetime type for both fields', () => {
    const result = timestamps()

    expect(result.createdAt.config.type).toBe('datetime')
    expect(result.updatedAt.config.type).toBe('datetime')
  })

  it('should have default values set', () => {
    const result = timestamps()

    expect(result.createdAt.config.default).toBeDefined()
    expect(result.updatedAt.config.default).toBeDefined()
  })

  it('should not be nullable by default', () => {
    const result = timestamps()

    expect(result.createdAt.config.nullable).toBe(false)
    expect(result.updatedAt.config.nullable).toBe(false)
  })

  it('should be spreadable into schema definition', () => {
    const schema = {
      id: { type: 'id' as const },
      name: { type: 'string' as const },
      ...timestamps(),
    }

    expect(schema).toHaveProperty('id')
    expect(schema).toHaveProperty('name')
    expect(schema).toHaveProperty('createdAt')
    expect(schema).toHaveProperty('updatedAt')
  })
})
