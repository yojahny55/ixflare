/**
 * Tests for config resolution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveWorkerName, validateWorkerName } from '../../../src/commands/logs/config'
import { CLIError } from '../../../src/errors/cli-error'

describe('Config Resolution', () => {
	const testDir = join(process.cwd(), 'test-logs-config')

	beforeEach(() => {
		// Create test directory
		if (!existsSync(testDir)) {
			mkdirSync(testDir, { recursive: true })
		}
	})

	afterEach(() => {
		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true })
		}
	})

	describe('resolveWorkerName', () => {
		it('should resolve worker name from wrangler.toml', () => {
			const wranglerToml = `
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"
`
			writeFileSync(join(testDir, 'wrangler.toml'), wranglerToml)

			const result = resolveWorkerName(testDir)

			expect(result).toBe('my-worker')
		})

		it('should resolve worker name from package.json when wrangler.toml missing', () => {
			const packageJson = {
				name: 'package-worker',
				version: '1.0.0',
			}
			writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson))

			const result = resolveWorkerName(testDir)

			expect(result).toBe('package-worker')
		})

		it('should prefer wrangler.toml over package.json', () => {
			const wranglerToml = `name = "wrangler-worker"`
			writeFileSync(join(testDir, 'wrangler.toml'), wranglerToml)

			const packageJson = {
				name: 'package-worker',
			}
			writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson))

			const result = resolveWorkerName(testDir)

			expect(result).toBe('wrangler-worker')
		})

		it('should throw CLIError when no config files found', () => {
			expect(() => resolveWorkerName(testDir)).toThrow(CLIError)

			try {
				resolveWorkerName(testDir)
			} catch (error) {
				expect(error).toBeInstanceOf(CLIError)
				expect((error as CLIError).code).toBe('WORKER.NAME_NOT_FOUND')
			}
		})

		it('should throw CLIError when config files exist but no name', () => {
			const packageJson = {
				version: '1.0.0',
				// No name field
			}
			writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson))

			expect(() => resolveWorkerName(testDir)).toThrow(CLIError)
		})

		it('should handle malformed wrangler.toml gracefully', () => {
			const wranglerToml = `
# No name field
main = "src/index.ts"
`
			writeFileSync(join(testDir, 'wrangler.toml'), wranglerToml)

			const packageJson = {
				name: 'fallback-worker',
			}
			writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson))

			const result = resolveWorkerName(testDir)

			// Should fall back to package.json
			expect(result).toBe('fallback-worker')
		})

		it('should handle wrangler.toml with single quotes', () => {
			const wranglerToml = `name = 'single-quote-worker'`
			writeFileSync(join(testDir, 'wrangler.toml'), wranglerToml)

			const result = resolveWorkerName(testDir)

			// Should now correctly parse single-quoted names
			expect(result).toBe('single-quote-worker')
		})
	})

	describe('validateWorkerName', () => {
		it('should validate valid worker names', () => {
			expect(() => validateWorkerName('my-worker')).not.toThrow()
			expect(() => validateWorkerName('my_worker')).not.toThrow()
			expect(() => validateWorkerName('MyWorker')).not.toThrow()
			expect(() => validateWorkerName('worker123')).not.toThrow()
			expect(() => validateWorkerName('worker-123_abc')).not.toThrow()
		})

		it('should throw for empty worker name', () => {
			expect(() => validateWorkerName('')).toThrow(CLIError)

			try {
				validateWorkerName('')
			} catch (error) {
				expect(error).toBeInstanceOf(CLIError)
				expect((error as CLIError).code).toBe('WORKER.INVALID_NAME')
			}
		})

		it('should throw for non-string worker name', () => {
			expect(() => validateWorkerName(null as any)).toThrow(CLIError)
			expect(() => validateWorkerName(undefined as any)).toThrow(CLIError)
			expect(() => validateWorkerName(123 as any)).toThrow(CLIError)
		})

		it('should throw for worker names with invalid characters', () => {
			expect(() => validateWorkerName('my worker')).toThrow(CLIError)
			expect(() => validateWorkerName('my.worker')).toThrow(CLIError)
			expect(() => validateWorkerName('my@worker')).toThrow(CLIError)
			expect(() => validateWorkerName('my/worker')).toThrow(CLIError)
			expect(() => validateWorkerName('my\\worker')).toThrow(CLIError)
		})

		it('should throw for worker names with special characters', () => {
			expect(() => validateWorkerName('my#worker')).toThrow(CLIError)
			expect(() => validateWorkerName('my$worker')).toThrow(CLIError)
			expect(() => validateWorkerName('my%worker')).toThrow(CLIError)
			expect(() => validateWorkerName('my&worker')).toThrow(CLIError)
		})
	})
})
