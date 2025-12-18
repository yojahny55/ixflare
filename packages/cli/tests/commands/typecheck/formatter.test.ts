import { describe, it, expect, vi } from 'vitest'
import * as ts from 'typescript'
import {
	formatDiagnostics,
	formatDiagnosticsPretty,
	formatDiagnosticsCI,
	createFormatHost,
} from '../../../src/commands/typecheck/formatter'

describe('formatter', () => {
	describe('createFormatHost', () => {
		it('should create a format host with correct methods', () => {
			const host = createFormatHost()

			expect(host.getCurrentDirectory()).toBe(process.cwd())
			expect(host.getCanonicalFileName('test.ts')).toBe('test.ts')
			expect(host.getNewLine()).toBe('\n')
		})
	})

	describe('formatDiagnosticsPretty', () => {
		it('should format diagnostics with colors using TypeScript API', () => {
			const mockDiagnostic: ts.Diagnostic = {
				category: ts.DiagnosticCategory.Error,
				code: 2322,
				messageText: "Type 'string' is not assignable to type 'number'.",
				file: undefined,
				start: undefined,
				length: undefined,
			}

			// We can't easily test the exact output since it uses TypeScript's internal formatter
			// but we can verify it returns a string
			const result = formatDiagnosticsPretty([mockDiagnostic])

			expect(typeof result).toBe('string')
			expect(result.length).toBeGreaterThan(0)
		})

		it('should handle empty diagnostics array', () => {
			const result = formatDiagnosticsPretty([])

			expect(result).toBe('')
		})
	})

	describe('formatDiagnosticsCI', () => {
		it('should format diagnostic with file location in CI format', () => {
			const mockFile = ts.createSourceFile(
				'test.ts',
				'const x: number = "hello"',
				ts.ScriptTarget.Latest,
			)

			const mockDiagnostic: ts.Diagnostic = {
				category: ts.DiagnosticCategory.Error,
				code: 2322,
				messageText: "Type 'string' is not assignable to type 'number'.",
				file: mockFile,
				start: 18,
				length: 7,
			}

			const result = formatDiagnosticsCI([mockDiagnostic])

			// Format: file:line:col: error TScode: message
			expect(result).toContain('test.ts:')
			expect(result).toContain('error TS2322:')
			expect(result).toContain("Type 'string' is not assignable to type 'number'")
		})

		it('should format diagnostic without file location', () => {
			const mockDiagnostic: ts.Diagnostic = {
				category: ts.DiagnosticCategory.Error,
				code: 5023,
				messageText: 'Unknown compiler option',
				file: undefined,
				start: undefined,
				length: undefined,
			}

			const result = formatDiagnosticsCI([mockDiagnostic])

			expect(result).toBe('error TS5023: Unknown compiler option')
		})

		it('should format multiple diagnostics', () => {
			const mockFile1 = ts.createSourceFile(
				'file1.ts',
				'const x: number = "hello"',
				ts.ScriptTarget.Latest,
			)

			const mockFile2 = ts.createSourceFile(
				'file2.ts',
				'const y: string = 42',
				ts.ScriptTarget.Latest,
			)

			const diagnostics: ts.Diagnostic[] = [
				{
					category: ts.DiagnosticCategory.Error,
					code: 2322,
					messageText: "Type 'string' is not assignable to type 'number'.",
					file: mockFile1,
					start: 18,
					length: 7,
				},
				{
					category: ts.DiagnosticCategory.Error,
					code: 2322,
					messageText: "Type 'number' is not assignable to type 'string'.",
					file: mockFile2,
					start: 18,
					length: 2,
				},
			]

			const result = formatDiagnosticsCI(diagnostics)
			const lines = result.split('\n')

			expect(lines).toHaveLength(2)
			expect(lines[0]).toContain('file1.ts:')
			expect(lines[1]).toContain('file2.ts:')
		})

		it('should handle empty diagnostics array', () => {
			const result = formatDiagnosticsCI([])

			expect(result).toBe('')
		})
	})

	describe('formatDiagnostics', () => {
		it('should use CI formatting when ci flag is true', () => {
			const mockDiagnostic: ts.Diagnostic = {
				category: ts.DiagnosticCategory.Error,
				code: 2322,
				messageText: 'Type error',
				file: undefined,
				start: undefined,
				length: undefined,
			}

			const result = formatDiagnostics([mockDiagnostic], true)

			// CI format should be plain text
			expect(result).toBe('error TS2322: Type error')
		})

		it('should use pretty formatting when ci flag is false', () => {
			const mockDiagnostic: ts.Diagnostic = {
				category: ts.DiagnosticCategory.Error,
				code: 2322,
				messageText: 'Type error',
				file: undefined,
				start: undefined,
				length: undefined,
			}

			const result = formatDiagnostics([mockDiagnostic], false)

			// Pretty format returns formatted output (we can't test exact format)
			expect(typeof result).toBe('string')
			expect(result.length).toBeGreaterThan(0)
		})
	})
})
