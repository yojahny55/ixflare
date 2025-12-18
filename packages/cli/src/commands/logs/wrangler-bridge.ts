/**
 * Wrangler tail subprocess bridge for streaming logs
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import { EventEmitter } from 'node:events'
import type { LogsOptions } from './types.js'
import { tryParseLogLine } from './parser.js'

/**
 * Bridge to wrangler tail subprocess with automatic reconnection
 */
export class WranglerTailBridge extends EventEmitter {
	private process: ChildProcess | null = null
	private readline: Interface | null = null
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private reconnectDelay = 1000 // Start with 1 second
	private isStopped = false
	private workerName: string = ''
	private options: LogsOptions = {}
	private isReconnecting = false
	private hasReceivedOutput = false

	/**
	 * Starts the wrangler tail subprocess
	 */
	start(workerName: string, options: LogsOptions): void {
		this.workerName = workerName
		this.options = options
		this.isStopped = false
		this.reconnectAttempts = 0

		this.startProcess()
	}

	/**
	 * Internal method to start the subprocess
	 */
	private startProcess(): void {
		const args = this.buildArgs(this.workerName, this.options)
		this.hasReceivedOutput = false

		// Spawn wrangler tail
		this.process = spawn('npx', ['wrangler', 'tail', ...args], {
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: false,
		})

		// Handle stdout (log output)
		if (this.process.stdout) {
			this.readline = createInterface({
				input: this.process.stdout,
				crlfDelay: Infinity,
			})

			this.readline.on('line', (line: string) => {
				this.handleLine(line)
			})
		}

		// Handle stderr (status messages and errors)
		if (this.process.stderr) {
			const stderrReadline = createInterface({
				input: this.process.stderr,
				crlfDelay: Infinity,
			})

			stderrReadline.on('line', (line: string) => {
				this.handleOutput(line, 'status')
			})
		}

		// Handle process exit
		this.process.on('exit', (code: number | null) => {
			this.cleanup()

			// Attempt reconnection if not manually stopped and exit was unexpected
			if (!this.isStopped && code !== 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
				this.attemptReconnect()
			}
		})

		// Handle process errors
		this.process.on('error', (error: Error) => {
			this.emit('error', error)
			this.cleanup()
		})
	}

	/**
	 * Handles a line of output from wrangler stdout
	 */
	private handleLine(line: string): void {
		// Try to parse as JSON log entry
		const entry = tryParseLogLine(line)

		if (entry) {
			this.handleOutput(entry, 'log')
		} else {
			// Non-JSON output (status messages)
			this.handleOutput(line, 'status')
		}
	}

	/**
	 * Handles output and confirms reconnection on first output
	 */
	private handleOutput(data: unknown, eventType: 'log' | 'status'): void {
		// On first output after reconnection, confirm the reconnection succeeded
		if (this.isReconnecting && !this.hasReceivedOutput) {
			this.hasReceivedOutput = true
			this.isReconnecting = false
			this.reconnectAttempts = 0 // Reset attempts on successful reconnect
			this.reconnectDelay = 1000
			this.emit('reconnected')
		}

		this.emit(eventType, data)
	}

	/**
	 * Builds wrangler tail arguments from options
	 */
	private buildArgs(workerName: string, options: LogsOptions): string[] {
		const args = [workerName, '--format', 'json']

		// Filter options
		if (options.filter) {
			args.push('--search', options.filter)
		}
		if (options.status) {
			args.push('--status', options.status)
		}
		if (options.method) {
			args.push('--method', options.method)
		}
		if (options.ip) {
			args.push('--ip', options.ip)
		}

		// Environment
		if (options.env) {
			args.push('--env', options.env)
		}

		// Sampling rate
		if (options.samplingRate !== undefined) {
			args.push('--sampling-rate', String(options.samplingRate))
		}

		return args
	}

	/**
	 * Attempts to reconnect with exponential backoff
	 * First attempt is immediate (100ms for UI update), then exponential backoff kicks in
	 */
	private attemptReconnect(): void {
		this.reconnectAttempts++
		this.isReconnecting = true

		this.emit('reconnecting')

		// First attempt: immediate (100ms for UI to show "reconnecting" message)
		// Subsequent attempts: exponential backoff (1s, 2s, 4s, 8s, 16s)
		const delay =
			this.reconnectAttempts === 1
				? 100 // Immediate retry on first failure
				: this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 2)

		setTimeout(() => {
			if (!this.isStopped) {
				this.startProcess()
				// Note: 'reconnected' event is emitted in handleOutput() when first output is received
				// This ensures we only confirm reconnection after the process is actually working
			}
		}, delay)
	}

	/**
	 * Cleans up process and readline resources
	 */
	private cleanup(): void {
		if (this.readline) {
			this.readline.close()
			this.readline = null
		}

		if (this.process) {
			this.process.removeAllListeners()
			this.process = null
		}
	}

	/**
	 * Stops the bridge and kills the subprocess
	 */
	stop(): void {
		this.isStopped = true

		if (this.process) {
			this.process.kill('SIGTERM')
		}

		this.cleanup()
	}

}
