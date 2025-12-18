/**
 * Tests for formatDuration utility
 * Covers edge cases, boundaries, and various duration formats
 */

import { describe, it, expect } from 'vitest'
import { formatDuration } from '../../src/progress/indicator'

describe('formatDuration', () => {
  describe('milliseconds format (< 1000ms)', () => {
    it('should format 0ms', () => {
      expect(formatDuration(0)).toBe('0ms')
    })

    it('should format small durations in ms', () => {
      expect(formatDuration(1)).toBe('1ms')
      expect(formatDuration(50)).toBe('50ms')
      expect(formatDuration(100)).toBe('100ms')
      expect(formatDuration(500)).toBe('500ms')
    })

    it('should format 999ms (boundary)', () => {
      expect(formatDuration(999)).toBe('999ms')
    })

    it('should round fractional milliseconds', () => {
      expect(formatDuration(1.4)).toBe('1ms')
      expect(formatDuration(1.5)).toBe('2ms')
      expect(formatDuration(99.9)).toBe('100ms')
    })
  })

  describe('seconds format (1000ms - 59999ms)', () => {
    it('should format 1000ms as 1.0s (boundary)', () => {
      expect(formatDuration(1000)).toBe('1.0s')
    })

    it('should format durations with one decimal place', () => {
      expect(formatDuration(1500)).toBe('1.5s')
      expect(formatDuration(2300)).toBe('2.3s')
      expect(formatDuration(10000)).toBe('10.0s')
      expect(formatDuration(12345)).toBe('12.3s')
    })

    it('should format 59999ms correctly (boundary)', () => {
      expect(formatDuration(59999)).toBe('60.0s')
    })

    it('should format 59000ms as 59.0s', () => {
      expect(formatDuration(59000)).toBe('59.0s')
    })

    it('should round to one decimal place', () => {
      expect(formatDuration(1234)).toBe('1.2s')
      expect(formatDuration(1250)).toBe('1.3s') // rounds up
      expect(formatDuration(1249)).toBe('1.2s') // rounds down
    })
  })

  describe('minutes format (>= 60000ms)', () => {
    it('should format 60000ms as 1m 0s (boundary)', () => {
      expect(formatDuration(60000)).toBe('1m 0s')
    })

    it('should format minutes with seconds', () => {
      expect(formatDuration(61000)).toBe('1m 1s')
      expect(formatDuration(90000)).toBe('1m 30s')
      expect(formatDuration(120000)).toBe('2m 0s')
      expect(formatDuration(125000)).toBe('2m 5s')
    })

    it('should format large durations', () => {
      expect(formatDuration(300000)).toBe('5m 0s')
      expect(formatDuration(600000)).toBe('10m 0s')
      expect(formatDuration(3600000)).toBe('60m 0s')
    })

    it('should handle hour-scale durations as minutes', () => {
      expect(formatDuration(7200000)).toBe('120m 0s') // 2 hours
      expect(formatDuration(3723000)).toBe('62m 3s') // 1h 2m 3s as 62m 3s
    })

    it('should round seconds properly', () => {
      expect(formatDuration(61499)).toBe('1m 1s')
      expect(formatDuration(61500)).toBe('1m 2s') // rounds up
    })
  })

  describe('edge cases', () => {
    it('should handle negative values gracefully', () => {
      // Negative values should be handled (returns negative ms)
      const result = formatDuration(-100)
      expect(result).toBe('-100ms')
    })

    it('should handle very large values', () => {
      // 24 hours
      expect(formatDuration(86400000)).toBe('1440m 0s')
    })

    it('should handle floating point precision', () => {
      // Test that floating point doesn't cause weird rounding
      expect(formatDuration(1000.0000001)).toBe('1.0s')
      expect(formatDuration(999.9999999)).toBe('1000ms')
    })
  })

  describe('real-world scenarios', () => {
    it('should format typical operation durations', () => {
      // Quick operations
      expect(formatDuration(23)).toBe('23ms')
      expect(formatDuration(156)).toBe('156ms')

      // Build operations
      expect(formatDuration(2340)).toBe('2.3s')
      expect(formatDuration(12400)).toBe('12.4s')

      // Deploy operations
      expect(formatDuration(45000)).toBe('45.0s')
      expect(formatDuration(72345)).toBe('1m 12s')
    })
  })
})
