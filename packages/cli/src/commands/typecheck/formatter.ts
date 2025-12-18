import * as ts from 'typescript'
import type { FormatDiagnosticsHost } from './types.js'

/**
 * Create a diagnostic formatting host for TypeScript compiler.
 * This provides the context needed for formatting diagnostics with file paths.
 */
export function createFormatHost(): FormatDiagnosticsHost {
	return {
		getCurrentDirectory: () => process.cwd(),
		getCanonicalFileName: (fileName: string) => fileName,
		getNewLine: () => '\n',
	}
}

/**
 * Format diagnostics with colors and context (default pretty output).
 * Uses TypeScript's built-in formatter that includes:
 * - Color-coded output (errors in red)
 * - File path with line and column numbers
 * - Source code snippet with error indicator
 * - Error code and message
 *
 * @param diagnostics - TypeScript diagnostics to format
 * @returns Formatted diagnostic string with ANSI colors
 */
export function formatDiagnosticsPretty(
	diagnostics: readonly ts.Diagnostic[],
): string {
	const host = createFormatHost()
	return ts.formatDiagnosticsWithColorAndContext(diagnostics, host)
}

/**
 * Format diagnostics for CI environments (plain text, no colors).
 * Output format: path:line:col: error TSxxxx: message
 * Compatible with GitHub Actions annotations.
 *
 * @param diagnostics - TypeScript diagnostics to format
 * @returns Plain text diagnostic string
 */
export function formatDiagnosticsCI(
	diagnostics: readonly ts.Diagnostic[],
): string {
	const lines: string[] = []

	for (const diagnostic of diagnostics) {
		if (diagnostic.file && diagnostic.start !== undefined) {
			const { line, character } =
				diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
			const message = ts.flattenDiagnosticMessageText(
				diagnostic.messageText,
				'\n',
			)
			const code = `TS${diagnostic.code}`

			// GitHub Actions compatible format: file:line:col: error code: message
			lines.push(
				`${diagnostic.file.fileName}:${line + 1}:${character + 1}: error ${code}: ${message}`,
			)
		} else {
			// Global diagnostic without file location
			const message = ts.flattenDiagnosticMessageText(
				diagnostic.messageText,
				'\n',
			)
			lines.push(`error TS${diagnostic.code}: ${message}`)
		}
	}

	return lines.join('\n')
}

/**
 * Format diagnostics based on environment.
 * Uses pretty output for TTY, plain output for CI.
 *
 * @param diagnostics - TypeScript diagnostics to format
 * @param ci - Whether to use CI mode formatting
 * @returns Formatted diagnostic string
 */
export function formatDiagnostics(
	diagnostics: readonly ts.Diagnostic[],
	ci: boolean,
): string {
	return ci
		? formatDiagnosticsCI(diagnostics)
		: formatDiagnosticsPretty(diagnostics)
}
