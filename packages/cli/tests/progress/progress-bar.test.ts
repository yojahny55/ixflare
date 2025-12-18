/**
 * Tests for ProgressBar class
 * Following red-green-refactor cycle
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ProgressBar } from '../../src/progress/progress-bar'

describe('ProgressBar', () => {
  beforeEach(() => {
    // Clear any mocks if needed
  })

  describe('construction', () => {
    it('should create with total', () => {
      const bar = new ProgressBar({ total: 100 })
      expect(bar).toBeDefined()
      expect(bar.isComplete()).toBe(false)
      expect(bar.isFailed()).toBe(false)
      const render = bar.render()
      expect(render).toContain('0%')
    })

    it('should create with custom width', () => {
      const bar = new ProgressBar({ total: 100, width: 40 })
      expect(bar).toBeDefined()
      bar.update(50)
      const render = bar.render()
      expect(render).toContain('50%')
      // Bar should have 40 characters (20 filled, 20 empty at 50%)
      expect(render).toMatch(/█{20}░{20}/)
    })

    it('should create with options', () => {
      const bar = new ProgressBar({
        total: 100,
        width: 30,
        showPercentage: true,
        showETA: true,
        text: 'Loading...',
      })
      expect(bar).toBeDefined()
      const render = bar.render()
      expect(render).toContain('Loading')
      expect(render).toContain('0%')
    })
  })

  describe('update', () => {
    it('should update current progress', () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(50)

      const render = bar.render()
      expect(render).toContain('50%')
    })

    it('should update with custom text', () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(25, 'Uploading files...')

      const render = bar.render()
      expect(render).toContain('25%')
      expect(render).toContain('Uploading files')
    })

    it('should clamp progress to total', () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(150) // Over total

      const render = bar.render()
      expect(render).toContain('100%')
    })

    it('should handle negative progress', () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(-10)

      const render = bar.render()
      expect(render).toContain('0%')
    })
  })

  describe('increment', () => {
    it('should increment by 1 by default', () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(10)
      bar.increment()

      const render = bar.render()
      expect(render).toContain('11%')
    })

    it('should increment by custom amount', () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(10)
      bar.increment(5)

      const render = bar.render()
      expect(render).toContain('15%')
    })

    it('should not exceed total when incrementing', () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(98)
      bar.increment(10) // Would go to 108

      const render = bar.render()
      expect(render).toContain('100%')
    })
  })

  describe('render', () => {
    it('should render progress bar with percentage', () => {
      const bar = new ProgressBar({ total: 100, width: 20 })
      bar.update(50)

      const render = bar.render()
      expect(render).toContain('[')
      expect(render).toContain(']')
      expect(render).toContain('50%')
    })

    it('should render bar with filled and empty sections', () => {
      const bar = new ProgressBar({ total: 100, width: 10 })
      bar.update(50)

      const render = bar.render()
      // Should have 5 filled (█) and 5 empty (░) characters
      expect(render).toMatch(/█+░+/)
    })

    it('should hide percentage when showPercentage is false', () => {
      const bar = new ProgressBar({
        total: 100,
        showPercentage: false,
      })
      bar.update(50)

      const render = bar.render()
      expect(render).not.toContain('50%')
    })

    it('should show custom text', () => {
      const bar = new ProgressBar({ total: 100, text: 'Downloading...' })
      bar.update(25)

      const render = bar.render()
      expect(render).toContain('Downloading')
    })

    it('should render 0% correctly', () => {
      const bar = new ProgressBar({ total: 100, width: 10 })
      bar.update(0)

      const render = bar.render()
      expect(render).toContain('0%')
      expect(render).toContain('░'.repeat(10))
    })

    it('should render 100% correctly', () => {
      const bar = new ProgressBar({ total: 100, width: 10 })
      bar.update(100)

      const render = bar.render()
      expect(render).toContain('100%')
      expect(render).toContain('█'.repeat(10))
    })
  })

  describe('complete', () => {
    it('should mark progress as complete', () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(80)
      bar.complete()

      expect(bar.isComplete()).toBe(true)
    })

    it('should set progress to 100% when completing', () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(50)
      bar.complete()

      const render = bar.render()
      expect(render).toContain('100%')
    })
  })

  describe('fail', () => {
    it('should mark progress as failed', () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(50)
      bar.fail()

      expect(bar.isFailed()).toBe(true)
    })
  })

  describe('elapsed time', () => {
    it('should track elapsed time', async () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(10)

      await new Promise((resolve) => setTimeout(resolve, 50))

      const elapsed = bar.elapsed
      expect(elapsed).toBeGreaterThanOrEqual(40)
      expect(elapsed).toBeLessThan(200)
    })

    it('should format elapsed time', async () => {
      const bar = new ProgressBar({ total: 100 })
      bar.update(10)

      await new Promise((resolve) => setTimeout(resolve, 100))

      const formatted = bar.elapsedFormatted
      expect(formatted).toMatch(/^\d+(\.\d+)?(ms|s)$/)
    })
  })

  describe('ETA calculation', () => {
    it('should calculate ETA based on progress rate', async () => {
      const bar = new ProgressBar({ total: 100, showETA: true })
      bar.update(25)

      await new Promise((resolve) => setTimeout(resolve, 100))
      bar.update(50) // 25% progress in 100ms = 4% per ms

      const eta = bar.estimatedTimeRemaining
      // Should be positive and reasonable
      expect(eta).toBeGreaterThanOrEqual(0)
    })

    it('should return 0 ETA when complete', () => {
      const bar = new ProgressBar({ total: 100, showETA: true })
      bar.update(100)

      const eta = bar.estimatedTimeRemaining
      expect(eta).toBe(0)
    })

    it('should handle no progress gracefully', () => {
      const bar = new ProgressBar({ total: 100, showETA: true })
      // No update called yet

      const eta = bar.estimatedTimeRemaining
      expect(eta).toBe(0) // No estimate available
    })
  })

  describe('percentage calculation', () => {
    it('should calculate correct percentage', () => {
      const bar = new ProgressBar({ total: 200 })
      bar.update(50)

      const render = bar.render()
      expect(render).toContain('25%')
    })

    it('should handle decimal percentages', () => {
      const bar = new ProgressBar({ total: 300 })
      bar.update(100)

      const render = bar.render()
      expect(render).toContain('33%') // Rounded
    })
  })

  describe('edge cases', () => {
    it('should handle total of 0', () => {
      const bar = new ProgressBar({ total: 0 })
      bar.update(0)

      const render = bar.render()
      expect(render).toBeDefined()
    })

    it('should handle very small width', () => {
      const bar = new ProgressBar({ total: 100, width: 1 })
      bar.update(50)

      const render = bar.render()
      expect(render).toContain('[')
      expect(render).toContain(']')
    })

    it('should handle very large width', () => {
      const bar = new ProgressBar({ total: 100, width: 100 })
      bar.update(50)

      const render = bar.render()
      expect(render).toMatch(/█+░+/)
    })
  })
})
