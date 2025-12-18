/**
 * Worker configuration resolution for logs command
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { CLIError } from '@/errors/cli-error'

/**
 * Resolves worker name from project configuration
 * Priority: wrangler.toml > package.json > error
 */
export function resolveWorkerName(cwd: string = process.cwd()): string {
	// 1. Check wrangler.toml
	const wranglerPath = join(cwd, 'wrangler.toml')
	if (existsSync(wranglerPath)) {
		try {
			const content = readFileSync(wranglerPath, 'utf-8')
			// Support both double and single quoted names in TOML
			const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/)
			if (nameMatch && nameMatch[1]) {
				return nameMatch[1]
			}
		} catch {
			// Ignore read errors, continue to next option
		}
	}

	// 2. Check package.json
	const packagePath = join(cwd, 'package.json')
	if (existsSync(packagePath)) {
		try {
			const content = readFileSync(packagePath, 'utf-8')
			const pkg = JSON.parse(content) as { name?: string }
			if (pkg.name) {
				return pkg.name
			}
		} catch {
			// Ignore parse errors, continue to error
		}
	}

	// 3. Error - cannot determine worker name
	throw new CLIError({
		code: 'WORKER.NAME_NOT_FOUND',
		message: 'Could not determine worker name from wrangler.toml or package.json.',
		fixes: ['Add name to wrangler.toml', 'Use --worker flag to specify worker name explicitly'],
		causes: ['No wrangler.toml file with name field', 'No package.json file with name field'],
	})
}

/**
 * Validates worker name format (basic alphanumeric with dashes/underscores)
 */
export function validateWorkerName(name: string): void {
	if (!name || typeof name !== 'string') {
		throw new CLIError({
			code: 'WORKER.INVALID_NAME',
			message: 'Worker name must be a non-empty string',
			fixes: ['Provide a valid worker name'],
		})
	}

	// Cloudflare worker names: alphanumeric, dashes, underscores
	const validNamePattern = /^[a-z0-9_-]+$/i
	if (!validNamePattern.test(name)) {
		throw new CLIError({
			code: 'WORKER.INVALID_NAME',
			message: `Invalid worker name "${name}". Must contain only letters, numbers, dashes, and underscores.`,
			fixes: ['Use only alphanumeric characters, dashes, and underscores in worker name'],
			causes: ['Worker name contains invalid characters'],
		})
	}
}
