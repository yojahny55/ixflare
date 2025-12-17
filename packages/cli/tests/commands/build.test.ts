/**
 * @module tests/commands/build
 * @description Tests for build command
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import type { InlineConfig } from 'vite'

// Mock Vite build before importing
vi.mock('vite', () => ({
  build: vi.fn(),
}))

describe('build command', () => {
  let buildMock: Mock
  let consoleLogSpy: Mock
  let consoleErrorSpy: Mock
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

  beforeEach(async () => {
    const vite = await import('vite')
    buildMock = vite.build as Mock

    // Spy on console
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock process.cwd to return predictable path
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('parseBuildArgs', () => {
    it('should parse --analyze flag', async () => {
      const { parseBuildArgs } = await import('../../src/commands/build')

      const options = parseBuildArgs(['--analyze'])

      expect(options.analyze).toBe(true)
    })

    it('should parse --env flag with value', async () => {
      const { parseBuildArgs } = await import('../../src/commands/build')

      const options = parseBuildArgs(['--env', 'production'])

      expect(options.env).toBe('production')
    })

    it('should parse --no-sourcemaps flag', async () => {
      const { parseBuildArgs } = await import('../../src/commands/build')

      const options = parseBuildArgs(['--no-sourcemaps'])

      expect(options.sourcemap).toBe(false)
    })

    it('should parse --watch flag', async () => {
      const { parseBuildArgs } = await import('../../src/commands/build')

      const options = parseBuildArgs(['--watch'])

      expect(options.watch).toBe(true)
    })

    it('should parse --clean flag', async () => {
      const { parseBuildArgs } = await import('../../src/commands/build')

      const options = parseBuildArgs(['--clean'])

      expect(options.clean).toBe(true)
    })

    it('should parse --verbose flag', async () => {
      const { parseBuildArgs } = await import('../../src/commands/build')

      const options = parseBuildArgs(['--verbose'])

      expect(options.verbose).toBe(true)
    })

    it('should default sourcemap to true when not specified', async () => {
      const { parseBuildArgs } = await import('../../src/commands/build')

      const options = parseBuildArgs([])

      expect(options.sourcemap).toBe(true)
    })

    it('should parse multiple flags together', async () => {
      const { parseBuildArgs } = await import('../../src/commands/build')

      const options = parseBuildArgs(['--analyze', '--env', 'production', '--watch'])

      expect(options.analyze).toBe(true)
      expect(options.env).toBe('production')
      expect(options.watch).toBe(true)
    })
  })

  describe('build integration', () => {
    it('should call Vite build with project root', async () => {
      buildMock.mockResolvedValue({})

      const { build } = await import('../../src/commands/build')

      await build({})

      expect(buildMock).toHaveBeenCalledWith(
        expect.objectContaining({
          root: '/test/project',
        })
      )
    })

    it('should display build progress messages', async () => {
      buildMock.mockResolvedValue({})

      const { build } = await import('../../src/commands/build')

      await build({})

      expect(consoleLogSpy).toHaveBeenCalledWith('Building for production...')
    })

    it('should handle build errors gracefully', async () => {
      const buildError = new Error('TypeScript compilation failed')
      buildMock.mockRejectedValue(buildError)

      const { build } = await import('../../src/commands/build')

      await build({})

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Build failed'))
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('TypeScript compilation failed')
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should enable source maps by default', async () => {
      buildMock.mockResolvedValue({})

      const { build } = await import('../../src/commands/build')

      await build({})

      expect(buildMock).toHaveBeenCalledWith(
        expect.objectContaining({
          build: expect.objectContaining({
            sourcemap: true,
          }),
        })
      )
    })

    it('should disable source maps when --no-sourcemaps flag is used', async () => {
      buildMock.mockResolvedValue({})

      const { build } = await import('../../src/commands/build')

      await build({ sourcemap: false })

      expect(buildMock).toHaveBeenCalledWith(
        expect.objectContaining({
          build: expect.objectContaining({
            sourcemap: false,
          }),
        })
      )
    })

    it('should enable watch mode when --watch flag is used', async () => {
      buildMock.mockResolvedValue({})

      const { build } = await import('../../src/commands/build')

      await build({ watch: true })

      expect(buildMock).toHaveBeenCalledWith(
        expect.objectContaining({
          build: expect.objectContaining({
            watch: {},
          }),
        })
      )
    })
  })

  describe('bundle size calculation', () => {
    it('should calculate gzip size of bundles', async () => {
      const { calculateGzipSize } = await import('../../src/commands/build')

      const testData = Buffer.from('test data repeated '.repeat(100))
      const size = calculateGzipSize(testData)

      expect(size).toBeGreaterThan(0)
      expect(size).toBeLessThan(testData.length)
    })
  })

  describe('bundle size validation', () => {
    it('should not warn for bundles under 50KB', async () => {
      const { checkBundleSize } = await import('../../src/commands/build')

      const warnings = checkBundleSize(30 * 1024) // 30KB

      expect(warnings).toHaveLength(0)
    })

    it('should warn when bundle exceeds internal target of 50KB', async () => {
      const { checkBundleSize } = await import('../../src/commands/build')

      const warnings = checkBundleSize(60 * 1024) // 60KB

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain('50KB')
    })

    it('should warn when bundle exceeds Workers free tier limit (3MB)', async () => {
      const { checkBundleSize } = await import('../../src/commands/build')

      const warnings = checkBundleSize(4 * 1024 * 1024) // 4MB

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.some((w) => w.includes('3MB'))).toBe(true)
    })

    it('should warn when bundle exceeds Workers paid tier limit (10MB)', async () => {
      const { checkBundleSize } = await import('../../src/commands/build')

      const warnings = checkBundleSize(11 * 1024 * 1024) // 11MB

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.some((w) => w.includes('10MB'))).toBe(true)
    })
  })

  describe('build output formatting', () => {
    it('should format bundle size in KB', async () => {
      const { formatSize } = await import('../../src/commands/build')

      const formatted = formatSize(1536) // 1.5KB

      expect(formatted).toBe('1.5KB')
    })

    it('should format bundle size in MB', async () => {
      const { formatSize } = await import('../../src/commands/build')

      const formatted = formatSize(1572864) // 1.5MB

      expect(formatted).toBe('1.5MB')
    })

    it('should format bundle size in bytes', async () => {
      const { formatSize } = await import('../../src/commands/build')

      const formatted = formatSize(512) // 512 bytes

      expect(formatted).toBe('512B')
    })
  })

  describe('integration tests', () => {
    it('should build successfully with all flags combined', async () => {
      buildMock.mockResolvedValue({})

      const { build } = await import('../../src/commands/build')

      await build({
        analyze: false,
        env: 'production',
        sourcemap: true,
        watch: false,
        clean: true,
        verbose: true,
      })

      expect(buildMock).toHaveBeenCalledTimes(1)
      expect(consoleLogSpy).toHaveBeenCalledWith('Building for production...')
    })

    it('should handle TypeScript errors from Vite', async () => {
      const tsError = new Error(
        'src/index.ts:10:3 - error TS2322: Type "string" is not assignable to type "number"'
      )
      buildMock.mockRejectedValue(tsError)

      const { build } = await import('../../src/commands/build')

      await build({})

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Build failed'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should properly pass environment to Vite config', async () => {
      buildMock.mockResolvedValue({})

      const { build } = await import('../../src/commands/build')

      await build({ env: 'staging' })

      expect(buildMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'staging',
        })
      )
    })

    it('should configure visualizer plugin when analyze is true', async () => {
      buildMock.mockResolvedValue({})

      const { build } = await import('../../src/commands/build')

      await build({ analyze: true })

      expect(buildMock).toHaveBeenCalledWith(
        expect.objectContaining({
          plugins: expect.arrayContaining([expect.any(Object)]),
        })
      )
    })
  })
})
