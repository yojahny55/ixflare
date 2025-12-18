import type * as ts from 'typescript'

export interface TypeCheckOptions {
	/** Enable watch mode for continuous type checking */
	watch?: boolean
	/** CI mode - plain output without colors, appropriate exit codes */
	ci?: boolean
	/** Show detailed diagnostic information */
	verbose?: boolean
	/** Don't clear screen between watch checks */
	noClear?: boolean
	/** Show help message */
	help?: boolean
	/** Path to tsconfig.json (overrides automatic detection) */
	project?: string
}

export interface TypeCheckResult {
	/** Whether type checking succeeded (no errors) */
	success: boolean
	/** Number of type errors found */
	errorCount: number
	/** Number of warnings found */
	warningCount: number
	/** Number of files type checked */
	fileCount: number
	/** Time taken in milliseconds */
	duration: number
	/** Raw TypeScript diagnostics (errors only) */
	diagnostics: readonly ts.Diagnostic[]
	/** Raw TypeScript warnings */
	warnings: readonly ts.Diagnostic[]
	/** Path to tsconfig.json used */
	configPath: string
}

export interface FormatDiagnosticsHost {
	getCurrentDirectory(): string
	getCanonicalFileName(fileName: string): string
	getNewLine(): string
}
