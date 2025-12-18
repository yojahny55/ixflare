import picocolors from 'picocolors'
import * as ts from 'typescript'
import type { TypeCheckOptions, TypeCheckResult } from './typecheck/types.js'
import { typeCheck } from './typecheck/checker.js'
import { typeCheckWatch } from './typecheck/watch.js'
import { formatDiagnostics } from './typecheck/formatter.js'

/**
 * Display help message for typecheck command.
 */
function showHelp(): void {
	console.log(`
${picocolors.bold('Usage:')} ix typecheck [options]

${picocolors.bold('Description:')}
  Run TypeScript type checking on your project.

${picocolors.bold('Options:')}
  --watch, -w        Watch for file changes and re-check
  --ci               CI mode (plain output, appropriate exit code)
  --verbose          Show detailed diagnostic information
  --no-clear         Don't clear screen between watch checks
  --project, -p <p>  Path to tsconfig.json (default: auto-detect)
  --help, -h         Show this help message

${picocolors.bold('Examples:')}
  ix typecheck                        Run type check once
  ix typecheck --watch                Watch mode with live updates
  ix typecheck --ci                   Run in CI with exit codes
  ix typecheck --verbose              Show detailed information
  ix typecheck -p tsconfig.build.json Use specific tsconfig
`)
}

/**
 * Display verbose information about the type checking setup.
 */
function displayVerboseInfo(result: TypeCheckResult): void {
	console.log(picocolors.bold('\nType Checking Details:'))
	console.log(`  TypeScript version: ${picocolors.cyan(ts.version)}`)
	console.log(`  Config file: ${picocolors.cyan(result.configPath)}`)
	console.log(`  Files checked: ${picocolors.cyan(String(result.fileCount))}`)
	console.log(`  Duration: ${picocolors.cyan(`${result.duration}ms`)}`)

	// Show memory usage if available
	if (process.memoryUsage) {
		const memUsage = process.memoryUsage()
		const memMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2)
		console.log(`  Memory used: ${picocolors.cyan(`${memMB} MB`)}`)
	}
}

/**
 * Display type check results.
 */
function displayResult(result: TypeCheckResult, options: TypeCheckOptions): void {
	// Show verbose info first if requested
	if (options.verbose) {
		displayVerboseInfo(result)
	}

	// Display error diagnostics
	if (result.errorCount > 0) {
		const formatted = formatDiagnostics(result.diagnostics, options.ci ?? false)
		console.error(formatted)
	}

	// Display warning diagnostics (only in verbose mode or if no errors)
	if (result.warningCount > 0 && (options.verbose || result.errorCount === 0)) {
		const formattedWarnings = formatDiagnostics(result.warnings, options.ci ?? false)
		if (formattedWarnings) {
			console.warn(formattedWarnings)
		}
	}

	// Show summary
	if (result.errorCount > 0) {
		// Error summary
		const warningText = result.warningCount > 0
			? `, ${result.warningCount} warning${result.warningCount === 1 ? '' : 's'}`
			: ''
		if (options.ci) {
			console.error(
				`\n${result.errorCount} error${result.errorCount === 1 ? '' : 's'}${warningText} found`,
			)
		} else {
			console.error(
				picocolors.red(
					`\nFound ${result.errorCount} error${result.errorCount === 1 ? '' : 's'}${warningText} in ${result.fileCount} file${result.fileCount === 1 ? '' : 's'}.`,
				),
			)
		}
	} else if (result.warningCount > 0) {
		// Warnings only (success with warnings)
		if (options.ci) {
			console.log(`\n✓ No type errors found! (${result.warningCount} warning${result.warningCount === 1 ? '' : 's'})`)
			console.log(`\nType checked ${result.fileCount} files in ${(result.duration / 1000).toFixed(1)}s`)
		} else {
			console.log(picocolors.green(`\n✓ No type errors found!`) + picocolors.yellow(` (${result.warningCount} warning${result.warningCount === 1 ? '' : 's'})`))
			console.log(
				picocolors.dim(
					`\nType checked ${result.fileCount} files in ${(result.duration / 1000).toFixed(1)}s`,
				),
			)
		}
	} else {
		// Complete success
		if (options.ci) {
			console.log(`\n✓ No type errors found!`)
			console.log(`\nType checked ${result.fileCount} files in ${(result.duration / 1000).toFixed(1)}s`)
		} else {
			console.log(picocolors.green('\n✓ No type errors found!'))
			console.log(
				picocolors.dim(
					`\nType checked ${result.fileCount} files in ${(result.duration / 1000).toFixed(1)}s`,
				),
			)
		}
	}
}

/**
 * Get the value following a flag in the args array.
 */
function getArgValue(args: string[], ...flags: string[]): string | undefined {
	for (const flag of flags) {
		const index = args.indexOf(flag)
		if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('-')) {
			return args[index + 1]
		}
	}
	return undefined
}

/**
 * Parse command line arguments into TypeCheckOptions.
 */
function parseArgs(args: string[]): TypeCheckOptions {
	return {
		watch: args.includes('--watch') || args.includes('-w'),
		ci: args.includes('--ci'),
		verbose: args.includes('--verbose'),
		noClear: args.includes('--no-clear'),
		help: args.includes('--help') || args.includes('-h'),
		project: getArgValue(args, '--project', '-p'),
	}
}

/**
 * Main typecheck command handler.
 * Entry point for `ix typecheck` command.
 */
export async function typecheck(): Promise<void> {
	const args = process.argv.slice(3)
	const options = parseArgs(args)

	// Show help if requested
	if (options.help) {
		showHelp()
		return
	}

	try {
		if (options.watch) {
			// Watch mode - runs indefinitely
			typeCheckWatch(options)
		} else {
			// Single run mode
			const result = typeCheck(options)
			displayResult(result, options)

			// Exit with appropriate code
			process.exit(result.success ? 0 : 1)
		}
	} catch (error) {
		// Handle errors gracefully
		if (error instanceof Error) {
			console.error(picocolors.red(`\nError: ${error.message}`))
		} else {
			console.error(picocolors.red('\nAn unexpected error occurred'))
		}
		process.exit(1)
	}
}
