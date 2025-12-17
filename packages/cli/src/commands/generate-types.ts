/**
 * @module commands/generate-types
 * @description Generate TypeScript types for routes, models, and environment
 * @node-only - CLI command using Node.js fs operations and TypeScript Compiler API
 */

import { readdir, writeFile, mkdir } from 'node:fs/promises'
import { existsSync, watch, type FSWatcher } from 'node:fs'
import { join, dirname, relative, extname, resolve, isAbsolute } from 'node:path'

export interface GenerateTypesOptions {
  watch?: boolean
  output?: string
  yes?: boolean
  help?: boolean
}

interface RouteParam {
  name: string
  optional: boolean
  catchAll: boolean
}

/**
 * Parse generate:types command CLI arguments
 * Follows same pattern as dev.ts, preview.ts, and deploy.ts
 */
export function parseGenerateTypesArgs(args: string[]): GenerateTypesOptions {
  const options: GenerateTypesOptions = {
    watch: false,
    output: undefined,
    yes: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--watch' || arg === '-w') {
      options.watch = true
    } else if ((arg === '--output' || arg === '-o') && i + 1 < args.length) {
      const nextArg = args[i + 1]
      // Reject flags as output values to prevent user errors like --output --watch
      if (nextArg.startsWith('-')) {
        // Skip - leave output undefined, don't consume the flag
        continue
      }
      options.output = nextArg
      i++ // Skip next since consumed
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true
    }
  }

  return options
}

/**
 * Display help information for generate:types command
 */
export function showGenerateTypesHelp(): void {
  console.log(`
Usage: ix generate:types [options]

Generate TypeScript type definitions for routes and models.

Options:
  -w, --watch          Watch mode - regenerate types on file changes
  -o, --output <dir>   Custom output directory (default: src/types/)
  -y, --yes            Skip confirmation prompts (for CI/automation)
  -h, --help           Show this help message

Examples:
  ix generate:types                    Generate types to src/types/
  ix generate:types --watch            Watch mode with auto-regeneration
  ix generate:types -o types/          Output to custom directory
  ix generate:types --yes              Skip prompts (CI mode)

Generated Files:
  src/types/routes.d.ts   Route parameter types from src/routes/
  src/types/models.d.ts   Model types from EdgeRecord definitions
`)
}

/**
 * Validate that output path is within project root (prevent path traversal)
 * @throws Error if path escapes project root
 */
export function validateOutputPath(projectRoot: string, outputDir: string): string {
  const resolved = resolve(projectRoot, outputDir)
  const rel = relative(projectRoot, resolved)

  // Check for path traversal attempts
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(
      `Output path must be within project root.\n` +
      `  Provided: ${outputDir}\n` +
      `  Resolved: ${resolved}\n` +
      `  Project root: ${projectRoot}`
    )
  }

  return resolved
}

/**
 * Extract dynamic route parameters from file path
 * Supports:
 * - [param] -> { param: string }
 * - [[optional]] -> { optional?: string }
 * - [...catchAll] -> { catchAll: string[] }
 * - [[...optionalCatchAll]] -> { optionalCatchAll?: string[] }
 */
export function extractRouteParams(filePath: string): RouteParam[] {
  const params: RouteParam[] = []

  // Match patterns like [param], [[optional]], [...catchAll], [[...catchAll]]
  const segments = filePath.match(/\[{1,2}[^\]]+\]{1,2}/g) || []

  for (const segment of segments) {
    const isOptional = segment.startsWith('[[') && segment.endsWith(']]')
    const isCatchAll = segment.includes('...')

    // Remove brackets and dots to get param name
    const paramName = segment.replace(/[[\].]/g, '')

    params.push({
      name: paramName,
      optional: isOptional,
      catchAll: isCatchAll,
    })
  }

  return params
}

/**
 * Generate TypeScript type definition for route parameters
 */
export function generateRouteParamsType(params: RouteParam[]): string {
  if (params.length === 0) {
    return ''
  }

  const fields = params.map((param) => {
    const optionalMarker = param.optional ? '?' : ''
    const type = param.catchAll ? 'string[]' : 'string'
    return `  ${param.name}${optionalMarker}: ${type}`
  })

  return `export interface Params {\n${fields.join('\n')}\n}`
}

/**
 * Recursively find all route files in a directory
 */
