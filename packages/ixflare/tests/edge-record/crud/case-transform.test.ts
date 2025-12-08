/**
 * @module tests/edge-record/crud/case-transform.test
 * @description Tests for case transformation utilities
 */

import { describe, it, expect } from 'vitest'
import {
  toCamelCase,
  toSnakeCase,
  transformKeysToCamelCase,
  transformKeysToSnakeCase,
} from '@/edge-record/crud/case-transform'

describe('toCamelCase', () => {
  it('should convert snake_case to camelCase', () => {
    expect(toCamelCase('created_at')).toBe('createdAt')
    expect(toCamelCase('updated_at')).toBe('updatedAt')
    expect(toCamelCase('user_id')).toBe('userId')
  })

  it('should handle already camelCase strings', () => {
    expect(toCamelCase('createdAt')).toBe('createdAt')
    expect(toCamelCase('userId')).toBe('userId')
  })

  it('should handle single words', () => {
    expect(toCamelCase('id')).toBe('id')
    expect(toCamelCase('name')).toBe('name')
  })

  it('should handle multiple underscores', () => {
    expect(toCamelCase('created_at_timestamp')).toBe('createdAtTimestamp')
  })
})

describe('toSnakeCase', () => {
  it('should convert camelCase to snake_case', () => {
    expect(toSnakeCase('createdAt')).toBe('created_at')
    expect(toSnakeCase('updatedAt')).toBe('updated_at')
    expect(toSnakeCase('userId')).toBe('user_id')
  })

  it('should handle already snake_case strings', () => {
    expect(toSnakeCase('created_at')).toBe('created_at')
    expect(toSnakeCase('user_id')).toBe('user_id')
  })

  it('should handle single words', () => {
    expect(toSnakeCase('id')).toBe('id')
    expect(toSnakeCase('name')).toBe('name')
  })

  it('should handle multiple uppercase letters', () => {
    expect(toSnakeCase('createdAtTimestamp')).toBe('created_at_timestamp')
  })
})

describe('transformKeysToCamelCase', () => {
  it('should transform all object keys from snake_case to camelCase', () => {
    const input = {
      user_id: 1,
      created_at: 1733311800000,
      updated_at: 1733311800000,
    }

    const output = transformKeysToCamelCase(input)

    expect(output).toEqual({
      userId: 1,
      createdAt: 1733311800000,
      updatedAt: 1733311800000,
    })
  })

  it('should handle empty objects', () => {
    expect(transformKeysToCamelCase({})).toEqual({})
  })

  it('should preserve values while transforming keys', () => {
    const input = {
      user_name: 'Jordan',
      is_active: true,
      age: 30,
    }

    const output = transformKeysToCamelCase(input)

    expect(output).toEqual({
      userName: 'Jordan',
      isActive: true,
      age: 30,
    })
  })
})

describe('transformKeysToSnakeCase', () => {
  it('should transform all object keys from camelCase to snake_case', () => {
    const input = {
      userId: 1,
      createdAt: 1733311800000,
      updatedAt: 1733311800000,
    }

    const output = transformKeysToSnakeCase(input)

    expect(output).toEqual({
      user_id: 1,
      created_at: 1733311800000,
      updated_at: 1733311800000,
    })
  })

  it('should handle empty objects', () => {
    expect(transformKeysToSnakeCase({})).toEqual({})
  })

  it('should preserve values while transforming keys', () => {
    const input = {
      userName: 'Jordan',
      isActive: true,
      age: 30,
    }

    const output = transformKeysToSnakeCase(input)

    expect(output).toEqual({
      user_name: 'Jordan',
      is_active: true,
      age: 30,
    })
  })
})
