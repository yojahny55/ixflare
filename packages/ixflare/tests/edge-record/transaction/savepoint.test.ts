/**
 * @module tests/edge-record/transaction/savepoint.test
 * @description Tests for savepoint management
 */

import { describe, it, expect } from 'vitest'
import {
  generateSavepointName,
  createSavepointSQL,
  releaseSavepointSQL,
  rollbackToSavepointSQL,
  SavepointManager,
} from '@/edge-record/transaction/savepoint'

describe('Savepoint', () => {
  describe('generateSavepointName', () => {
    it('should generate unique savepoint names', async () => {
      const name1 = generateSavepointName(1)
      const name2 = generateSavepointName(1)

      // Format: sp_{depth}_{timestamp}_{counter}_{randomSuffix}
      expect(name1).toMatch(/^sp_1_\d+_\d+_[a-z0-9]+$/)
      expect(name2).toMatch(/^sp_1_\d+_\d+_[a-z0-9]+$/)
      // Names should be different due to counter and random suffix
      expect(name1).not.toBe(name2)
    })

    it('should generate unique names even in same millisecond', () => {
      // Generate multiple names rapidly - should all be unique due to counter
      const names = Array.from({ length: 100 }, () => generateSavepointName(1))
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(100)
    })

    it('should include depth in savepoint name', () => {
      const name1 = generateSavepointName(1)
      const name2 = generateSavepointName(2)
      const name3 = generateSavepointName(3)

      expect(name1).toMatch(/^sp_1_/)
      expect(name2).toMatch(/^sp_2_/)
      expect(name3).toMatch(/^sp_3_/)
    })
  })

  describe('createSavepointSQL', () => {
    it('should generate SAVEPOINT SQL statement', () => {
      const sql = createSavepointSQL('sp_1_123456')
      expect(sql).toBe('SAVEPOINT sp_1_123456')
    })
  })

  describe('releaseSavepointSQL', () => {
    it('should generate RELEASE SAVEPOINT SQL statement', () => {
      const sql = releaseSavepointSQL('sp_1_123456')
      expect(sql).toBe('RELEASE SAVEPOINT sp_1_123456')
    })
  })

  describe('rollbackToSavepointSQL', () => {
    it('should generate ROLLBACK TO SAVEPOINT SQL statement', () => {
      const sql = rollbackToSavepointSQL('sp_1_123456')
      expect(sql).toBe('ROLLBACK TO SAVEPOINT sp_1_123456')
    })
  })

  describe('SavepointManager', () => {
    it('should track savepoint stack', () => {
      const manager = new SavepointManager()

      const name1 = manager.push(1)
      const name2 = manager.push(2)

      expect(manager.depth()).toBe(2)
      expect(manager.current()).toBe(name2)
    })

    it('should pop savepoints in correct order', () => {
      const manager = new SavepointManager()

      const name1 = manager.push(1)
      const name2 = manager.push(2)
      const name3 = manager.push(3)

      expect(manager.pop()).toBe(name3)
      expect(manager.pop()).toBe(name2)
      expect(manager.pop()).toBe(name1)
      expect(manager.pop()).toBeUndefined()
    })

    it('should return current savepoint', () => {
      const manager = new SavepointManager()

      expect(manager.current()).toBeUndefined()

      const name1 = manager.push(1)
      expect(manager.current()).toBe(name1)

      const name2 = manager.push(2)
      expect(manager.current()).toBe(name2)
    })

    it('should clear all savepoints', () => {
      const manager = new SavepointManager()

      manager.push(1)
      manager.push(2)
      manager.push(3)

      expect(manager.depth()).toBe(3)

      manager.clear()

      expect(manager.depth()).toBe(0)
      expect(manager.current()).toBeUndefined()
    })

    it('should handle empty stack operations', () => {
      const manager = new SavepointManager()

      expect(manager.depth()).toBe(0)
      expect(manager.current()).toBeUndefined()
      expect(manager.pop()).toBeUndefined()
    })
  })
})
