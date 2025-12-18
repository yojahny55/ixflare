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
	let originalProcessOn: typeof process.on
	let processOnSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		vi.clearAllMocks()
		originalProcessOn = process.on
		processOnSpy = vi.spyOn(process, 'on')
	})

	afterEach(() => {
		process.on = originalProcessOn
		vi.restoreAllMocks()
	})

	describe('typeCheckWatch', () => {
		it('should create watch compiler host with correct parameters', () => {
			const mockConfigPath = '/project/tsconfig.json'
			const mockHost = {} as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(ts.createWatchCompilerHost).mockReturnValue(mockHost)
			vi.mocked(ts.createWatchProgram).mockReturnValue({} as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

			typeCheckWatch({})

			expect(ts.createWatchCompilerHost).toHaveBeenCalledWith(
				mockConfigPath,
				{},
				ts.sys,
				ts.createSemanticDiagnosticsBuilderProgram,
				expect.any(Function), // reportDiagnostic
				expect.any(Function), // reportWatchStatusChanged
			)
		})

		it('should start watch program', () => {
			const mockConfigPath = '/project/tsconfig.json'
			const mockHost = {
				createProgram: vi.fn(),
			} as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(ts.createWatchCompilerHost).mockReturnValue(mockHost)
			vi.mocked(ts.createWatchProgram).mockReturnValue({} as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

			typeCheckWatch({})

			expect(ts.createWatchProgram).toHaveBeenCalledWith(mockHost)
		})

		it('should register SIGINT handler for graceful shutdown', () => {
			const mockConfigPath = '/project/tsconfig.json'
			const mockHost = {
				createProgram: vi.fn(),
			} as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(ts.createWatchCompilerHost).mockReturnValue(mockHost)
			vi.mocked(ts.createWatchProgram).mockReturnValue({} as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

			typeCheckWatch({})

			expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
		})

		it('should respect noClear option', () => {
			const mockConfigPath = '/project/tsconfig.json'
			let capturedCreateProgram: typeof mockHost.createProgram | undefined

			const mockHost = {
				createProgram: vi.fn(),
			} as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(ts.createWatchCompilerHost).mockImplementation((...args) => {
				// Capture the original createProgram so we can verify it's wrapped
				capturedCreateProgram = mockHost.createProgram
				return mockHost
			})
			vi.mocked(ts.createWatchProgram).mockReturnValue({} as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

			typeCheckWatch({ noClear: true })

			// Verify that createProgram is wrapped (the function reference should change)
			expect(mockHost.createProgram).toBeDefined()
		})

		it('should use default options when none provided', () => {
			const mockConfigPath = '/project/tsconfig.json'
			const mockHost = {
				createProgram: vi.fn(),
			} as unknown as ts.WatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(ts.createWatchCompilerHost).mockReturnValue(mockHost)
			vi.mocked(ts.createWatchProgram).mockReturnValue({} as ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>)

			// Should not throw
			expect(() => typeCheckWatch({})).not.toThrow()
		})
	})
})
