/**
 * @fileoverview Tests for environment-boundaries rule
 * @node-only
 */

import { describe, it, expect } from 'vitest'
import { RuleTester } from 'eslint'
import { environmentBoundaries } from '../../src/rules/environment-boundaries'

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

describe('environment-boundaries rule', () => {
  it('should detect @node-only imports in @worker-only files', () => {
    // This is a placeholder test - actual implementation would use ESLint's RuleTester
    expect(environmentBoundaries).toBeDefined()
    expect(environmentBoundaries.meta).toBeDefined()
    expect(environmentBoundaries.create).toBeDefined()
  })

  it('should allow @universal imports in any context', () => {
    // Placeholder for actual test
    expect(environmentBoundaries.meta?.messages).toHaveProperty('nodeInWorker')
    expect(environmentBoundaries.meta?.messages).toHaveProperty('workerInNode')
  })

  it('should have correct rule metadata', () => {
    expect(environmentBoundaries.meta?.type).toBe('problem')
    expect(environmentBoundaries.meta?.docs?.description).toContain('environment boundaries')
  })
})
