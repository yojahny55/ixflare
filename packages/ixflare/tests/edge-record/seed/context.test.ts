import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  SeedContext,
  getSeedContext,
  setSeedContext,
  trackCreated,
  trackSkipped,
} from '../../../src/edge-record/seed/context'

describe('SeedContext', () => {
  afterEach(() => {
    setSeedContext(null)
  })

  describe('SeedContext class', () => {
    it('should track created records', () => {
      const ctx = new SeedContext('test-seed')
      ctx.recordCreated('users', 5)
      ctx.recordCreated('posts', 10)

      const result = ctx.getResult()
      expect(result.created).toEqual({ users: 5, posts: 10 })
    })

    it('should accumulate created records for same table', () => {
      const ctx = new SeedContext('test-seed')
      ctx.recordCreated('users', 5)
      ctx.recordCreated('users', 3)

      const result = ctx.getResult()
      expect(result.created.users).toBe(8)
    })

    it('should track skipped records', () => {
      const ctx = new SeedContext('test-seed')
      ctx.recordSkipped('users', 2)

      const result = ctx.getResult()
      expect(result.skipped).toEqual({ users: 2 })
    })

    it('should track duration', async () => {
      const ctx = new SeedContext('test-seed')
      await new Promise((r) => setTimeout(r, 50))
      const result = ctx.getResult()
      expect(result.duration).toBeGreaterThanOrEqual(40)
    })

    it('should return seed name in result', () => {
      const ctx = new SeedContext('my-seed')
      const result = ctx.getResult()
      expect(result.name).toBe('my-seed')
    })

    it('should default count to 1', () => {
      const ctx = new SeedContext('test-seed')
      ctx.recordCreated('users')
      ctx.recordSkipped('posts')

      const result = ctx.getResult()
      expect(result.created.users).toBe(1)
      expect(result.skipped?.posts).toBe(1)
    })
  })

  describe('global context functions', () => {
    it('should set and get context', () => {
      const ctx = new SeedContext('test')
      setSeedContext(ctx)
      expect(getSeedContext()).toBe(ctx)
    })

    it('should clear context with null', () => {
      const ctx = new SeedContext('test')
      setSeedContext(ctx)
      setSeedContext(null)
      expect(getSeedContext()).toBeNull()
    })

    it('should return null when no context set', () => {
      expect(getSeedContext()).toBeNull()
    })
  })

  describe('trackCreated()', () => {
    it('should track when context is set', () => {
      const ctx = new SeedContext('test')
      setSeedContext(ctx)
      trackCreated('users', 5)

      const result = ctx.getResult()
      expect(result.created.users).toBe(5)
    })

    it('should be safe when no context', () => {
      // Should not throw
      expect(() => trackCreated('users', 5)).not.toThrow()
    })
  })

  describe('trackSkipped()', () => {
    it('should track when context is set', () => {
      const ctx = new SeedContext('test')
      setSeedContext(ctx)
      trackSkipped('users', 3)

      const result = ctx.getResult()
      expect(result.skipped?.users).toBe(3)
    })

    it('should be safe when no context', () => {
      // Should not throw
      expect(() => trackSkipped('users', 3)).not.toThrow()
    })
  })

  describe('mixed tracking', () => {
    it('should track both created and skipped', () => {
      const ctx = new SeedContext('mixed-seed')
      setSeedContext(ctx)

      trackCreated('users', 10)
      trackSkipped('users', 2)
      trackCreated('posts', 5)

      const result = ctx.getResult()
      expect(result.created).toEqual({ users: 10, posts: 5 })
      expect(result.skipped).toEqual({ users: 2 })
    })
  })
})
