import * as ts from 'typescript'
import type { TypeCheckOptions, TypeCheckResult } from './types.js'
import { findTsConfig, loadTsConfig } from './config.js'

/**
 * Perform type checking on a TypeScript project.
 * This function:
 * 1. Finds and loads tsconfig.json (or uses provided path)
 * 2. Creates a TypeScript program
 * 3. Collects pre-emit diagnostics (type errors and warnings)
 * 4. Returns results with timing information
 *
 * @param options - Type checking options
 * @returns Type check results including diagnostics and timing
 */
export function typeCheck(options: TypeCheckOptions = {}): TypeCheckResult {
	const startTime = Date.now()

	// Find and load tsconfig.json (use project option if provided)
	const configPath = options.project ?? findTsConfig(process.cwd())
	const config = loadTsConfig(configPath)

	// Create TypeScript program
	const program = ts.createProgram(config.fileNames, config.options)

	// Get pre-emit diagnostics (type errors and warnings)
	const allDiagnostics = ts.getPreEmitDiagnostics(program)

	// Separate errors from warnings
	const errors = allDiagnostics.filter(
		(d) => d.category === ts.DiagnosticCategory.Error,
	)
	const warnings = allDiagnostics.filter(
		(d) => d.category === ts.DiagnosticCategory.Warning,
	)

	const duration = Date.now() - startTime

	return {
		success: errors.length === 0,
		errorCount: errors.length,
		warningCount: warnings.length,
		fileCount: config.fileNames.length,
		duration,
		diagnostics: errors,
		warnings,
		configPath,
	}
}
