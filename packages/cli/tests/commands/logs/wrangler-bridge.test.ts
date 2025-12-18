/**
 * Tests for WranglerTailBridge subprocess management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess } from 'node:child_process'

// Mock child_process before importing the module
vi.mock('node:child_process', () => ({
	spawn: vi.fn(),
}))

import { spawn } from 'node:child_process'
import { WranglerTailBridge } from '../../../src/commands/logs/wrangler-bridge'
import type { LogsOptions } from '../../../src/commands/logs/types'

/**
 * Creates a mock child process with PassThrough streams
 */
function createMockProcess(): {
	process: Partial<ChildProcess>
	stdout: PassThrough
	stderr: PassThrough
	processEmitter: EventEmitter
} {
	const stdout = new PassThrough()
	const stderr = new PassThrough()
	const processEmitter = new EventEmitter()

	const mockProcess: Partial<ChildProcess> = {
		stdout: stdout as any,
		stderr: stderr as any,
		on: processEmitter.on.bind(processEmitter) as any,
		removeAllListeners: vi.fn(() => mockProcess as ChildProcess),
		kill: vi.fn(),
	}

	return { process: mockProcess, stdout, stderr, processEmitter }
}

describe('WranglerTailBridge', () => {
	let bridge: WranglerTailBridge
	let mockSpawn: ReturnType<typeof vi.fn>

	beforeEach(() => {
		bridge = new WranglerTailBridge()
		mockSpawn = vi.mocked(spawn)
		mockSpawn.mockReset()
	})

	afterEach(() => {
		bridge.stop()
		vi.clearAllTimers()
	})

	describe('start', () => {
		it('should spawn wrangler tail process with correct arguments', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			bridge.start('my-worker', {})

			expect(mockSpawn).toHaveBeenCalledWith(
				'npx',
				['wrangler', 'tail', 'my-worker', '--format', 'json'],
				expect.objectContaining({
					stdio: ['ignore', 'pipe', 'pipe'],
					shell: false,
				})
			)
		})

		it('should include filter option as --search', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const options: LogsOptions = { filter: 'error' }
			bridge.start('my-worker', options)

			expect(mockSpawn).toHaveBeenCalledWith(
				'npx',
				expect.arrayContaining(['--search', 'error']),
				expect.any(Object)
			)
		})

		it('should include status filter', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const options: LogsOptions = { status: 'error' }
			bridge.start('my-worker', options)

			expect(mockSpawn).toHaveBeenCalledWith(
				'npx',
				expect.arrayContaining(['--status', 'error']),
				expect.any(Object)
			)
		})

		it('should include method filter', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const options: LogsOptions = { method: 'POST' }
			bridge.start('my-worker', options)

			expect(mockSpawn).toHaveBeenCalledWith(
				'npx',
				expect.arrayContaining(['--method', 'POST']),
				expect.any(Object)
			)
		})

		it('should include ip filter', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const options: LogsOptions = { ip: 'self' }
			bridge.start('my-worker', options)

			expect(mockSpawn).toHaveBeenCalledWith(
				'npx',
				expect.arrayContaining(['--ip', 'self']),
				expect.any(Object)
			)
		})

		it('should include environment option', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const options: LogsOptions = { env: 'staging' }
			bridge.start('my-worker', options)

			expect(mockSpawn).toHaveBeenCalledWith(
				'npx',
				expect.arrayContaining(['--env', 'staging']),
				expect.any(Object)
			)
		})

		it('should include sampling rate', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const options: LogsOptions = { samplingRate: 10 }
			bridge.start('my-worker', options)

			expect(mockSpawn).toHaveBeenCalledWith(
				'npx',
				expect.arrayContaining(['--sampling-rate', '10']),
				expect.any(Object)
			)
		})

		it('should include multiple options together', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const options: LogsOptions = {
				filter: 'test',
				status: 'ok',
				method: 'GET',
				env: 'production',
				samplingRate: 50,
			}
			bridge.start('my-worker', options)

			const callArgs = mockSpawn.mock.calls[0][1] as string[]
			expect(callArgs).toContain('--search')
			expect(callArgs).toContain('test')
			expect(callArgs).toContain('--status')
			expect(callArgs).toContain('ok')
			expect(callArgs).toContain('--method')
			expect(callArgs).toContain('GET')
			expect(callArgs).toContain('--env')
			expect(callArgs).toContain('production')
			expect(callArgs).toContain('--sampling-rate')
			expect(callArgs).toContain('50')
		})
	})

	describe('event emission', () => {
		it('should emit log event for valid JSON log lines', async () => {
			const { process, stdout } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const logHandler = vi.fn()
			bridge.on('log', logHandler)
			bridge.start('my-worker', {})

			// Simulate wrangler JSON output
			const logLine = JSON.stringify({
				outcome: 'ok',
				scriptName: 'my-worker',
				exceptions: [],
				logs: [],
				eventTimestamp: 1733322601000,
				event: {
					request: {
						url: 'https://test.workers.dev/api/test',
						method: 'GET',
					},
				},
			})

			stdout.write(logLine + '\n')

			// Give readline time to process
			await new Promise((resolve) => setTimeout(resolve, 20))

			expect(logHandler).toHaveBeenCalled()
			const entry = logHandler.mock.calls[0][0]
			expect(entry.method).toBe('GET')
			expect(entry.path).toBe('/api/test')
			expect(entry.outcome).toBe('ok')
		})

		it('should emit status event for non-JSON lines', async () => {
			const { process, stdout } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const statusHandler = vi.fn()
			bridge.on('status', statusHandler)
			bridge.start('my-worker', {})

			stdout.write('Connected to worker...\n')

			await new Promise((resolve) => setTimeout(resolve, 20))

			expect(statusHandler).toHaveBeenCalledWith('Connected to worker...')
		})

		it('should emit status event for stderr output', async () => {
			const { process, stderr } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const statusHandler = vi.fn()
			bridge.on('status', statusHandler)
			bridge.start('my-worker', {})

			stderr.write('Waiting for logs...\n')

			await new Promise((resolve) => setTimeout(resolve, 20))

			expect(statusHandler).toHaveBeenCalledWith('Waiting for logs...')
		})

		it('should emit error event on process error', () => {
			const { process, processEmitter } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const errorHandler = vi.fn()
			bridge.on('error', errorHandler)
			bridge.start('my-worker', {})

			const testError = new Error('ENOENT: wrangler not found')
			processEmitter.emit('error', testError)

			expect(errorHandler).toHaveBeenCalledWith(testError)
		})
	})

	describe('stop', () => {
		it('should kill the subprocess with SIGTERM', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			bridge.start('my-worker', {})
			bridge.stop()

			expect(process.kill).toHaveBeenCalledWith('SIGTERM')
		})

		it('should prevent reconnection attempts after stop', () => {
			vi.useFakeTimers()
			const { process, processEmitter } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			bridge.start('my-worker', {})
			bridge.stop()

			// Simulate unexpected exit
			processEmitter.emit('exit', 1)

			// Advance timers - should not attempt reconnect
			vi.advanceTimersByTime(10000)

			// spawn should only have been called once (initial start)
			expect(mockSpawn).toHaveBeenCalledTimes(1)

			vi.useRealTimers()
		})

		it('should clean up readline and process references', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			bridge.start('my-worker', {})
			bridge.stop()

			expect(process.removeAllListeners).toHaveBeenCalled()
		})
	})

	describe('reconnection', () => {
		it('should emit reconnecting event on unexpected exit', () => {
			vi.useFakeTimers()
			const { process, processEmitter } = createMockProcess()
			const { process: process2 } = createMockProcess()
			mockSpawn.mockReturnValueOnce(process as ChildProcess).mockReturnValueOnce(process2 as ChildProcess)

			const reconnectingHandler = vi.fn()
			bridge.on('reconnecting', reconnectingHandler)
			bridge.start('my-worker', {})

			// Simulate unexpected exit
			processEmitter.emit('exit', 1)

			expect(reconnectingHandler).toHaveBeenCalled()

			vi.useRealTimers()
		})

		it('should not reconnect on clean exit (code 0)', () => {
			vi.useFakeTimers()
			const { process, processEmitter } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const reconnectingHandler = vi.fn()
			bridge.on('reconnecting', reconnectingHandler)
			bridge.start('my-worker', {})

			// Simulate clean exit
			processEmitter.emit('exit', 0)

			expect(reconnectingHandler).not.toHaveBeenCalled()

			vi.useRealTimers()
		})

		it('should limit reconnection attempts to max (5)', () => {
			vi.useFakeTimers()

			// Create mock processes for each attempt
			const mocks = Array.from({ length: 6 }, () => createMockProcess())
			mocks.forEach((m) => {
				mockSpawn.mockReturnValueOnce(m.process as ChildProcess)
			})

			bridge.start('my-worker', {})

			// Simulate 5 failed exits
			for (let i = 0; i < 5; i++) {
				mocks[i].processEmitter.emit('exit', 1)
				vi.advanceTimersByTime(60000) // Advance past backoff
			}

			// 6th exit should not trigger reconnect
			mocks[5].processEmitter.emit('exit', 1)
			vi.advanceTimersByTime(60000)

			// Should be 6 spawns total (1 initial + 5 reconnects, not 7)
			expect(mockSpawn).toHaveBeenCalledTimes(6)

			vi.useRealTimers()
		})

		it('should use exponential backoff for reconnection delays', () => {
			vi.useFakeTimers()

			const mocks = Array.from({ length: 3 }, () => createMockProcess())
			mocks.forEach((m) => {
				mockSpawn.mockReturnValueOnce(m.process as ChildProcess)
			})

			bridge.start('my-worker', {})

			// First exit - should reconnect after 1s (1000 * 2^0)
			mocks[0].processEmitter.emit('exit', 1)
			expect(mockSpawn).toHaveBeenCalledTimes(1)

			vi.advanceTimersByTime(999)
			expect(mockSpawn).toHaveBeenCalledTimes(1)

			vi.advanceTimersByTime(1)
			expect(mockSpawn).toHaveBeenCalledTimes(2)

			// Second exit - should reconnect after 2s (1000 * 2^1)
			mocks[1].processEmitter.emit('exit', 1)
			vi.advanceTimersByTime(1999)
			expect(mockSpawn).toHaveBeenCalledTimes(2)

			vi.advanceTimersByTime(1)
			expect(mockSpawn).toHaveBeenCalledTimes(3)

			vi.useRealTimers()
		})

		it('should emit reconnected event only after receiving output', async () => {
			vi.useFakeTimers()

			const { process, processEmitter, stdout } = createMockProcess()
			const { process: process2, stdout: stdout2 } = createMockProcess()
			mockSpawn.mockReturnValueOnce(process as ChildProcess).mockReturnValueOnce(process2 as ChildProcess)

			const reconnectedHandler = vi.fn()
			bridge.on('reconnected', reconnectedHandler)
			bridge.start('my-worker', {})

			// Simulate exit and reconnection attempt
			processEmitter.emit('exit', 1)
			vi.advanceTimersByTime(1000)

			// reconnected should NOT be emitted yet (no output received)
			expect(reconnectedHandler).not.toHaveBeenCalled()

			vi.useRealTimers()

			// Simulate first output from reconnected process
			stdout2.write('Connection established\n')

			await new Promise((resolve) => setTimeout(resolve, 20))

			// NOW reconnected should be emitted
			expect(reconnectedHandler).toHaveBeenCalled()
		})

		it('should reset reconnect attempts after successful reconnection', async () => {
			vi.useFakeTimers()

			const mocks = Array.from({ length: 10 }, () => createMockProcess())
			mocks.forEach((m) => {
				mockSpawn.mockReturnValueOnce(m.process as ChildProcess)
			})

			bridge.start('my-worker', {})

			// First disconnect
			mocks[0].processEmitter.emit('exit', 1)
			vi.advanceTimersByTime(1000)

			vi.useRealTimers()

			// Simulate successful reconnection (output received)
			mocks[1].stdout.write('Connected\n')
			await new Promise((resolve) => setTimeout(resolve, 20))

			vi.useFakeTimers()

			// Second disconnect - should start over from attempt 1
			mocks[1].processEmitter.emit('exit', 1)

			// Should use 1 second delay again (reset to 1000ms)
			vi.advanceTimersByTime(999)
			expect(mockSpawn).toHaveBeenCalledTimes(2)

			vi.advanceTimersByTime(1)
			expect(mockSpawn).toHaveBeenCalledTimes(3)

			vi.useRealTimers()
		})
	})

	describe('argument building', () => {
		it('should not include undefined options', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			const options: LogsOptions = {
				filter: undefined,
				status: undefined,
				method: undefined,
			}
			bridge.start('my-worker', options)

			const callArgs = mockSpawn.mock.calls[0][1] as string[]
			expect(callArgs).not.toContain('--search')
			expect(callArgs).not.toContain('--status')
			expect(callArgs).not.toContain('--method')
		})

		it('should always include --format json', () => {
			const { process } = createMockProcess()
			mockSpawn.mockReturnValue(process as ChildProcess)

			bridge.start('my-worker', {})

			const callArgs = mockSpawn.mock.calls[0][1] as string[]
			expect(callArgs).toContain('--format')
			expect(callArgs).toContain('json')
		})
	})
})
