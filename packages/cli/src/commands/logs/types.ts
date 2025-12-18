/**
 * Log streaming types for Cloudflare Workers
 */

export interface LogsOptions {
	/** Stream live logs (default true) */
	tail?: boolean
	/** Text search filter (case-insensitive) */
	filter?: string
	/** Filter by invocation status */
	status?: 'ok' | 'error' | 'canceled'
	/** Filter by HTTP method */
	method?: string
	/** Filter by client IP address */
	ip?: string
	/** Target environment (default: production) */
	env?: string
	/** Output format */
	format?: 'pretty' | 'json'
	/** Sampling rate (0-100 percentage) */
	samplingRate?: number
	/** Historical start time (e.g., "1h", "30m", "2d") */
	since?: string
	/** Historical end time (e.g., "30m", "1h") */
	until?: string
	/** Worker name override */
	worker?: string
	/** Show help */
	help?: boolean
}

/**
 * Parsed log entry from wrangler tail JSON output
 */
export interface LogEntry {
	/** Unix timestamp in milliseconds */
	timestamp: number
	/** HTTP method */
	method: string
	/** Request path */
	path: string
	/** HTTP status code */
	status: number
	/** Response time in milliseconds */
	duration: number
	/** Invocation outcome */
	outcome: 'ok' | 'error' | 'canceled'
	/** Console log messages */
	logs: LogMessage[]
	/** Caught exceptions */
	exceptions: Exception[]
	/** Worker script name */
	scriptName: string
}

/**
 * Console log message from worker
 */
export interface LogMessage {
	/** Log message content */
	message: string
	/** Log level */
	level: 'log' | 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Exception thrown in worker
 */
export interface Exception {
	/** Exception type name */
	name: string
	/** Error message */
	message: string
	/** Stack trace (if available) */
	stack?: string
}

/**
 * Raw wrangler tail JSON output format
 */
export interface WranglerLogOutput {
	/** Invocation outcome */
	outcome: 'ok' | 'error' | 'canceled'
	/** Worker script name */
	scriptName: string
	/** Array of exceptions */
	exceptions: Exception[]
	/** Array of log messages */
	logs: Array<{
		message: unknown[]
		level: string
		timestamp: number
	}>
	/** Unix timestamp in milliseconds */
	eventTimestamp: number
	/** Event details */
	event?: {
		request?: {
			url?: string
			method?: string
			headers?: Record<string, string>
			cf?: {
				colo?: string
				country?: string
			}
		}
	}
}

/**
 * Bridge event types
 */
export type BridgeEvent =
	| { type: 'log'; entry: LogEntry }
	| { type: 'status'; message: string }
	| { type: 'reconnecting' }
	| { type: 'reconnected' }
	| { type: 'error'; error: Error }
