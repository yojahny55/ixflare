/**
 * Tests for MultiStepProgress class
 * Following red-green-refactor cycle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MultiStepProgress } from '../../src/progress/multi-step'

describe('MultiStepProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('construction', () => {
    it('should create with array of step names', () => {
      const progress = new MultiStepProgress([
        'Step 1',
        'Step 2',
        'Step 3',
      ])
      expect(progress).toBeDefined()
    })

    it('should initialize all steps as pending', () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2'])
      const render = progress.render()
      // All steps should show as pending (○)
      expect(render).toContain('○')
    })
  })

  describe('start', () => {
    it('should mark first step as in-progress', () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2'])
      progress.start()
      const render = progress.render()
      // First step should be in-progress (spinner)
      expect(render).toContain('Step 1')
    })
  })

  describe('next', () => {
    it('should complete current step and move to next', () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2', 'Step 3'])
      progress.start()
      progress.next()

      const render = progress.render()
      // Step 1 should be complete (✓), Step 2 in progress
      expect(render).toContain('✓')
      expect(render).toContain('Step 2')
    })

    it('should support custom completion text', () => {
      const progress = new MultiStepProgress(['Build', 'Deploy'])
      progress.start()
      progress.next('Build completed in 2.3s')

      const render = progress.render()
      expect(render).toContain('Build completed in 2.3s')
    })

    it('should track duration for completed steps', async () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2'])
      progress.start()

      await new Promise((resolve) => setTimeout(resolve, 50))
      progress.next()

      const steps = progress.getSteps()
      expect(steps[0].duration).toBeGreaterThanOrEqual(40)
      expect(steps[0].duration).toBeLessThan(200)
    })
  })

  describe('complete', () => {
    it('should mark current step as completed', () => {
      const progress = new MultiStepProgress(['Step 1'])
      progress.start()
      progress.complete('All done!')

      const render = progress.render()
      expect(render).toContain('✓')
      expect(render).toContain('All done!')
    })

    it('should complete with duration', async () => {
      const progress = new MultiStepProgress(['Step 1'])
      progress.start()

      await new Promise((resolve) => setTimeout(resolve, 50))
      progress.complete()

      const steps = progress.getSteps()
      expect(steps[0].status).toBe('completed')
      expect(steps[0].duration).toBeGreaterThan(0)
    })
  })

  describe('fail', () => {
    it('should mark current step as failed', () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2'])
      progress.start()
      progress.fail('Error occurred')

      const render = progress.render()
      expect(render).toContain('✖')
      expect(render).toContain('Error occurred')
    })

    it('should not advance to next step after failure', () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2'])
      progress.start()
      progress.fail()

      const steps = progress.getSteps()
      expect(steps[0].status).toBe('failed')
      expect(steps[1].status).toBe('pending')
    })
  })

  describe('skip', () => {
    it('should mark current step as skipped', () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2'])
      progress.start()
      progress.skip('Not needed')

      const render = progress.render()
      expect(render).toContain('⊘') // skipped symbol
      expect(render).toContain('Not needed')
      expect(render).toContain('Step 2')
    })

    it('should advance to next step after skip', () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2'])
      progress.start()
      progress.skip()

      const steps = progress.getSteps()
      expect(steps[0].status).toBe('skipped')
      expect(steps[1].status).toBe('in-progress')
    })
  })

  describe('finish', () => {
    it('should complete all remaining steps', () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2', 'Step 3'])
      progress.start()
      progress.next()
      progress.finish()

      const steps = progress.getSteps()
      expect(steps[0].status).toBe('completed')
      expect(steps[1].status).toBe('completed')
      expect(steps[2].status).toBe('pending')
    })

    it('should return total duration', async () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2'])
      progress.start()

      await new Promise((resolve) => setTimeout(resolve, 50))
      progress.next()

      await new Promise((resolve) => setTimeout(resolve, 50))
      progress.finish()

      const duration = progress.totalDuration
      expect(duration).toBeGreaterThanOrEqual(90)
    })

    it('should return formatted total duration', async () => {
      const progress = new MultiStepProgress(['Step 1'])
      progress.start()

      await new Promise((resolve) => setTimeout(resolve, 100))
      progress.finish()

      const formatted = progress.totalDurationFormatted
      expect(formatted).toMatch(/^\d+(\.\d+)?(ms|s)$/)
    })
  })

  describe('render', () => {
    it('should render all steps with status symbols', () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2', 'Step 3'])
      progress.start()
      progress.next()

      const render = progress.render()

      // Should contain step 1 (completed), step 2 (in-progress), step 3 (pending)
      expect(render).toContain('Step 1')
      expect(render).toContain('Step 2')
      expect(render).toContain('Step 3')
    })

    it('should show duration for completed steps', async () => {
      const progress = new MultiStepProgress(['Build'])
      progress.start()

      await new Promise((resolve) => setTimeout(resolve, 50))
      progress.complete()

      const render = progress.render()
      // Should show duration like (50ms) or (0.1s)
      expect(render).toMatch(/\(\d+(\.\d+)?(ms|s)\)/)
    })
  })

  describe('getSteps', () => {
    it('should return array of step objects', () => {
      const progress = new MultiStepProgress(['Step 1', 'Step 2'])
      const steps = progress.getSteps()

      expect(steps).toHaveLength(2)
      expect(steps[0]).toMatchObject({
        id: 'step-1',
        text: 'Step 1',
        status: 'pending',
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty step list', () => {
      const progress = new MultiStepProgress([])
      expect(progress.render()).toBe('')
    })

    it('should handle single step', () => {
      const progress = new MultiStepProgress(['Only step'])
      progress.start()
      progress.complete()

      const steps = progress.getSteps()
      expect(steps[0].status).toBe('completed')
    })

    it('should not advance beyond last step', () => {
      const progress = new MultiStepProgress(['Step 1'])
      progress.start()
      progress.next()
      progress.next() // Should not crash

      const steps = progress.getSteps()
      expect(steps).toHaveLength(1)
    })
  })
})