async function findRouteFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = []

  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      // Recursively search subdirectories
      const subFiles = await findRouteFiles(fullPath, baseDir)
      files.push(...subFiles)
    } else if (entry.isFile()) {
      // Include .ts and .tsx files, exclude test files and private files
      const ext = extname(entry.name)
      const isRouteFile = (ext === '.ts' || ext === '.tsx') &&
        !entry.name.includes('.test.') &&
        !entry.name.startsWith('_')

      if (isRouteFile) {
        // Return relative path from baseDir
        const relativePath = relative(baseDir, fullPath)
        files.push(relativePath)
      }
    }
  }

  return files
}

/**
 * Generate route type declarations for all routes
 */
export async function generateRouteTypes(
  projectRoot: string,
  outputDir?: string
): Promise<string> {
  const routesDir = join(projectRoot, 'src', 'routes')

  // Validate and resolve output path (prevent path traversal)
  let outputPath: string
  if (outputDir) {
    validateOutputPath(projectRoot, outputDir)
    outputPath = join(projectRoot, outputDir, 'routes.d.ts')
  } else {
    outputPath = join(projectRoot, 'src', 'types', 'routes.d.ts')
  }

  // Check if routes directory exists
  if (!existsSync(routesDir)) {
    throw new Error(
      `Routes directory not found: ${routesDir}\n\n` +
      `To fix this, create the routes directory:\n` +
      `  mkdir -p src/routes`
    )
  }

  // Find all route files
  const routeFiles = await findRouteFiles(routesDir)

  if (routeFiles.length === 0) {
    throw new Error(
      `No route files found in: ${routesDir}\n\n` +
      `Add .ts or .tsx route files to generate types.`
    )
  }

  // Generate type declarations for each route
  const declarations: string[] = [
    '/**',
    ' * Route type definitions',
    ' * Generated from src/routes/',
    ' *',
    ' * @see src/routes/ for route implementations',
    ' */',
    '',
  ]

  for (const routeFile of routeFiles) {
    const params = extractRouteParams(routeFile)

    if (params.length > 0) {
      // Normalize path separators for module path
      const modulePath = routeFile.replace(/\.(ts|tsx)$/, '').replace(/\\/g, '/')
      const paramsType = generateRouteParamsType(params)

      declarations.push(`// Generated from src/routes/${modulePath}`)
      declarations.push(`declare module '@/routes/${modulePath}' {`)
      // Properly indent interface content (each line gets 2 spaces)
      const indentedParams = paramsType
        .split('\n')
        .map((line) => (line ? `  ${line}` : line))
        .join('\n')
      declarations.push(indentedParams)
      declarations.push('}')
      declarations.push('')
    }
  }

  // Ensure output directory exists
  const outputDirPath = dirname(outputPath)
  if (!existsSync(outputDirPath)) {
    await mkdir(outputDirPath, { recursive: true })
  }

  // Write to output file
  const content = declarations.join('\n')
  await writeFile(outputPath, content, 'utf-8')

  return outputPath
}

/**
 * Generate model type declarations (placeholder for AC3)
 */
export async function generateModelTypes(
  projectRoot: string,
  outputDir?: string
): Promise<string> {
  // Validate and resolve output path (prevent path traversal)
  let outputPath: string
  if (outputDir) {
    validateOutputPath(projectRoot, outputDir)
    outputPath = join(projectRoot, outputDir, 'models.d.ts')
  } else {
    outputPath = join(projectRoot, 'src', 'types', 'models.d.ts')
  }

  // Placeholder implementation
  const content = [
    '/**',
    ' * Model type definitions',
    ' * Generated from EdgeRecord models',
    ' *',
    ' * @see src/models/ for model definitions',
    ' */',
    '',
    '// Model types will be generated here',
    '',
  ].join('\n')

  // Ensure output directory exists
  const outputDirPath = dirname(outputPath)
  if (!existsSync(outputDirPath)) {
    await mkdir(outputDirPath, { recursive: true })
  }

  await writeFile(outputPath, content, 'utf-8')

  return outputPath
}

/**
 * Run type generation (used by both one-time and watch mode)
 */
async function runTypeGeneration(
  projectRoot: string,
  outputDir?: string
): Promise<void> {
  // Generate route types
  const routeTypesPath = await generateRouteTypes(projectRoot, outputDir)
  console.log('✅ Route types generated')
  console.log(`📝 Output: ${routeTypesPath}`)
  console.log('')

  // Generate model types
  const modelTypesPath = await generateModelTypes(projectRoot, outputDir)
  console.log('✅ Model types generated')
  console.log(`📝 Output: ${modelTypesPath}`)
  console.log('')
}

/**
 * Prompt user for confirmation (unless --yes flag is set)
 */
