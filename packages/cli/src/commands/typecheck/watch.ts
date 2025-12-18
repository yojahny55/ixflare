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
 * Start watching for file changes and run type checking incrementally.
 * Uses TypeScript's built-in watch mode with semantic diagnostics builder
 * for efficient incremental compilation.
 *
 * @param options - Type checking options
 */
export function typeCheckWatch(options: TypeCheckOptions): void {
	const configPath = findTsConfig(process.cwd())

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
		host,
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
			host,
			oldProgram,
			configFileParsingDiagnostics,
			projectReferences,
		)
	}

	// Report individual diagnostics
	function reportDiagnostic(diagnostic: ts.Diagnostic) {
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

		// File change detected
		if (diagnostic.code === 6032) {
			// "File change detected. Starting incremental compilation..."
			const fileMatch = message.match(/File change detected\. Starting/)
			if (fileMatch) {
				console.log(picocolors.dim(`[${formatTime()}] File changed, re-checking...`))
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

	ts.createWatchProgram(host)

	// Handle graceful shutdown
	process.on('SIGINT', () => {
		console.log('\n' + picocolors.dim('Type checking stopped.'))
		process.exit(0)
	})
}
