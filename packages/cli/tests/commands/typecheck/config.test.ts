import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as ts from 'typescript'
import { findTsConfig, loadTsConfig } from '../../../src/commands/typecheck/config'
import { CLIError } from '../../../src/errors/cli-error'

// Mock TypeScript module
vi.mock('typescript', async () => {
	const actual = await vi.importActual<typeof import('typescript')>('typescript')
	return {
		...actual,
		findConfigFile: vi.fn(),
		readConfigFile: vi.fn(),
		parseJsonConfigFileContent: vi.fn(),
		sys: {
			...actual.sys,
			fileExists: vi.fn(),
			readFile: vi.fn(),
		},
	}
})

describe('config', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('findTsConfig', () => {
		it('should find tsconfig.json when it exists', () => {
			const mockPath = '/project/tsconfig.json'
			vi.mocked(ts.findConfigFile).mockReturnValue(mockPath)

			const result = findTsConfig('/project')

			expect(result).toBe(mockPath)
			expect(ts.findConfigFile).toHaveBeenCalledWith(
				'/project',
				ts.sys.fileExists,
				'tsconfig.json',
			)
		})

		it('should throw CLIError when tsconfig.json not found', () => {
			vi.mocked(ts.findConfigFile).mockReturnValue(undefined)

			expect(() => findTsConfig('/project')).toThrow(CLIError)
			expect(() => findTsConfig('/project')).toThrow('No tsconfig.json found')
		})

		it('should use process.cwd() as default start directory', () => {
			const cwd = process.cwd()
			vi.mocked(ts.findConfigFile).mockReturnValue('/project/tsconfig.json')

			findTsConfig()

			expect(ts.findConfigFile).toHaveBeenCalledWith(
				cwd,
				ts.sys.fileExists,
				'tsconfig.json',
			)
		})
	})

	describe('loadTsConfig', () => {
		it('should load and parse valid tsconfig.json', () => {
			const mockConfig = {
				compilerOptions: {
					strict: true,
					target: 'ES2020',
				},
			}

			const mockParsed: ts.ParsedCommandLine = {
				options: { strict: true, target: ts.ScriptTarget.ES2020 },
				fileNames: ['src/index.ts', 'src/utils.ts'],
				errors: [],
			}

			vi.mocked(ts.readConfigFile).mockReturnValue({
				config: mockConfig,
				error: undefined,
			})

			vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue(mockParsed)

			const result = loadTsConfig('/project/tsconfig.json')

			expect(result).toEqual(mockParsed)
			expect(ts.readConfigFile).toHaveBeenCalledWith(
				'/project/tsconfig.json',
				ts.sys.readFile,
			)
		})

		it('should throw CLIError when config file cannot be read', () => {
			const mockError: ts.Diagnostic = {
				category: ts.DiagnosticCategory.Error,
				code: 5023,
				messageText: 'File not found',
				file: undefined,
				start: undefined,
				length: undefined,
			}

			vi.mocked(ts.readConfigFile).mockReturnValue({
				config: undefined,
				error: mockError,
			})

			expect(() => loadTsConfig('/project/tsconfig.json')).toThrow(CLIError)
			expect(() => loadTsConfig('/project/tsconfig.json')).toThrow('Error reading tsconfig.json')
		})

		it('should throw CLIError when config has parsing errors', () => {
			const mockConfig = {
				compilerOptions: { strict: true },
			}

			const parseError: ts.Diagnostic = {
				category: ts.DiagnosticCategory.Error,
				code: 5024,
				messageText: 'Invalid configuration',
				file: undefined,
				start: undefined,
				length: undefined,
			}

			vi.mocked(ts.readConfigFile).mockReturnValue({
				config: mockConfig,
				error: undefined,
			})

			vi.mocked(ts.parseJsonConfigFileContent).mockReturnValue({
				options: {},
				fileNames: [],
				errors: [parseError],
			})

			expect(() => loadTsConfig('/project/tsconfig.json')).toThrow(CLIError)
			expect(() => loadTsConfig('/project/tsconfig.json')).toThrow('Invalid tsconfig.json')
		})
	})
})
