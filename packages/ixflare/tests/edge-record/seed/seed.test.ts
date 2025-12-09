import { describe, it, expect } from 'vitest'
import { seed, isSeedFunction } from '../../../src/edge-record/seed'

describe('seed()', () => {
  it('should mark function as a seed', async () => {
    const mockSeed = seed(async () => {
      // Mock seed implementation
    })

    expect(mockSeed.__isSeed).toBe(true)
  })

  it('should preserve async function behavior', async () => {
    let executed = false
    const mockSeed = seed(async () => {
      executed = true
    })

    await mockSeed()
    expect(executed).toBe(true)
  })

  it('should accept custom name option', () => {
    const mockSeed = seed(async () => {}, { name: 'test-seed' })
    expect(mockSeed.name).toBe('test-seed')
  })

  it('should accept environment option', () => {
    const mockSeed = seed(async () => {}, { environment: 'development' })
    expect(mockSeed.environment).toBe('development')
  })

  it('should accept multiple environments', () => {
    const mockSeed = seed(async () => {}, {
      environment: ['development', 'test'],
    })
    expect(mockSeed.environment).toEqual(['development', 'test'])
  })

  it('should accept dependencies option', () => {
    const mockSeed = seed(async () => {}, {
      dependencies: ['users', 'roles'],
    })
    expect(mockSeed.dependencies).toEqual(['users', 'roles'])
  })

  it('should handle all options together', () => {
    const mockSeed = seed(async () => {}, {
      name: 'advanced-seed',
      environment: ['development'],
      dependencies: ['base-seed'],
    })

    expect(mockSeed.name).toBe('advanced-seed')
    expect(mockSeed.environment).toEqual(['development'])
    expect(mockSeed.dependencies).toEqual(['base-seed'])
    expect(mockSeed.__isSeed).toBe(true)
  })
})

describe('isSeedFunction()', () => {
  it('should return true for seed functions', () => {
    const mockSeed = seed(async () => {})
    expect(isSeedFunction(mockSeed)).toBe(true)
  })

  it('should return false for regular functions', () => {
    const regularFn = async () => {}
    expect(isSeedFunction(regularFn)).toBe(false)
  })

  it('should return false for non-functions', () => {
    expect(isSeedFunction(null)).toBe(false)
    expect(isSeedFunction(undefined)).toBe(false)
    expect(isSeedFunction({})).toBe(false)
    expect(isSeedFunction('string')).toBe(false)
    expect(isSeedFunction(123)).toBe(false)
  })

  it('should return false for objects with __isSeed but not functions', () => {
    const fakeSeed = { __isSeed: true }
    expect(isSeedFunction(fakeSeed)).toBe(false)
  })
})
