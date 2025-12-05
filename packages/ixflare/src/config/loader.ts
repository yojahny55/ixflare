/**
 * @module config/loader
 * @description Runtime configuration loader with environment precedence
 * @node-only - Uses fs, path for env file loading (build time only)
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IxflareConfig, EnvConfig } from './schema'
import { configSchema } from './schema'
import { applyDefaults } from './defaults'
import { createConfigError, ConfigError } from './errors'

/**
 * Environment file load result
 */
interface EnvLoadResult {
  /** Parsed environment variables */
  vars: EnvConfig
  /** Path to the loaded file (if found) */
  path?: string
}

/**
 * Parse a .env file content into key-value pairs
 * Supports basic .env format: KEY=value, comments (#), and empty lines
 *
 * @param content - Raw file content
 * @returns Parsed environment variables
 */
function parseEnvFile(content: string): EnvConfig {
  const vars: EnvConfig = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, equalIndex).trim()
    let value: string | number | boolean = trimmed.slice(equalIndex + 1).trim()

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    // Try to parse as number or boolean
    if (value === 'true') {
      vars[key] = true
    } else if (value === 'false') {
      vars[key] = false
    } else if (!isNaN(Number(value)) && value !== '') {
      vars[key] = Number(value)
    } else {
      vars[key] = value
    }
  }

  return vars
}

/**
 * Parse wrangler.toml [vars] section
 * Basic TOML parser for the [vars] section only
 *
 * @param content - Raw wrangler.toml content
 * @returns Parsed environment variables from [vars] section
 */
function parseWranglerVars(content: string): EnvConfig {
  const vars: EnvConfig = {}
  let inVarsSection = false

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    // Check for section headers
    if (trimmed.startsWith('[')) {
      inVarsSection = trimmed === '[vars]'
      continue
    }

    // Only process lines in [vars] section
    if (!inVarsSection) {
      continue
    }

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, equalIndex).trim()
    let value: string | number | boolean = trimmed.slice(equalIndex + 1).trim()

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    // Parse value types
    if (value === 'true') {
      vars[key] = true
    } else if (value === 'false') {
      vars[key] = false
    } else if (!isNaN(Number(value)) && value !== '') {
      vars[key] = Number(value)
    } else {
      vars[key] = value
    }
  }

  return vars
}

/**
 * Load environment variables from a file
 *
 * @param filePath - Path to the env file
 * @returns Parsed variables or empty object if file doesn't exist
 */
async function loadEnvFile(filePath: string): Promise<EnvLoadResult> {
  if (!existsSync(filePath)) {
    return { vars: {} }
  }

  try {
    const content = await readFile(filePath, 'utf-8')
    return {
      vars: parseEnvFile(content),
      path: filePath,
    }
  } catch {
    return { vars: {} }
  }
}

/**
 * Load environment variables from wrangler.toml [vars] section
 *
 * @param filePath - Path to wrangler.toml
 * @returns Parsed variables or empty object if file doesn't exist
 */
async function loadWranglerVars(filePath: string): Promise<EnvLoadResult> {
  if (!existsSync(filePath)) {
    return { vars: {} }
  }

  try {
    const content = await readFile(filePath, 'utf-8')
    return {
      vars: parseWranglerVars(content),
      path: filePath,
    }
  } catch {
    return { vars: {} }
  }
}

/**
 * Detect current environment (development or production)
 *
 * @returns 'production' if NODE_ENV is production, otherwise 'development'
 */
