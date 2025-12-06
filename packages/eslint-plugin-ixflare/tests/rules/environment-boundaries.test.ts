/**
 * @fileoverview Tests for environment-boundaries rule
 * @node-only
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RuleTester } from 'eslint'
import { environmentBoundaries } from '../../src/rules/environment-boundaries'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

describe('environment-boundaries rule', () => {
  describe('rule metadata', () => {
    it('should have correct rule type', () => {
      expect(environmentBoundaries.meta?.type).toBe('problem')
    })

    it('should have documentation', () => {
      expect(environmentBoundaries.meta?.docs?.description).toContain('environment boundaries')
    })

    it('should define error messages', () => {
      expect(environmentBoundaries.meta?.messages).toHaveProperty('nodeInWorker')
      expect(environmentBoundaries.meta?.messages).toHaveProperty('workerInNode')
    })

    it('should have create function', () => {
      expect(typeof environmentBoundaries.create).toBe('function')
    })
  })

  describe('rule behavior with RuleTester', () => {
    let tempDir: string
    let nodeOnlyFile: string
    let workerOnlyFile: string
    let universalFile: string

    beforeAll(() => {
      // Create temp directory with test files
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-test-'))

      // Create a @node-only file
      nodeOnlyFile = path.join(tempDir, 'node-utils.ts')
      fs.writeFileSync(nodeOnlyFile, `/**
 * @node-only
 */
export function readConfig() {
  return require('fs').readFileSync('config.json')
}
`)

      // Create a @worker-only file
      workerOnlyFile = path.join(tempDir, 'worker-handler.ts')
      fs.writeFileSync(workerOnlyFile, `/**
 * @worker-only
 */
export function handleRequest(request: Request): Response {
  return new Response('OK')
}
`)

      // Create a @universal file
      universalFile = path.join(tempDir, 'shared-types.ts')
      fs.writeFileSync(universalFile, `/**
 * @universal
 */
export interface User {
  id: string
  name: string
}
`)
    })

    afterAll(() => {
      // Cleanup temp files
      fs.rmSync(tempDir, { recursive: true, force: true })
    })

    it('should allow @universal imports in @worker-only context', () => {
      const ruleTester = new RuleTester({
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
        },
      })

      // Create a worker file that imports universal
      const testFile = path.join(tempDir, 'test-worker.ts')
      fs.writeFileSync(testFile, `/**
 * @worker-only
 */
import { User } from './shared-types'
export const user: User = { id: '1', name: 'Test' }
`)

      ruleTester.run('environment-boundaries', environmentBoundaries, {
        valid: [
          {
            code: `import { User } from './shared-types'`,
            filename: testFile,
          },
        ],
        invalid: [],
      })

      fs.unlinkSync(testFile)
    })

    it('should allow @universal imports in @node-only context', () => {
      const ruleTester = new RuleTester({
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
        },
      })

      // Create a node file that imports universal
      const testFile = path.join(tempDir, 'test-node.ts')
      fs.writeFileSync(testFile, `/**
 * @node-only
 */
import { User } from './shared-types'
export const user: User = { id: '1', name: 'Test' }
`)

      ruleTester.run('environment-boundaries', environmentBoundaries, {
        valid: [
          {
            code: `import { User } from './shared-types'`,
            filename: testFile,
          },
        ],
        invalid: [],
      })

      fs.unlinkSync(testFile)
    })

    it('should report error when @worker-only imports @node-only', () => {
      const ruleTester = new RuleTester({
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
        },
      })

      // Create a worker file that tries to import node-only
      const testFile = path.join(tempDir, 'bad-worker.ts')
      fs.writeFileSync(testFile, `/**
 * @worker-only
 */
import { readConfig } from './node-utils'
`)

      ruleTester.run('environment-boundaries', environmentBoundaries, {
        valid: [],
        invalid: [
          {
            code: `import { readConfig } from './node-utils'`,
            filename: testFile,
            errors: [{ messageId: 'nodeInWorker' }],
          },
        ],
      })

      fs.unlinkSync(testFile)
    })

    it('should report error when @node-only imports @worker-only', () => {
      const ruleTester = new RuleTester({
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
        },
      })

      // Create a node file that tries to import worker-only
      const testFile = path.join(tempDir, 'bad-node.ts')
      fs.writeFileSync(testFile, `/**
 * @node-only
 */
import { handleRequest } from './worker-handler'
`)

      ruleTester.run('environment-boundaries', environmentBoundaries, {
        valid: [],
        invalid: [
          {
            code: `import { handleRequest } from './worker-handler'`,
            filename: testFile,
            errors: [{ messageId: 'workerInNode' }],
          },
        ],
      })

      fs.unlinkSync(testFile)
    })

    it('should skip files without environment tags', () => {
      const ruleTester = new RuleTester({
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
        },
      })

      // Create an untagged file
      const untaggedFile = path.join(tempDir, 'untagged.ts')
      fs.writeFileSync(untaggedFile, `export const value = 42`)

      // Create a test file without tag importing node-only (should be allowed)
      const testFile = path.join(tempDir, 'no-tag.ts')
      fs.writeFileSync(testFile, `import { readConfig } from './node-utils'`)

      ruleTester.run('environment-boundaries', environmentBoundaries, {
        valid: [
          {
            code: `import { readConfig } from './node-utils'`,
            filename: testFile,
          },
        ],
        invalid: [],
      })

      fs.unlinkSync(testFile)
      fs.unlinkSync(untaggedFile)
    })

    it('should skip external package imports', () => {
      const ruleTester = new RuleTester({
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
        },
      })

      // Worker file importing external package (should be allowed)
      const testFile = path.join(tempDir, 'external-import.ts')
      fs.writeFileSync(testFile, `/**
 * @worker-only
 */
import { z } from 'zod'
`)

      ruleTester.run('environment-boundaries', environmentBoundaries, {
        valid: [
          {
            code: `import { z } from 'zod'`,
            filename: testFile,
          },
        ],
        invalid: [],
      })

      fs.unlinkSync(testFile)
    })
  })
})
