import * as ts from 'typescript'
import picocolors from 'picocolors'
import type { TypeCheckOptions } from './types.js'
import { findTsConfig } from './config.js'

/**
 * Format current time as HH:MM:SS for watch mode timestamps.
 */
function formatTime(): string {
	const now = new Date()
	const hours = String(now.getHours()).padStart(2, '0')
	const minutes = String(now.getMinutes()).padStart(2, '0')
	const seconds = String(now.getSeconds()).padStart(2, '0')
	return `${hours}:${minutes}:${seconds}`
}

/**
 * Extract file path from TypeScript's file change message.
 * TypeScript sends messages like "File '/path/to/file.ts' has changed."
 */
function extractChangedFilePath(message: string): string | null {
	// Match file path in single quotes from TypeScript's message
	const match = message.match(/File '([^']+)' has changed/)
	if (match) {
		return match[1]
	}
	return null
}

/**
 * Start watching for file changes and run type checking incrementally.
 * Uses TypeScript's built-in watch mode with semantic diagnostics builder
 * for efficient incremental compilation.
 *
 * @param options - Type checking options
 * @returns Cleanup function to stop watching
 */
export function typeCheckWatch(options: TypeCheckOptions): () => void {
	// Find config path (use project option if provided)
	const configPath = options.project ?? findTsConfig(process.cwd())

	// Track if this is the first build
	let isFirstBuild = true

	// Create watch compiler host for incremental builds
	const host = ts.createWatchCompilerHost(
		configPath,
		{},
		ts.sys,
		ts.createSemanticDiagnosticsBuilderProgram,
		reportDiagnostic,
		reportWatchStatusChanged,
	)

	// Override afterProgramCreate to add custom behavior
	const origCreateProgram = host.createProgram
	host.createProgram = (
		rootNames,
		compilerOptions,
		hostArg,
		oldProgram,
		configFileParsingDiagnostics,
		projectReferences,
	) => {
		// Clear screen before each check (unless --no-clear)
		if (!options.noClear && !isFirstBuild) {
			console.clear()
		}

		return origCreateProgram(
			rootNames,
			compilerOptions,
			hostArg,
			oldProgram,
			configFileParsingDiagnostics,
			projectReferences,
		)
	}

	// Report individual diagnostics
	function reportDiagnostic(diagnostic: ts.Diagnostic) {
		// Only report errors, not warnings in watch mode output
		if (diagnostic.category !== ts.DiagnosticCategory.Error) {
			return
		}
		const message = ts.formatDiagnosticsWithColorAndContext([diagnostic], {
			getCurrentDirectory: () => process.cwd(),
			getCanonicalFileName: (fileName) => fileName,
			getNewLine: () => '\n',
		})
		console.error(message)
	}

	// Report watch status changes
	function reportWatchStatusChanged(diagnostic: ts.Diagnostic) {
		const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

		// Detect compilation start
		if (diagnostic.code === 6031) {
			// "Starting compilation in watch mode..."
			console.log(picocolors.dim(`[${formatTime()}] Type checking...`))
			return
		}

		// Detect compilation complete
		if (diagnostic.code === 6194) {
			// "Found X errors. Watching for file changes."
			const match = message.match(/Found (\d+) error/)
			if (match) {
				const errorCount = Number.parseInt(match[1], 10)
				if (errorCount === 0) {
					console.log(picocolors.green(`✓ No type errors`))
				} else {
					console.log(
						picocolors.red(
							`✗ ${errorCount} error${errorCount === 1 ? '' : 's'} found`,
						),
					)
				}
			}
			console.log(picocolors.dim('\nWatching for file changes...'))
			isFirstBuild = false
			return
		}

		// File change detected (code 6032)
		if (diagnostic.code === 6032) {
			console.log(picocolors.dim(`[${formatTime()}] File changed, re-checking...`))
			return
		}

		// Specific file changed (code 6157: "File '/path/to/file.ts' has changed.")
		if (diagnostic.code === 6157) {
			const filePath = extractChangedFilePath(message)
			if (filePath) {
				console.log(picocolors.dim(`[${formatTime()}] File changed: ${picocolors.cyan(filePath)}`))
			}
			return
		}

		// For other status messages, just print them
		if (message) {
			console.log(picocolors.dim(message))
		}
	}

	// Start watching
	console.log(picocolors.bold('Watching for file changes...'))
	console.log(picocolors.dim('Press Ctrl+C to stop.\n'))

	const watchProgram = ts.createWatchProgram(host)

	// SIGINT handler for graceful shutdown
	const sigintHandler = () => {
		console.log('\n' + picocolors.dim('Type checking stopped.'))
		process.exit(0)
	}

	// Use 'once' to avoid handler accumulation
	process.once('SIGINT', sigintHandler)

	// Return cleanup function
	return () => {
		watchProgram.close()
		process.off('SIGINT', sigintHandler)
	}
}
