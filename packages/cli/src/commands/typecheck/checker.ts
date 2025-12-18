import * as ts from 'typescript'
import type { TypeCheckOptions, TypeCheckResult } from './types.js'
import { findTsConfig, loadTsConfig } from './config.js'

/**
 * Perform type checking on a TypeScript project.
 * This function:
 * 1. Finds and loads tsconfig.json
 * 2. Creates a TypeScript program
 * 3. Collects pre-emit diagnostics (type errors)
 * 4. Returns results with timing information
 *
 * @param _options - Type checking options (reserved for future use)
 * @returns Type check results including diagnostics and timing
 */
export function typeCheck(_options: TypeCheckOptions = {}): TypeCheckResult {
	const startTime = Date.now()

	// Find and load tsconfig.json
	const configPath = findTsConfig(process.cwd())
	const config = loadTsConfig(configPath)

	// Create TypeScript program
	const program = ts.createProgram(config.fileNames, config.options)

	// Get pre-emit diagnostics (type errors, not emit errors)
	const diagnostics = ts.getPreEmitDiagnostics(program)

	const duration = Date.now() - startTime

	return {
		success: diagnostics.length === 0,
		errorCount: diagnostics.length,
		fileCount: config.fileNames.length,
		duration,
		diagnostics,
		configPath,
	}
}
