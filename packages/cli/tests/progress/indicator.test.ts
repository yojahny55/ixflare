/**
 * Tests for ProgressIndicator class
 * Following red-green-refactor cycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProgressIndicator } from '../../src/progress/indicator'

// Mock nanospinner
vi.mock('nanospinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    success: vi.fn().mockReturnThis(),
    error: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
  })),
}))

describe('ProgressIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('construction', () => {
    it('should create indicator with default options', () => {
      const indicator = new ProgressIndicator()
      expect(indicator).toBeDefined()
      expect(indicator.isRunning()).toBe(false)
      expect(indicator.elapsed).toBe(0)
    })

    it('should create indicator with custom text', () => {
      const indicator = new ProgressIndicator({ text: 'Loading...' })
      expect(indicator).toBeDefined()
      indicator.start()
      expect(indicator.isRunning()).toBe(true)
    })

    it('should create indicator with custom color', () => {
      const indicator = new ProgressIndicator({ color: 'green' })
      expect(indicator).toBeDefined()
      indicator.start('Testing green')
      expect(indicator.isRunning()).toBe(true)
    })
  })

  describe('start', () => {
    it('should start spinner with initial text', () => {
      const indicator = new ProgressIndicator({ text: 'Loading...' })
      indicator.start()
      expect(indicator.isRunning()).toBe(true)
    })

    it('should start spinner with overridden text', () => {
      const indicator = new ProgressIndicator({ text: 'Initial' })
      indicator.start('Overridden')
      expect(indicator.isRunning()).toBe(true)
    })

    it('should track start time when started', () => {
      const indicator = new ProgressIndicator()
      const beforeStart = Date.now()
      indicator.start('Testing')
      const afterStart = Date.now()

      const elapsed = indicator.elapsed
      expect(elapsed).toBeGreaterThanOrEqual(0)
      expect(elapsed).toBeLessThanOrEqual(afterStart - beforeStart + 10)
    })
  })

  describe('update', () => {
    it('should update spinner text while running', () => {
      const indicator = new ProgressIndicator()
      indicator.start('Initial')
      indicator.update('Updated')
      expect(indicator.isRunning()).toBe(true)
    })
  })

  describe('succeed', () => {
    it('should complete spinner with success status', () => {
      const indicator = new ProgressIndicator()
      indicator.start('Working...')
      indicator.succeed('Done!')
      expect(indicator.isRunning()).toBe(false)
    })

    it('should use default text if not provided', () => {
      const indicator = new ProgressIndicator({ text: 'Working...' })
      indicator.start()
      indicator.succeed()
      expect(indicator.isRunning()).toBe(false)
    })
  })

  describe('fail', () => {
    it('should complete spinner with error status', () => {
      const indicator = new ProgressIndicator()
      indicator.start('Working...')
      indicator.fail('Failed!')
      expect(indicator.isRunning()).toBe(false)
    })
  })

  describe('warn', () => {
    it('should complete spinner with warning status', () => {
      const indicator = new ProgressIndicator()
      indicator.start('Working...')
      indicator.warn('Warning!')
      expect(indicator.isRunning()).toBe(false)
    })
  })

  describe('info', () => {
    it('should complete spinner with info status', () => {
      const indicator = new ProgressIndicator()
      indicator.start('Working...')
      indicator.info('Info!')
      expect(indicator.isRunning()).toBe(false)
    })
  })

  describe('stop', () => {
    it('should stop spinner without status', () => {
      const indicator = new ProgressIndicator()
      indicator.start('Working...')
      indicator.stop()
      expect(indicator.isRunning()).toBe(false)
    })
  })

  describe('elapsed time tracking', () => {
    it('should return 0 elapsed time before start', () => {
      const indicator = new ProgressIndicator()
      expect(indicator.elapsed).toBe(0)
    })

    it('should track elapsed time after start', async () => {
      const indicator = new ProgressIndicator()
      indicator.start('Testing')

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50))

      const elapsed = indicator.elapsed
      expect(elapsed).toBeGreaterThanOrEqual(40)
      expect(elapsed).toBeLessThan(200)
    })

    it('should format elapsed time as human readable', async () => {
      const indicator = new ProgressIndicator()
      indicator.start('Testing')

      await new Promise((resolve) => setTimeout(resolve, 100))

      const formatted = indicator.elapsedFormatted
      // Should be in format like "123ms" or "0.1s"
      expect(formatted).toMatch(/^\d+(\.\d+)?(ms|s)$/)
    })
  })

  describe('chaining', () => {
    it('should support method chaining', () => {
      const indicator = new ProgressIndicator()
      const result = indicator.start('Step 1').update('Step 2').succeed('Done')

      expect(result).toBe(indicator)
    })
  })

  describe('operations without start', () => {
    it('should handle update without start gracefully', () => {
      const indicator = new ProgressIndicator({ text: 'Test' })
      // Should not throw when update called without start
      indicator.update('New text')
      expect(indicator.isRunning()).toBe(false)
    })

    it('should handle succeed without start gracefully', () => {
      const indicator = new ProgressIndicator({ text: 'Test' })
      // Should not throw when succeed called without start
      indicator.succeed('Done')
      expect(indicator.isRunning()).toBe(false)
    })

    it('should handle fail without start gracefully', () => {
      const indicator = new ProgressIndicator({ text: 'Test' })
      // Should not throw when fail called without start
      indicator.fail('Error')
      expect(indicator.isRunning()).toBe(false)
    })

    it('should handle stop without start gracefully', () => {
      const indicator = new ProgressIndicator({ text: 'Test' })
      // Should not throw when stop called without start
      indicator.stop()
      expect(indicator.isRunning()).toBe(false)
    })
  })
})
