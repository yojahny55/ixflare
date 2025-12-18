/**
 * Tests for log formatter
 */

import { describe, it, expect } from 'vitest'
import {
	formatLogEntry,
	formatTimestamp,
	formatStatus,
	formatLogEntryJson,
} from '../../../src/commands/logs/formatter'
import type { LogEntry } from '../../../src/commands/logs/types'

describe('Log Formatter', () => {
	describe('formatTimestamp', () => {
		it('should format Unix timestamp to HH:MM:SS', () => {
			// 2024-12-04 14:30:01 UTC = 1733322601000
			const result = formatTimestamp(1733322601000)

			// Result will be in local timezone, just verify format
			expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/)
		})

		it('should pad single digits with zeros', () => {
			// Create a timestamp that should have leading zeros
			const date = new Date('2024-01-01T01:05:09Z')
			const result = formatTimestamp(date.getTime())

			expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/)
		})
	})

	describe('formatStatus', () => {
		it('should format 2xx status codes (success)', () => {
			const result = formatStatus(200)

			// Should contain the status code
			expect(result).toContain('200')
		})

		it('should format 3xx status codes (redirect)', () => {
			const result = formatStatus(301)

			expect(result).toContain('301')
		})

		it('should format 4xx status codes (client error)', () => {
			const result = formatStatus(404)

			expect(result).toContain('404')
		})

		it('should format 5xx status codes (server error)', () => {
			const result = formatStatus(500)

			expect(result).toContain('500')
		})

		it('should handle 0 status code', () => {
			const result = formatStatus(0)

			expect(result).toContain('0')
		})
	})

	describe('formatLogEntry', () => {
		it('should format basic log entry with all fields', () => {
			const entry: LogEntry = {
				timestamp: 1733322601000,
				method: 'GET',
				path: '/api/users',
				status: 200,
				duration: 23,
				outcome: 'ok',
				logs: [],
				exceptions: [],
				scriptName: 'test-worker',
			}

			const result = formatLogEntry(entry)

			expect(result).toContain('GET')
			expect(result).toContain('/api/users')
			expect(result).toContain('200')
			expect(result).toContain('23ms')
		})

		it('should format log entry with console messages', () => {
			const entry: LogEntry = {
				timestamp: 1733322601000,
				method: 'POST',
				path: '/api/posts',
				status: 201,
				duration: 45,
				outcome: 'ok',
				logs: [
					{
						message: 'Processing request',
						level: 'log',
					},
					{
						message: 'User authenticated',
						level: 'info',
					},
				],
				exceptions: [],
				scriptName: 'test-worker',
			}

			const result = formatLogEntry(entry)

			expect(result).toContain('POST')
			expect(result).toContain('/api/posts')
			expect(result).toContain('Processing request')
			expect(result).toContain('User authenticated')
		})

		it('should format log entry with exceptions', () => {
			const entry: LogEntry = {
				timestamp: 1733322601000,
				method: 'GET',
				path: '/api/error',
				status: 500,
				duration: 10,
				outcome: 'error',
				logs: [],
				exceptions: [
					{
						name: 'ValidationError',
						message: 'Invalid input',
						stack: 'at handler.ts:10\nat worker.ts:20',
					},
				],
				scriptName: 'test-worker',
			}

			const result = formatLogEntry(entry)

			expect(result).toContain('GET')
			expect(result).toContain('/api/error')
			expect(result).toContain('ValidationError')
			expect(result).toContain('Invalid input')
			expect(result).toContain('handler.ts:10')
		})

		it('should format log entry with different log levels', () => {
			const entry: LogEntry = {
				timestamp: 1733322601000,
				method: 'POST',
				path: '/api/test',
				status: 200,
				duration: 15,
				outcome: 'ok',
				logs: [
					{ message: 'Debug info', level: 'debug' },
					{ message: 'Info message', level: 'info' },
					{ message: 'Warning message', level: 'warn' },
					{ message: 'Error message', level: 'error' },
				],
				exceptions: [],
				scriptName: 'test-worker',
			}

			const result = formatLogEntry(entry)

			expect(result).toContain('Debug info')
			expect(result).toContain('Info message')
			expect(result).toContain('Warning message')
			expect(result).toContain('Error message')
		})

		it('should handle log entry with zero duration', () => {
			const entry: LogEntry = {
				timestamp: 1733322601000,
				method: 'GET',
				path: '/api/fast',
				status: 200,
				duration: 0,
				outcome: 'ok',
				logs: [],
				exceptions: [],
				scriptName: 'test-worker',
			}

			const result = formatLogEntry(entry)

			expect(result).toContain('GET')
			expect(result).toContain('/api/fast')
			// Should not show (0ms)
			expect(result).not.toContain('0ms')
		})
	})

	describe('formatLogEntryJson', () => {
		it('should format log entry as JSON string', () => {
			const entry: LogEntry = {
				timestamp: 1733322601000,
				method: 'GET',
				path: '/api/users',
				status: 200,
				duration: 23,
				outcome: 'ok',
				logs: [{ message: 'Test log', level: 'log' }],
				exceptions: [],
				scriptName: 'test-worker',
			}

			const result = formatLogEntryJson(entry)

			expect(result).toBe(JSON.stringify(entry))

			// Verify it's valid JSON
			const parsed = JSON.parse(result)
			expect(parsed).toEqual(entry)
		})

		it('should preserve all log entry fields in JSON', () => {
			const entry: LogEntry = {
				timestamp: 1733322601000,
				method: 'POST',
				path: '/api/posts',
				status: 201,
				duration: 45,
				outcome: 'ok',
				logs: [
					{ message: 'Log 1', level: 'info' },
					{ message: 'Log 2', level: 'warn' },
				],
				exceptions: [
					{
						name: 'TestError',
						message: 'Test exception',
						stack: 'at test.ts:1',
					},
				],
				scriptName: 'my-worker',
			}

			const result = formatLogEntryJson(entry)
			const parsed = JSON.parse(result)

			expect(parsed.timestamp).toBe(1733322601000)
			expect(parsed.method).toBe('POST')
			expect(parsed.path).toBe('/api/posts')
			expect(parsed.status).toBe(201)
			expect(parsed.duration).toBe(45)
			expect(parsed.outcome).toBe('ok')
			expect(parsed.logs).toHaveLength(2)
			expect(parsed.exceptions).toHaveLength(1)
			expect(parsed.scriptName).toBe('my-worker')
		})
	})
})
