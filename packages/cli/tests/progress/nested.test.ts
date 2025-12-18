/**
 * Tests for NestedProgress class
 * Following red-green-refactor cycle
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { NestedProgress } from '../../src/progress/nested'

describe('NestedProgress', () => {
  beforeEach(() => {
    // Setup if needed
  })

  describe('construction', () => {
    it('should create with parent text', () => {
      const progress = new NestedProgress('Running migrations...')
      expect(progress).toBeDefined()
      expect(progress.isStarted()).toBe(false)
      expect(progress.isComplete()).toBe(false)
      expect(progress.isFailed()).toBe(false)
      expect(progress.totalDuration).toBe(0)
    })
  })

  describe('start', () => {
    it('should start parent operation', () => {
      const progress = new NestedProgress('Parent task')
      progress.start()

      const render = progress.render()
      expect(render).toContain('Parent task')
    })
  })

  describe('child operations', () => {
    it('should add child with success', () => {
      const progress = new NestedProgress('Running migrations')
      progress.start()
      progress.addChild('0001_create_users.sql', 'completed', 23)

      const render = progress.render()
      expect(render).toContain('✓ 0001_create_users.sql')
      expect(render).toContain('23ms')
    })

    it('should add child with failure', () => {
      const progress = new NestedProgress('Running tests')
      progress.start()
      progress.addChild('test-1.spec.ts', 'failed')

      const render = progress.render()
      expect(render).toContain('✖ test-1.spec.ts')
    })

    it('should add in-progress child', () => {
      const progress = new NestedProgress('Processing')
      progress.start()
      progress.addChild('file.txt', 'in-progress')

      const render = progress.render()
      expect(render).toContain('◐ file.txt')
    })

    it('should show multiple children', () => {
      const progress = new NestedProgress('Migrations')
      progress.start()
      progress.addChild('0001_users.sql', 'completed', 15)
      progress.addChild('0002_posts.sql', 'completed', 20)
      progress.addChild('0003_comments.sql', 'in-progress')

      const render = progress.render()
      expect(render).toContain('✓ 0001_users.sql')
      expect(render).toContain('✓ 0002_posts.sql')
      expect(render).toContain('◐ 0003_comments.sql')
    })
  })

  describe('indentation', () => {
    it('should indent child operations', () => {
      const progress = new NestedProgress('Parent')
      progress.start()
      progress.addChild('Child 1', 'completed')

      const render = progress.render()
      const lines = render.split('\n')

      // Parent should have spinner
      expect(lines[0]).toMatch(/◐ Parent/)
      // Child should be indented (2 spaces more than parent)
      expect(lines[1]).toMatch(/^\s{2,}✓ Child 1/)
    })
  })

  describe('complete', () => {
    it('should mark parent as complete', () => {
      const progress = new NestedProgress('Task')
      progress.start()
      progress.addChild('Subtask', 'completed', 10)
      progress.complete()

      const render = progress.render()
      expect(render).toContain('✓ Task')
    })

    it('should include total duration on completion', async () => {
      const progress = new NestedProgress('Task')
      progress.start()

      await new Promise((resolve) => setTimeout(resolve, 50))

      progress.complete()

      expect(progress.totalDuration).toBeGreaterThanOrEqual(40)
    })
  })

  describe('fail', () => {
    it('should mark parent as failed', () => {
      const progress = new NestedProgress('Task')
      progress.start()
      progress.fail()

      const render = progress.render()
      expect(render).toContain('✖ Task')
    })
  })

  describe('render', () => {
    it('should render empty when not started', () => {
      const progress = new NestedProgress('Task')
      const render = progress.render()

      expect(render).toBe('')
    })

    it('should render parent with spinner when in progress', () => {
      const progress = new NestedProgress('Loading')
      progress.start()

      const render = progress.render()
      expect(render).toContain('◐ Loading')
    })

    it('should render hierarchical structure', () => {
      const progress = new NestedProgress('Running migrations')
      progress.start()
      progress.addChild('0001_create_users.sql', 'completed', 23)
      progress.addChild('0002_add_posts.sql', 'completed', 15)
      progress.addChild('0003_add_comments.sql', 'in-progress')

      const render = progress.render()
      const lines = render.split('\n')

      expect(lines).toHaveLength(4) // 1 parent + 3 children
      expect(lines[0]).toContain('Running migrations')
      expect(lines[1]).toContain('0001_create_users.sql')
      expect(lines[2]).toContain('0002_add_posts.sql')
      expect(lines[3]).toContain('0003_add_comments.sql')
    })
  })

  describe('duration formatting', () => {
    it('should format child durations', () => {
      const progress = new NestedProgress('Task')
      progress.start()
      progress.addChild('Subtask 1', 'completed', 1234)
      progress.addChild('Subtask 2', 'completed', 567)

      const render = progress.render()
      expect(render).toContain('1.2s')
      expect(render).toContain('567ms')
    })

    it('should not show duration for pending children', () => {
      const progress = new NestedProgress('Task')
      progress.start()
      progress.addChild('Pending', 'in-progress')

      const render = progress.render()
      // Should not have any duration text
      expect(render).not.toMatch(/\(\d+/)
    })
  })

  describe('edge cases', () => {
    it('should handle no children', () => {
      const progress = new NestedProgress('Task')
      progress.start()
      progress.complete()

      const render = progress.render()
      expect(render).toContain('✓ Task')
    })

    it('should handle many children', () => {
      const progress = new NestedProgress('Task')
      progress.start()

      for (let i = 0; i < 100; i++) {
        progress.addChild(`Child ${i}`, 'completed', 10)
      }

      const render = progress.render()
      const lines = render.split('\n')
      expect(lines.length).toBeGreaterThan(100)
    })
  })

  describe('status tracking', () => {
    it('should track if started', () => {
      const progress = new NestedProgress('Task')
      expect(progress.isStarted()).toBe(false)

      progress.start()
      expect(progress.isStarted()).toBe(true)
    })

    it('should track if complete', () => {
      const progress = new NestedProgress('Task')
      progress.start()
      expect(progress.isComplete()).toBe(false)

      progress.complete()
      expect(progress.isComplete()).toBe(true)
    })

    it('should track if failed', () => {
      const progress = new NestedProgress('Task')
      progress.start()
      expect(progress.isFailed()).toBe(false)

      progress.fail()
      expect(progress.isFailed()).toBe(true)
    })
  })
})
