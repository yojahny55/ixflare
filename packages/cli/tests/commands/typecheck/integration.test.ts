import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { typeCheck } from '../../../src/commands/typecheck/checker'
import { CLIError } from '../../../src/errors/cli-error'
import * as config from '../../../src/commands/typecheck/config'
import * as ts from 'typescript'

// Mock dependencies
vi.mock('../../../src/commands/typecheck/config')
vi.mock('typescript', async () => {
	const actual = await vi.importActual<typeof import('typescript')>('typescript')
	return {
		...actual,
		createProgram: vi.fn(),
		getPreEmitDiagnostics: vi.fn(),
	}
})

describe('typecheck integration', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('full type checking workflow', () => {
		it('should complete full workflow successfully with no errors', () => {
			const mockConfigPath = '/project/tsconfig.json'
			const mockParsedConfig: ts.ParsedCommandLine = {
				options: {
					strict: true,
					target: ts.ScriptTarget.ES2020,
					module: ts.ModuleKind.ESNext,
				},
				fileNames: ['src/index.ts', 'src/utils.ts', 'src/types.ts'],
				errors: [],
			}

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
			vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
			vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue([])

			const result = typeCheck({ verbose: true })

			// Verify result structure
			expect(result).toMatchObject({
				success: true,
				errorCount: 0,
				fileCount: 3,
				configPath: mockConfigPath,
			})

			// Verify all functions were called in correct order
			expect(config.findTsConfig).toHaveBeenCalledTimes(1)
			expect(config.loadTsConfig).toHaveBeenCalledWith(mockConfigPath)
			expect(ts.createProgram).toHaveBeenCalledWith(
				mockParsedConfig.fileNames,
				mockParsedConfig.options,
			)
			expect(ts.getPreEmitDiagnostics).toHaveBeenCalledTimes(1)
		})

		it('should handle type errors and return detailed diagnostics', () => {
			const mockConfigPath = '/project/tsconfig.json'
			const mockFile = ts.createSourceFile(
				'src/user.ts',
				'const userId: number = "123"',
				ts.ScriptTarget.Latest,
			)

			const mockParsedConfig: ts.ParsedCommandLine = {
				options: { strict: true },
				fileNames: ['src/user.ts'],
				errors: [],
			}

			const mockDiagnostics: ts.Diagnostic[] = [
				{
					category: ts.DiagnosticCategory.Error,
					code: 2322,
					messageText: "Type 'string' is not assignable to type 'number'.",
					file: mockFile,
					start: 23,
					length: 5,
				},
			]

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
			vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
			vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue(mockDiagnostics)

			const result = typeCheck({ ci: true })

			expect(result.success).toBe(false)
			expect(result.errorCount).toBe(1)
			expect(result.diagnostics).toHaveLength(1)
			expect(result.diagnostics[0].code).toBe(2322)
		})

		it('should propagate config errors', () => {
			vi.mocked(config.findTsConfig).mockImplementation(() => {
				throw new CLIError({
					code: 'CONFIG.NOT_FOUND',
					message: 'No tsconfig.json found',
				})
			})

			expect(() => typeCheck({})).toThrow(CLIError)
			expect(() => typeCheck({})).toThrow('No tsconfig.json found')
		})

		it('should handle multiple type errors across different files', () => {
			const mockConfigPath = '/project/tsconfig.json'

			const mockFile1 = ts.createSourceFile(
				'src/user.ts',
				'const userId: number = "123"',
				ts.ScriptTarget.Latest,
			)

			const mockFile2 = ts.createSourceFile(
				'src/post.ts',
				'const postId: string = 456',
				ts.ScriptTarget.Latest,
			)

			const mockParsedConfig: ts.ParsedCommandLine = {
				options: { strict: true },
				fileNames: ['src/user.ts', 'src/post.ts'],
				errors: [],
			}

			const mockDiagnostics: ts.Diagnostic[] = [
				{
					category: ts.DiagnosticCategory.Error,
					code: 2322,
					messageText: "Type 'string' is not assignable to type 'number'.",
					file: mockFile1,
					start: 23,
					length: 5,
				},
				{
					category: ts.DiagnosticCategory.Error,
					code: 2322,
					messageText: "Type 'number' is not assignable to type 'string'.",
					file: mockFile2,
					start: 23,
					length: 3,
				},
			]

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
			vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
			vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue(mockDiagnostics)

			const result = typeCheck({})

			expect(result.success).toBe(false)
			expect(result.errorCount).toBe(2)
			expect(result.fileCount).toBe(2)
			expect(result.diagnostics).toHaveLength(2)
		})

		it('should measure execution time accurately', () => {
			const mockConfigPath = '/project/tsconfig.json'
			const mockParsedConfig: ts.ParsedCommandLine = {
				options: {},
				fileNames: ['src/index.ts'],
				errors: [],
			}

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
			vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
			vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue([])

			const startTime = Date.now()
			const result = typeCheck({})
			const endTime = Date.now()

			expect(result.duration).toBeGreaterThanOrEqual(0)
			expect(result.duration).toBeLessThanOrEqual(endTime - startTime + 10) // Allow 10ms margin
		})
	})

	describe('exit code behavior', () => {
		it('should indicate success with zero errors', () => {
			const mockConfigPath = '/project/tsconfig.json'
			const mockParsedConfig: ts.ParsedCommandLine = {
				options: {},
				fileNames: ['src/index.ts'],
				errors: [],
			}

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
			vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
			vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue([])

			const result = typeCheck({})

			// Success case - would exit with 0
			expect(result.success).toBe(true)
		})

		it('should indicate failure with errors present', () => {
			const mockConfigPath = '/project/tsconfig.json'
			const mockParsedConfig: ts.ParsedCommandLine = {
				options: {},
				fileNames: ['src/index.ts'],
				errors: [],
			}

			const mockDiagnostics: ts.Diagnostic[] = [
				{
					category: ts.DiagnosticCategory.Error,
					code: 2322,
					messageText: 'Type error',
					file: undefined,
					start: undefined,
					length: undefined,
				},
			]

			vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
			vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
			vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
			vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue(mockDiagnostics)

			const result = typeCheck({})

			// Error case - would exit with 1
			expect(result.success).toBe(false)
		})
	})
})
