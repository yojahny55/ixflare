/**
 * @module commands/generate-env-types
 * @description Generate TypeScript types from .env.example
 * @node-only - CLI command using Node.js fs operations
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

/**
 * Parse .env.example file and extract variable information
 */
interface EnvVariable {
  key: string
  type: 'string' | 'number' | 'boolean'
  optional: boolean
  comment?: string
}

/**
 * Parse .env.example content and extract variable definitions
 *
 * @param content - Raw .env.example file content
 * @returns Array of environment variable definitions
 */
function parseEnvExample(content: string): EnvVariable[] {
  const variables = new Map<string, EnvVariable>()
  const lines = content.split('\n')
  let currentComment: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()

    // Capture comments
    if (trimmed.startsWith('#')) {
      const comment = trimmed.slice(1).trim()
      // Skip section headers and decorative lines
      if (!comment.startsWith('=') && !comment.startsWith('-')) {
        currentComment = comment
      }
      continue
    }

    // Skip empty lines
    if (!trimmed) {
      currentComment = undefined
      continue
    }

    // Parse KEY=value or KEY= or #KEY=
    const match = trimmed.match(/^(#)?\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$/)
    if (!match) {
      continue
    }

    const [, , key, value] = match

    // Infer type from value
    let type: 'string' | 'number' | 'boolean' = 'string'
    if (value.trim()) {
      const val = value.trim()
      if (val === 'true' || val === 'false') {
        type = 'boolean'
      } else if (!isNaN(Number(val)) && val !== '') {
        type = 'number'
      }
    }

    // All environment variables are optional in TypeScript (they might not be set at runtime)
    // Unless explicitly uncommented with a value, treat as optional
    const optional = true

    variables.set(key, {
      key,
      type,
      optional,
      comment: currentComment,
    })

    currentComment = undefined
  }

  return Array.from(variables.values())
}

/**
 * Generate TypeScript interface from environment variables
 *
 * @param variables - Array of environment variable definitions
 * @returns TypeScript interface definition as string
 */
function generateTypeScriptInterface(variables: EnvVariable[]): string {
  const lines: string[] = []

  lines.push('/**')
  lines.push(' * Environment variable types')
  lines.push(' * Generated from .env.example')
  lines.push(' *')
  lines.push(' * @see .env.example for descriptions and examples')
  lines.push(' */')
  lines.push('export interface Env {')

  for (const variable of variables) {
    if (variable.comment) {
      lines.push(`  /** ${variable.comment} */`)
    }

    const optionalMarker = variable.optional ? '?' : ''
    const typeStr = variable.type === 'string' ? 'string' : variable.type

    lines.push(`  ${variable.key}${optionalMarker}: ${typeStr}`)
  }

  // Add Cloudflare Workers bindings (commonly used)
  lines.push('')
  lines.push('  // Cloudflare Workers bindings')
  lines.push('  // Add your D1, KV, R2, and other bindings here')
  lines.push('  // Example:')
  lines.push('  // DB?: D1Database')
  lines.push('  // CACHE?: KVNamespace')
  lines.push('  // BUCKET?: R2Bucket')
  lines.push('')
  lines.push('  [key: string]: unknown')

  lines.push('}')

  return lines.join('\n')
}

/**
 * Generate TypeScript types from .env.example file
 *
 * @param projectRoot - Root directory of the project
 * @param options - Generation options
 * @returns Path to generated file
 */
export async function generateEnvTypes(
  projectRoot: string,
  options: {
    /** Path to .env.example file (relative to projectRoot) */
    envExamplePath?: string
    /** Output path for generated types (relative to projectRoot) */
    outputPath?: string
  } = {}
): Promise<string> {
  const envExamplePath = options.envExamplePath ?? '.env.example'
  const outputPath = options.outputPath ?? 'src/types/env.d.ts'

  const envExampleFile = join(projectRoot, envExamplePath)
  const outputFile = join(projectRoot, outputPath)

  // Check if .env.example exists
  if (!existsSync(envExampleFile)) {
    throw new Error(
      `.env.example not found at ${envExampleFile}\n\nCreate a .env.example file with documented environment variables.`
    )
  }

  // Read and parse .env.example
  const content = await readFile(envExampleFile, 'utf-8')
  const variables = parseEnvExample(content)

  if (variables.length === 0) {
    throw new Error(
      `No environment variables found in ${envExampleFile}\n\nAdd variables to .env.example (e.g., API_KEY=)`
    )
  }

  // Generate TypeScript interface
  const typeDefinition = generateTypeScriptInterface(variables)

  // Ensure output directory exists
  const outputDir = dirname(outputFile)
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  // Write to output file
  await writeFile(outputFile, typeDefinition, 'utf-8')

  return outputFile
}

/**
 * CLI handler for generate:env command
 *
 * @param args - Command arguments
 */
export async function generateEnvCommand(args: {
  cwd?: string
  envExample?: string
  output?: string
}): Promise<void> {
  const projectRoot = args.cwd ?? process.cwd()

  try {
    console.log('🔧 Generating environment types...')
    console.log('')

    const outputFile = await generateEnvTypes(projectRoot, {
      envExamplePath: args.envExample,
      outputPath: args.output,
    })

    console.log('✅ Environment types generated successfully')
    console.log(`📝 Output: ${outputFile}`)
    console.log('')
    console.log('Usage in route handlers:')
    console.log('```typescript')
    console.log("import type { Env } from '@/types/env'")
    console.log("import type { LoaderArgs } from 'ixflare'")
    console.log('')
    console.log('export async function loader({ env }: LoaderArgs<Env>) {')
    console.log('  const apiKey = env.API_KEY // TypeScript knows the type')
    console.log('}')
    console.log('```')
  } catch (error) {
    console.error('❌ Failed to generate environment types')
    console.error('')
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error(String(error))
    }
    process.exit(1)
  }
}