function detectEnvironment(): 'development' | 'production' {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

/**
 * Load configuration from edge.config.ts with environment variable precedence
 *
 * Environment variables are merged with the following precedence (highest to lowest):
 * 1. wrangler.toml [vars] section (highest priority)
 * 2. .dev.vars (development only - Cloudflare Workers local secrets, gitignored)
 * 3. .env.production (production environment only)
 * 4. .env.local (local overrides, typically gitignored)
 * 5. .env (default values, typically committed)
 *
 * @example
 * ```typescript
 * import { loadConfig } from 'ixflare/config'
 *
 * const config = await loadConfig(process.cwd())
 * console.log(config.name) // 'my-app'
 * console.log(config.env?.API_KEY) // From merged env files
 * ```
 *
 * @param projectRoot - Root directory of the project
 * @param options - Optional configuration options
 * @returns Loaded and validated configuration with environment variables merged
 * @throws {ConfigError} When configuration file is not found or validation fails
 */
export async function loadConfig(
  projectRoot: string,
  options: {
    /** Override detected environment */
    environment?: 'development' | 'production'
    /** Custom config file path (relative to projectRoot) */
    configPath?: string
  } = {}
): Promise<IxflareConfig> {
  const resolvedRoot = resolve(projectRoot)
  const configPath = options.configPath ?? 'edge.config.ts'
  const configFilePath = join(resolvedRoot, configPath)

  // Check if config file exists
  if (!existsSync(configFilePath)) {
    throw new ConfigError(
      `Configuration file not found: ${configFilePath}\n\nCreate an edge.config.ts file in your project root with:\n\nimport { defineConfig } from 'ixflare'\n\nexport default defineConfig({\n  name: 'my-app',\n})`,
      [],
      configFilePath
    )
  }

  // Detect environment
  const environment = options.environment ?? detectEnvironment()

  // Load environment files with precedence (lowest to highest)
  // 1. .env (base defaults)
  const baseEnv = await loadEnvFile(join(resolvedRoot, '.env'))

  // 2. .env.local (local overrides)
  const localEnv = await loadEnvFile(join(resolvedRoot, '.env.local'))

  // 3. .env.production (production only)
  const prodEnv =
    environment === 'production'
      ? await loadEnvFile(join(resolvedRoot, '.env.production'))
      : { vars: {} }

  // 4. .dev.vars (development only - Cloudflare Workers local secrets)
  const devVars =
    environment === 'development'
      ? await loadEnvFile(join(resolvedRoot, '.dev.vars'))
      : { vars: {} }

  // 5. wrangler.toml [vars] (highest priority)
  const wranglerVars = await loadWranglerVars(join(resolvedRoot, 'wrangler.toml'))

  // Merge environment variables (later overrides earlier)
  const mergedEnv: EnvConfig = {
    ...baseEnv.vars,
    ...localEnv.vars,
    ...prodEnv.vars,
    ...devVars.vars,
    ...wranglerVars.vars,
  }

  // Import the config module
  let configModule: { default?: unknown }
  try {
    const configUrl = pathToFileURL(configFilePath).href
    configModule = await import(configUrl)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new ConfigError(
      `Failed to load configuration from ${configFilePath}:\n\n${errorMessage}`,
      [],
      configFilePath
    )
  }

  // Get the default export
  const rawConfig = configModule.default
  if (!rawConfig || typeof rawConfig !== 'object') {
    throw new ConfigError(
      `Configuration file must export a default config object.\n\nExample:\nimport { defineConfig } from 'ixflare'\n\nexport default defineConfig({\n  name: 'my-app',\n})`,
      [],
      configFilePath
    )
  }

  // Merge environment variables into config
  const rawEnv = (rawConfig as Record<string, unknown>).env
  const configWithEnv = {
    ...rawConfig,
    env: {
      ...(rawEnv && typeof rawEnv === 'object' ? rawEnv : {}),
      ...mergedEnv,
    },
  }

  // Validate configuration
  const result = configSchema.safeParse(configWithEnv)
  if (!result.success) {
    throw createConfigError(result.error, configFilePath)
  }

  // Apply defaults
  return applyDefaults(result.data)
}

/**
 * Load environment variables only (without config file)
 * Useful for accessing env vars before config is fully loaded
 *
 * @param projectRoot - Root directory of the project
 * @param environment - Environment to load for
 * @returns Merged environment variables
 */
export async function loadEnv(
  projectRoot: string,
  environment?: 'development' | 'production'
): Promise<EnvConfig> {
  const resolvedRoot = resolve(projectRoot)
  const env = environment ?? detectEnvironment()

  const baseEnv = await loadEnvFile(join(resolvedRoot, '.env'))
  const localEnv = await loadEnvFile(join(resolvedRoot, '.env.local'))
  const prodEnv =
    env === 'production'
      ? await loadEnvFile(join(resolvedRoot, '.env.production'))
      : { vars: {} }
  const devVars =
    env === 'development'
      ? await loadEnvFile(join(resolvedRoot, '.dev.vars'))
      : { vars: {} }
  const wranglerVars = await loadWranglerVars(join(resolvedRoot, 'wrangler.toml'))

  return {
    ...baseEnv.vars,
    ...localEnv.vars,
    ...prodEnv.vars,
    ...devVars.vars,
    ...wranglerVars.vars,
  }
}
