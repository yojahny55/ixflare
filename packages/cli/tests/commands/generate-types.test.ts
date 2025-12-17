import { describe, it, expect } from 'vitest'
import {
  parseGenerateTypesArgs,
  extractRouteParams,
  generateRouteParamsType,
  validateOutputPath,
  showGenerateTypesHelp,
} from '../../src/commands/generate-types'

describe('generate:types command', () => {
  describe('parseGenerateTypesArgs', () => {
    it('should return default options when no args provided', () => {
      const options = parseGenerateTypesArgs([])

      expect(options).toEqual({
        watch: false,
        output: undefined,
        yes: false,
        help: false,
      })
    })

    it('should parse --help flag', () => {
      const options = parseGenerateTypesArgs(['--help'])

      expect(options.help).toBe(true)
    })

    it('should parse -h flag (help shorthand)', () => {
      const options = parseGenerateTypesArgs(['-h'])

      expect(options.help).toBe(true)
    })

    it('should parse --watch flag', () => {
      const options = parseGenerateTypesArgs(['--watch'])

      expect(options.watch).toBe(true)
    })

    it('should parse -w flag (watch shorthand)', () => {
      const options = parseGenerateTypesArgs(['-w'])

      expect(options.watch).toBe(true)
    })

    it('should parse --output flag with path', () => {
      const options = parseGenerateTypesArgs(['--output', 'custom/types'])

      expect(options.output).toBe('custom/types')
    })

    it('should parse -o flag with path (output shorthand)', () => {
      const options = parseGenerateTypesArgs(['-o', 'custom/types'])

      expect(options.output).toBe('custom/types')
    })

    it('should parse --yes flag', () => {
      const options = parseGenerateTypesArgs(['--yes'])

      expect(options.yes).toBe(true)
    })

    it('should parse -y flag (yes shorthand)', () => {
      const options = parseGenerateTypesArgs(['-y'])

      expect(options.yes).toBe(true)
    })

    it('should parse multiple flags together', () => {
      const options = parseGenerateTypesArgs(['--watch', '--output', 'types/', '--yes'])

      expect(options).toEqual({
        watch: true,
        output: 'types/',
        yes: true,
        help: false,
      })
    })

    it('should parse shorthand flags together', () => {
      const options = parseGenerateTypesArgs(['-w', '-o', 'src/gen', '-y'])

      expect(options).toEqual({
        watch: true,
        output: 'src/gen',
        yes: true,
        help: false,
      })
    })

    it('should handle mixed longhand and shorthand flags', () => {
      const options = parseGenerateTypesArgs(['-w', '--output', 'types', '-y'])

      expect(options).toEqual({
        watch: true,
        output: 'types',
        yes: true,
        help: false,
      })
    })

    it('should ignore unknown flags', () => {
      const options = parseGenerateTypesArgs(['--watch', '--unknown', '--yes'])

      expect(options).toEqual({
        watch: true,
        output: undefined,
        yes: true,
        help: false,
      })
    })

    it('should handle --output without value by leaving it undefined', () => {
      const options = parseGenerateTypesArgs(['--output'])

      expect(options.output).toBeUndefined()
    })

    it('should handle -o without value by leaving it undefined', () => {
      const options = parseGenerateTypesArgs(['-o'])

      expect(options.output).toBeUndefined()
    })

    it('should handle --output at end of args without consuming next arg', () => {
      const options = parseGenerateTypesArgs(['--watch', '--output'])

      expect(options).toEqual({
        watch: true,
        output: undefined,
        yes: false,
        help: false,
      })
    })

    it('should NOT consume flag as output value (prevents user errors)', () => {
      const options = parseGenerateTypesArgs(['--output', '--watch'])

      // --watch should NOT become output value - this prevents accidental misuse
      // where users forget to provide an output path
      expect(options.output).toBeUndefined()
      expect(options.watch).toBe(true)
    })

    it('should handle empty strings as valid output paths', () => {
      const options = parseGenerateTypesArgs(['--output', ''])

      expect(options.output).toBe('')
    })

    it('should handle paths with spaces', () => {
      const options = parseGenerateTypesArgs(['--output', 'path with spaces'])

      expect(options.output).toBe('path with spaces')
    })

    it('should handle complex paths', () => {
      const options = parseGenerateTypesArgs([
        '--output',
        '../../some/nested/path/types',
      ])

      expect(options.output).toBe('../../some/nested/path/types')
    })

    it('should handle args in different order', () => {
      const options = parseGenerateTypesArgs(['--yes', '--watch', '--output', 'types'])

      expect(options).toEqual({
        watch: true,
        output: 'types',
        yes: true,
        help: false,
      })
    })

    it('should return same structure with all false/undefined when no matching flags', () => {
      const options = parseGenerateTypesArgs(['--random', '--flags', '--here'])

      expect(options).toEqual({
        watch: false,
        output: undefined,
        yes: false,
        help: false,
      })
    })

    it('should handle duplicate flags by using last value for output', () => {
      const options = parseGenerateTypesArgs([
        '--output',
        'first',
        '--output',
        'second',
      ])

      expect(options.output).toBe('second')
    })

    it('should handle duplicate watch flags (last wins, but all are true)', () => {
      const options = parseGenerateTypesArgs(['--watch', '-w', '--watch'])

      expect(options.watch).toBe(true)
    })
  })

  describe('extractRouteParams', () => {
    it('should return empty array for static routes', () => {
      const params = extractRouteParams('users/index.tsx')

      expect(params).toEqual([])
    })

    it('should extract single dynamic parameter', () => {
      const params = extractRouteParams('users/[userId].tsx')

      expect(params).toEqual([
        { name: 'userId', optional: false, catchAll: false },
      ])
    })

    it('should extract multiple dynamic parameters', () => {
      const params = extractRouteParams('users/[userId]/posts/[postId].tsx')

      expect(params).toEqual([
        { name: 'userId', optional: false, catchAll: false },
        { name: 'postId', optional: false, catchAll: false },
      ])
    })

    it('should extract optional parameter', () => {
      const params = extractRouteParams('users/[[optional]].tsx')

      expect(params).toEqual([
        { name: 'optional', optional: true, catchAll: false },
      ])
    })

    it('should extract catch-all parameter', () => {
      const params = extractRouteParams('docs/[...slug].tsx')

      expect(params).toEqual([
        { name: 'slug', optional: false, catchAll: true },
      ])
    })

    it('should extract optional catch-all parameter', () => {
      const params = extractRouteParams('docs/[[...slug]].tsx')

      expect(params).toEqual([
        { name: 'slug', optional: true, catchAll: true },
      ])
    })

    it('should handle nested paths with parameters', () => {
      const params = extractRouteParams('api/v1/users/[userId]/posts/[postId].tsx')

      expect(params).toEqual([
        { name: 'userId', optional: false, catchAll: false },
        { name: 'postId', optional: false, catchAll: false },
      ])
    })

    it('should handle mix of optional and required parameters', () => {
      const params = extractRouteParams('users/[userId]/posts/[[postId]].tsx')

      expect(params).toEqual([
        { name: 'userId', optional: false, catchAll: false },
        { name: 'postId', optional: true, catchAll: false },
      ])
    })
  })

  describe('generateRouteParamsType', () => {
    it('should return empty string for no parameters', () => {
      const type = generateRouteParamsType([])

      expect(type).toBe('')
    })

    it('should generate type for single required parameter', () => {
      const type = generateRouteParamsType([
        { name: 'userId', optional: false, catchAll: false },
      ])

      expect(type).toBe('export interface Params {\n  userId: string\n}')
    })

    it('should generate type for optional parameter', () => {
      const type = generateRouteParamsType([
        { name: 'optional', optional: true, catchAll: false },
      ])

      expect(type).toBe('export interface Params {\n  optional?: string\n}')
    })

    it('should generate type for catch-all parameter', () => {
      const type = generateRouteParamsType([
        { name: 'slug', optional: false, catchAll: true },
      ])

      expect(type).toBe('export interface Params {\n  slug: string[]\n}')
    })

    it('should generate type for optional catch-all parameter', () => {
      const type = generateRouteParamsType([
        { name: 'slug', optional: true, catchAll: true },
      ])

      expect(type).toBe('export interface Params {\n  slug?: string[]\n}')
    })

    it('should generate type for multiple parameters', () => {
      const type = generateRouteParamsType([
        { name: 'userId', optional: false, catchAll: false },
        { name: 'postId', optional: false, catchAll: false },
      ])

      expect(type).toBe(
        'export interface Params {\n  userId: string\n  postId: string\n}'
      )
    })

    it('should generate type for mix of optional and required', () => {
      const type = generateRouteParamsType([
        { name: 'userId', optional: false, catchAll: false },
        { name: 'postId', optional: true, catchAll: false },
      ])

      expect(type).toBe(
        'export interface Params {\n  userId: string\n  postId?: string\n}'
      )
    })
  })

  describe('validateOutputPath', () => {
    it('should accept valid relative path within project', () => {
      const result = validateOutputPath('/project', 'src/types')

      expect(result).toBe('/project/src/types')
    })

    it('should accept nested path within project', () => {
      const result = validateOutputPath('/project', 'deep/nested/types/dir')

      expect(result).toBe('/project/deep/nested/types/dir')
    })

    it('should throw error for path traversal attempt with ../', () => {
      expect(() => validateOutputPath('/project', '../outside')).toThrow(
        'Output path must be within project root'
      )
    })

    it('should throw error for deep path traversal', () => {
      expect(() => validateOutputPath('/project', '../../etc/passwd')).toThrow(
        'Output path must be within project root'
      )
    })

    it('should throw error for path traversal in middle of path', () => {
      expect(() => validateOutputPath('/project', 'src/../../../outside')).toThrow(
        'Output path must be within project root'
      )
    })

    it('should accept path with .. that resolves within project', () => {
      // src/../types resolves to /project/types which is within project
      const result = validateOutputPath('/project', 'src/../types')

      expect(result).toBe('/project/types')
    })
  })

  describe('showGenerateTypesHelp', () => {
    it('should be a function', () => {
      expect(typeof showGenerateTypesHelp).toBe('function')
    })

    it('should not throw when called', () => {
      // Just verify it doesn't throw - output goes to console
      expect(() => showGenerateTypesHelp()).not.toThrow()
    })
  })
})
