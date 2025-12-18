/**
 * Log entry formatting for terminal output
 */

import pc from 'picocolors'
import type { LogEntry, LogMessage, Exception } from './types.js'

/**
 * Formats a log entry for pretty terminal output
 */
export function formatLogEntry(entry: LogEntry): string {
	const timestamp = formatTimestamp(entry.timestamp)
	const method = entry.method.padEnd(6)
	const status = formatStatus(entry.status)
	const duration = entry.duration > 0 ? pc.dim(`(${entry.duration}ms)`) : ''

	let output = `${pc.dim('[')}${timestamp}${pc.dim(']')} ${method} ${entry.path} ${status} ${duration}`

	// Add console.log messages
	if (entry.logs.length > 0) {
		for (const log of entry.logs) {
			output += `\n  ${pc.dim('└─')} ${formatLogMessage(log)}`
		}
	}

	// Add exceptions
	if (entry.exceptions.length > 0) {
		for (const ex of entry.exceptions) {
			output += `\n  ${pc.dim('└─')} ${formatException(ex)}`
		}
	}

	return output
}

/**
 * Formats timestamp to local time (HH:MM:SS)
 */
export function formatTimestamp(unixMs: number): string {
	const date = new Date(unixMs)
	return date.toLocaleTimeString('en-US', {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})
}

/**
 * Formats HTTP status code with color
 * Green: 2xx, Yellow: 3xx, Red: 4xx/5xx
 */
export function formatStatus(status: number): string {
	const str = String(status)
	if (status >= 200 && status < 300) {
		return pc.green(str)
	}
	if (status >= 300 && status < 400) {
		return pc.yellow(str)
	}
	if (status >= 400) {
		return pc.red(str)
	}
	return pc.dim(str) // 0 or 1xx
}

/**
 * Formats a log message with level-based coloring
 */
function formatLogMessage(log: LogMessage): string {
	const level = formatLogLevel(log.level)
	return `${level}: ${log.message}`
}

/**
 * Formats log level with color
 */
function formatLogLevel(level: LogMessage['level']): string {
	switch (level) {
		case 'error':
			return pc.red(level.toUpperCase())
		case 'warn':
			return pc.yellow(level.toUpperCase())
		case 'info':
			return pc.blue(level.toUpperCase())
		case 'debug':
			return pc.dim(level.toUpperCase())
		default:
			return level.toUpperCase()
	}
}

/**
 * Formats an exception with stack trace
 */
function formatException(ex: Exception): string {
	let output = `${pc.red(ex.name)}: ${ex.message}`

	if (ex.stack) {
		// Format stack trace with indentation
		const stackLines = ex.stack.split('\n')
		for (const line of stackLines) {
			if (line.trim()) {
				output += `\n      ${pc.dim(line.trim())}`
			}
		}
	}

	return output
}

/**
 * Formats a JSON log entry (for --format json)
 */
export function formatLogEntryJson(entry: LogEntry): string {
	return JSON.stringify(entry)
}
