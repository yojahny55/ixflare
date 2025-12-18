/**
 * Parser for wrangler tail JSON output
 */

import type { WranglerLogOutput, LogEntry, LogMessage, Exception } from './types.js'

/**
 * Parses raw wrangler tail JSON output into structured LogEntry
 */
export function parseLogEntry(raw: WranglerLogOutput): LogEntry {
	const url = raw.event?.request?.url || ''
	const urlObj = url ? new URL(url) : null

	return {
		timestamp: raw.eventTimestamp,
		method: raw.event?.request?.method || 'UNKNOWN',
		path: urlObj?.pathname || '/',
		status: extractStatusCode(raw),
		duration: extractDuration(raw),
		outcome: raw.outcome,
		logs: parseLogs(raw.logs),
		exceptions: parseExceptions(raw.exceptions),
		scriptName: raw.scriptName,
	}
}

/**
 * Extracts HTTP status code from log messages or defaults to outcome-based code
 */
function extractStatusCode(raw: WranglerLogOutput): number {
	// Try to find status in log messages using specific patterns
	// to avoid false positives with arbitrary 3-digit numbers (like user IDs)
	for (const log of raw.logs) {
		const messages = Array.isArray(log.message) ? log.message : [log.message]
		for (const msg of messages) {
			if (typeof msg === 'string') {
				// Pattern 1: "status: 200" or "status=200" or "status 200"
				const statusMatch = msg.match(/\bstatus[:\s=]+(\d{3})\b/i)
				if (statusMatch) {
					const code = parseInt(statusMatch[1], 10)
					if (code >= 100 && code < 600) {
						return code
					}
				}

				// Pattern 2: "HTTP 200" or "HTTP/1.1 200"
				const httpMatch = msg.match(/\bHTTP(?:\/[\d.]+)?\s+(\d{3})\b/i)
				if (httpMatch) {
					const code = parseInt(httpMatch[1], 10)
					if (code >= 100 && code < 600) {
						return code
					}
				}

				// Pattern 3: "[200]" - common log format
				const bracketMatch = msg.match(/\[(\d{3})\]/)
				if (bracketMatch) {
					const code = parseInt(bracketMatch[1], 10)
					if (code >= 100 && code < 600) {
						return code
					}
				}
			}
		}
	}

	// Default based on outcome
	switch (raw.outcome) {
		case 'ok':
			return 200
		case 'error':
			return 500
		case 'canceled':
			return 499 // Client closed request
		default:
			return 0
	}
}

/**
 * Extracts response duration from log messages (if available)
 */
function extractDuration(raw: WranglerLogOutput): number {
	// Try to find duration in log messages
	for (const log of raw.logs) {
		const messages = Array.isArray(log.message) ? log.message : [log.message]
		for (const msg of messages) {
			if (typeof msg === 'string') {
				// Look for "duration: 23ms" or "(23ms)" patterns
				const durationMatch = msg.match(/(\d+)\s*ms/)
				if (durationMatch) {
					return parseInt(durationMatch[1], 10)
				}
			}
		}
	}

	return 0 // Duration not available
}

/**
 * Parses log messages array into structured format
 */
function parseLogs(logs: WranglerLogOutput['logs']): LogMessage[] {
	return logs.map((log) => ({
		message: formatLogMessage(log.message),
		level: normalizeLogLevel(log.level),
	}))
}

/**
 * Formats log message from wrangler format (array of values) to string
 */
function formatLogMessage(message: unknown[]): string {
	if (!Array.isArray(message)) {
		return String(message)
	}

	return message
		.map((item) => {
			if (typeof item === 'string') {
				return item
			}
			if (typeof item === 'object' && item !== null) {
				try {
					return JSON.stringify(item)
				} catch {
					return String(item)
				}
			}
			return String(item)
		})
		.join(' ')
}

/**
 * Normalizes log level to standard format
 */
function normalizeLogLevel(level: string): LogMessage['level'] {
	const normalized = level.toLowerCase()
	switch (normalized) {
		case 'log':
		case 'debug':
		case 'info':
		case 'warn':
		case 'error':
			return normalized
		default:
			return 'log'
	}
}

/**
 * Parses exception array (already in correct format from wrangler)
 */
function parseExceptions(exceptions: Exception[]): Exception[] {
	return exceptions.map((ex) => ({
		name: ex.name || 'Error',
		message: ex.message || 'Unknown error',
		stack: ex.stack,
	}))
}

/**
 * Attempts to parse a line of text as JSON wrangler output
 * Returns null if not valid JSON
 */
export function tryParseLogLine(line: string): LogEntry | null {
	try {
		const raw = JSON.parse(line) as WranglerLogOutput
		// Validate it looks like wrangler output
		if (raw.outcome && raw.eventTimestamp && raw.scriptName) {
			return parseLogEntry(raw)
		}
		return null
	} catch {
		return null
	}
}
