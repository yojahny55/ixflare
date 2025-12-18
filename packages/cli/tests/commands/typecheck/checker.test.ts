import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ts from 'typescript'
import { typeCheck } from '../../../src/commands/typecheck/checker'
import * as config from '../../../src/commands/typecheck/config'

// Mock the config module
vi.mock('../../../src/commands/typecheck/config', () => ({
  findTsConfig: vi.fn(),
  loadTsConfig: vi.fn(),
}))

// Mock TypeScript module
vi.mock('typescript', async () => {
  const actual = await vi.importActual<typeof import('typescript')>('typescript')
  return {
    ...actual,
    createProgram: vi.fn(),
    getPreEmitDiagnostics: vi.fn(),
  }
})

describe('checker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('typeCheck', () => {
    it('should successfully type check project with no errors', () => {
      const mockConfigPath = '/project/tsconfig.json'
      const mockParsedConfig: ts.ParsedCommandLine = {
        options: { strict: true },
        fileNames: ['src/index.ts', 'src/utils.ts'],
        errors: [],
      }

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
      vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
      vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue([])

      const result = typeCheck({})

      expect(result.success).toBe(true)
      expect(result.errorCount).toBe(0)
      expect(result.warningCount).toBe(0)
      expect(result.fileCount).toBe(2)
      expect(result.diagnostics).toEqual([])
      expect(result.warnings).toEqual([])
      expect(result.configPath).toBe(mockConfigPath)
      expect(typeof result.duration).toBe('number')
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should detect type errors and return diagnostics', () => {
      const mockConfigPath = '/project/tsconfig.json'
      const mockParsedConfig: ts.ParsedCommandLine = {
        options: { strict: true },
        fileNames: ['src/index.ts'],
        errors: [],
      }

      const mockDiagnostics: ts.Diagnostic[] = [
        {
          category: ts.DiagnosticCategory.Error,
          code: 2322,
          messageText: "Type 'string' is not assignable to type 'number'.",
          file: undefined,
          start: undefined,
          length: undefined,
        },
        {
          category: ts.DiagnosticCategory.Error,
          code: 2339,
          messageText: "Property 'foo' does not exist on type 'User'.",
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

      expect(result.success).toBe(false)
      expect(result.errorCount).toBe(2)
      expect(result.warningCount).toBe(0)
      expect(result.fileCount).toBe(1)
      expect(result.diagnostics).toEqual(mockDiagnostics)
      expect(result.configPath).toBe(mockConfigPath)
    })

    it('should separate warnings from errors', () => {
      const mockConfigPath = '/project/tsconfig.json'
      const mockParsedConfig: ts.ParsedCommandLine = {
        options: { strict: true },
        fileNames: ['src/index.ts'],
        errors: [],
      }

      const mockError: ts.Diagnostic = {
        category: ts.DiagnosticCategory.Error,
        code: 2322,
        messageText: "Type 'string' is not assignable to type 'number'.",
        file: undefined,
        start: undefined,
        length: undefined,
      }

      const mockWarning: ts.Diagnostic = {
        category: ts.DiagnosticCategory.Warning,
        code: 6133,
        messageText: "'x' is declared but its value is never read.",
        file: undefined,
        start: undefined,
        length: undefined,
      }

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
      vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
      vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue([mockError, mockWarning])

      const result = typeCheck({})

      expect(result.success).toBe(false)
      expect(result.errorCount).toBe(1)
      expect(result.warningCount).toBe(1)
      expect(result.diagnostics).toEqual([mockError])
      expect(result.warnings).toEqual([mockWarning])
    })

    it('should succeed with only warnings (no errors)', () => {
      const mockConfigPath = '/project/tsconfig.json'
      const mockParsedConfig: ts.ParsedCommandLine = {
        options: { strict: true },
        fileNames: ['src/index.ts'],
        errors: [],
      }

      const mockWarning: ts.Diagnostic = {
        category: ts.DiagnosticCategory.Warning,
        code: 6133,
        messageText: "'x' is declared but its value is never read.",
        file: undefined,
        start: undefined,
        length: undefined,
      }

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
      vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
      vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue([mockWarning])

      const result = typeCheck({})

      // Success is true because there are no errors (only warnings)
      expect(result.success).toBe(true)
      expect(result.errorCount).toBe(0)
      expect(result.warningCount).toBe(1)
    })

    it('should use project option when provided', () => {
      const customConfigPath = '/project/tsconfig.build.json'
      const mockParsedConfig: ts.ParsedCommandLine = {
        options: {},
        fileNames: ['src/index.ts'],
        errors: [],
      }

      vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
      vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
      vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue([])

      const result = typeCheck({ project: customConfigPath })

      // findTsConfig should NOT be called when project is provided
      expect(config.findTsConfig).not.toHaveBeenCalled()
      expect(config.loadTsConfig).toHaveBeenCalledWith(customConfigPath)
      expect(result.configPath).toBe(customConfigPath)
    })

    it('should use process.cwd() as default directory when no project option', () => {
      const cwd = process.cwd()
      const mockConfigPath = '/project/tsconfig.json'
      const mockParsedConfig: ts.ParsedCommandLine = {
        options: {},
        fileNames: [],
        errors: [],
      }

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
      vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
      vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue([])

      typeCheck({})

      expect(config.findTsConfig).toHaveBeenCalledWith(cwd)
    })

    it('should create TypeScript program with correct parameters', () => {
      const mockConfigPath = '/project/tsconfig.json'
      const mockParsedConfig: ts.ParsedCommandLine = {
        options: { strict: true, target: ts.ScriptTarget.ES2020 },
        fileNames: ['src/index.ts', 'src/utils.ts'],
        errors: [],
      }

      vi.mocked(config.findTsConfig).mockReturnValue(mockConfigPath)
      vi.mocked(config.loadTsConfig).mockReturnValue(mockParsedConfig)
      vi.mocked(ts.createProgram).mockReturnValue({} as ts.Program)
      vi.mocked(ts.getPreEmitDiagnostics).mockReturnValue([])

      typeCheck({})

      expect(ts.createProgram).toHaveBeenCalledWith(
        mockParsedConfig.fileNames,
        mockParsedConfig.options
      )
    })

    it('should measure execution time', () => {
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

      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(typeof result.duration).toBe('number')
    })
  })
})