async function confirmGeneration(options: GenerateTypesOptions): Promise<boolean> {
  if (options.yes) {
    return true
  }

  // In non-interactive environments (CI), default to yes
  if (!process.stdin.isTTY) {
    return true
  }

  const readline = await import('node:readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question('Generate TypeScript types? [Y/n] ', (answer) => {
      rl.close()
      const normalizedAnswer = answer.trim().toLowerCase()
      resolve(normalizedAnswer === '' || normalizedAnswer === 'y' || normalizedAnswer === 'yes')
    })
  })
}

/**
 * Main type generation function
 */
export async function generateTypes(options: GenerateTypesOptions = {}): Promise<void> {
  // Wire CLI args to function (Story 6-2 blocker fix)
  const cliOptions = parseGenerateTypesArgs(process.argv.slice(3))
  const mergedOptions = { ...options, ...cliOptions }

  // Handle --help flag (AC5 requirement)
  if (mergedOptions.help) {
    showGenerateTypesHelp()
    return
  }

  const projectRoot = process.cwd()

  try {
    console.log('🔧 Generating TypeScript types...')
    console.log('')

    // Confirm with user unless --yes is set
    const confirmed = await confirmGeneration(mergedOptions)
    if (!confirmed) {
      console.log('Aborted.')
      return
    }

    await runTypeGeneration(projectRoot, mergedOptions.output)

    console.log('✅ Type generation complete')
    console.log('')
    console.log('Usage in route handlers:')
    console.log('```typescript')
    console.log("import type { Params } from '@/routes/users/[userId]'")
    console.log('')
    console.log('export async function GET({ params }: { params: Params }) {')
    console.log('  const userId = params.userId // TypeScript knows the type')
    console.log('}')
    console.log('```')

    // Enable watch mode if requested
    if (mergedOptions.watch) {
      const routesDir = join(projectRoot, 'src', 'routes')
      const envExampleFile = join(projectRoot, '.env.example')

      console.log('')
      console.log('👀 Watching for changes...')
      console.log(`   - ${routesDir}`)
      console.log(`   - ${envExampleFile}`)
      console.log('')
      console.log('Press Ctrl+C to stop watching')
      console.log('')

      // Throttle regeneration to prevent excessive rebuilds (2s cooldown per Story 6-4)
      let regenerating = false
      let regenerationTimeout: NodeJS.Timeout | null = null
      let routesWatcher: FSWatcher | null = null

      const triggerRegeneration = () => {
        if (regenerating) {
          // Already regenerating, clear existing timeout and reschedule
          if (regenerationTimeout) {
            clearTimeout(regenerationTimeout)
          }
          regenerationTimeout = setTimeout(triggerRegeneration, 2000)
          return
        }

        regenerating = true

        // Clear the timeout since we're now executing
        if (regenerationTimeout) {
          clearTimeout(regenerationTimeout)
          regenerationTimeout = null
        }

        const timestamp = new Date().toLocaleTimeString()
        console.log(`[${timestamp}] 🔄 Regenerating types...`)

        runTypeGeneration(projectRoot, mergedOptions.output)
          .then(() => {
            console.log(`[${timestamp}] ✅ Types regenerated`)
            console.log('')
            regenerating = false
          })
          .catch((error) => {
            console.error(`[${timestamp}] ❌ Regeneration failed:`)
            console.error(error instanceof Error ? error.message : String(error))
            console.log('')
            regenerating = false
          })
      }

      // Cleanup function to properly close resources
      const cleanup = () => {
        console.log('')
        console.log('👋 Stopping watch mode...')
        if (routesWatcher) {
          routesWatcher.close()
          routesWatcher = null
        }
        if (regenerationTimeout) {
          clearTimeout(regenerationTimeout)
          regenerationTimeout = null
        }
      }

      // Signal handlers with proper cleanup
      const signalHandler = () => {
        cleanup()
        // Remove listeners to prevent memory leaks
        process.removeListener('SIGINT', signalHandler)
        process.removeListener('SIGTERM', signalHandler)
        process.exit(0)
      }

      // Watch routes directory
      if (existsSync(routesDir)) {
        routesWatcher = watch(routesDir, { recursive: true }, (eventType, filename) => {
          if (filename && (filename.endsWith('.ts') || filename.endsWith('.tsx'))) {
            triggerRegeneration()
          }
        })

        // Register signal handlers for clean shutdown
        process.on('SIGINT', signalHandler)
        process.on('SIGTERM', signalHandler)
      }

      // Keep process alive
      await new Promise(() => {})
    }
  } catch (error) {
    console.error('❌ Failed to generate types')
    console.error('')
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error(String(error))
    }
    process.exit(1)
  }
}
