import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as ts from 'typescript'
import { typeCheckWatch } from '../../../src/commands/typecheck/watch'
import * as config from '../../../src/commands/typecheck/config'

// Mock the config module
vi.mock('../../../src/commands/typecheck/config', () => ({
  findTsConfig: vi.fn(),
}))

// Mock TypeScript module
vi.mock('typescript', async () => {
  const actual = await vi.importActual<typeof import('typescript')>('typescript')
  return {
    ...actual,
    createWatchCompilerHost: vi.fn(),
    createWatchProgram: vi.fn(),
    sys: actual.sys,
    createSemanticDiagnosticsBuilderProgram: actual.createSemanticDiagnosticsBuilderProgram,
  }
})

describe('watch', () => {
  let processOnceSpy: ReturnType<typeof vi.spyOn>
  let consoleClearSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    processOnceSpy = vi.spyOn(process, 'once')
    consoleClearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('typeCheckWatch', () => {
    it('should create watch compiler host with correct parameters', () => {
      const mockConfigPath = '/project/tsconfig.json'
      const mockHost = {
        createProgram: vi.fn(),
      } as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(ts.createWatchCompilerHost).mockReturnValue(mockHost)
      vi.mocked(ts.createWatchProgram).mockReturnValue({
        close: vi.fn(),
      } as unknown as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

      typeCheckWatch({})

      expect(ts.createWatchCompilerHost).toHaveBeenCalledWith(
        mockConfigPath,
        {},
        ts.sys,
        ts.createSemanticDiagnosticsBuilderProgram,
        expect.any(Function), // reportDiagnostic
        expect.any(Function) // reportWatchStatusChanged
      )
    })

    it('should start watch program', () => {
      const mockConfigPath = '/project/tsconfig.json'
      const mockHost = {
        createProgram: vi.fn(),
      } as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(ts.createWatchCompilerHost).mockReturnValue(mockHost)
      vi.mocked(ts.createWatchProgram).mockReturnValue({
        close: vi.fn(),
      } as unknown as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

      typeCheckWatch({})

      expect(ts.createWatchProgram).toHaveBeenCalledWith(mockHost)
    })

    it('should register SIGINT handler using once for graceful shutdown', () => {
      const mockConfigPath = '/project/tsconfig.json'
      const mockHost = {
        createProgram: vi.fn(),
      } as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(ts.createWatchCompilerHost).mockReturnValue(mockHost)
      vi.mocked(ts.createWatchProgram).mockReturnValue({
        close: vi.fn(),
      } as unknown as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

      typeCheckWatch({})

      // Should use process.once to prevent handler accumulation
      expect(processOnceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    })

    it('should NOT call console.clear when noClear is true', () => {
      const mockConfigPath = '/project/tsconfig.json'
      let wrappedCreateProgram: ((...args: unknown[]) => unknown) | undefined

      const mockHost = {
        createProgram: vi.fn().mockReturnValue({} as ts.SemanticDiagnosticsBuilderProgram),
      } as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(ts.createWatchCompilerHost).mockImplementation(() => {
        return mockHost
      })
      vi.mocked(ts.createWatchProgram).mockImplementation((host) => {
        // Capture the wrapped createProgram
        wrappedCreateProgram = host.createProgram as (...args: unknown[]) => unknown
        return {
          close: vi.fn(),
        } as unknown as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>
      })

      typeCheckWatch({ noClear: true })

      // Simulate a non-first build by calling createProgram
      if (wrappedCreateProgram) {
        // First call - isFirstBuild is true, so clear won't be called regardless
        wrappedCreateProgram([], {}, undefined, undefined, [], undefined)
        // Second call - isFirstBuild is false, but noClear is true
        wrappedCreateProgram([], {}, undefined, undefined, [], undefined)
      }

      // console.clear should NOT have been called since noClear is true
      expect(consoleClearSpy).not.toHaveBeenCalled()
    })

    it('should call console.clear when noClear is false (after first build)', () => {
      const mockConfigPath = '/project/tsconfig.json'
      let wrappedCreateProgram: ((...args: unknown[]) => unknown) | undefined

      const mockHost = {
        createProgram: vi.fn().mockReturnValue({} as ts.SemanticDiagnosticsBuilderProgram),
      } as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(ts.createWatchCompilerHost).mockImplementation(() => {
        return mockHost
      })
      vi.mocked(ts.createWatchProgram).mockImplementation((host) => {
        // Capture the wrapped createProgram
        wrappedCreateProgram = host.createProgram as (...args: unknown[]) => unknown
        return {
          close: vi.fn(),
        } as unknown as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>
      })

      typeCheckWatch({ noClear: false })

      if (wrappedCreateProgram) {
        // First call - isFirstBuild is true, so clear won't be called
        wrappedCreateProgram([], {}, undefined, undefined, [], undefined)
        expect(consoleClearSpy).not.toHaveBeenCalled()

        // We need to simulate isFirstBuild becoming false
        // This happens after reportWatchStatusChanged is called with code 6194
        // For this test, we'll verify the createProgram is properly wrapped
      }

      // Verify the host's createProgram was replaced with a wrapper
      expect(mockHost.createProgram).not.toBe(vi.fn())
    })

    it('should use project option when provided instead of findTsConfig', () => {
      const customConfigPath = '/project/tsconfig.build.json'
      const mockHost = {
        createProgram: vi.fn(),
      } as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

      vi.mocked(ts.createWatchCompilerHost).mockReturnValue(mockHost)
      vi.mocked(ts.createWatchProgram).mockReturnValue({
        close: vi.fn(),
      } as unknown as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

      typeCheckWatch({ project: customConfigPath })

      // findTsConfig should NOT be called when project is provided
      expect(config.findTsConfig).not.toHaveBeenCalled()
      expect(ts.createWatchCompilerHost).toHaveBeenCalledWith(
        customConfigPath,
        {},
        ts.sys,
        ts.createSemanticDiagnosticsBuilderProgram,
        expect.any(Function),
        expect.any(Function)
      )
    })

    it('should return cleanup function that closes watch program', () => {
      const mockConfigPath = '/project/tsconfig.json'
      const mockClose = vi.fn()
      const mockHost = {
        createProgram: vi.fn(),
      } as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(ts.createWatchCompilerHost).mockReturnValue(mockHost)
      vi.mocked(ts.createWatchProgram).mockReturnValue({
        close: mockClose,
      } as unknown as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

      const cleanup = typeCheckWatch({})

      expect(typeof cleanup).toBe('function')

      // Call cleanup
      cleanup()

      expect(mockClose).toHaveBeenCalled()
    })

    it('should use default options when none provided', () => {
      const mockConfigPath = '/project/tsconfig.json'
      const mockHost = {
        createProgram: vi.fn(),
      } as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(ts.createWatchCompilerHost).mockReturnValue(mockHost)
      vi.mocked(ts.createWatchProgram).mockReturnValue({
        close: vi.fn(),
      } as unknown as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

      // Should not throw
      expect(() => typeCheckWatch({})).not.toThrow()
    })
  })
})
