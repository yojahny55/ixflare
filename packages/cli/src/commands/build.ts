/**
 * @module commands/build
 * @description Production build command
 */

import { gzipSync } from 'node:zlib'
import { readdirSync, statSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { build as viteBuild, type InlineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'
import pc from 'picocolors'
import { HooksRunner, HookError } from '@/hooks/index'
import { BuildError, detectDisplayOptions } from '@/errors'

export interface BuildOptions {
  analyze?: boolean
  env?: string
  sourcemap?: boolean
  watch?: boolean
  clean?: boolean
  verbose?: boolean
}

interface BundleSizeInfo {
  file: string
  size: number
  gzipSize: number
}

// Bundle size thresholds
const INTERNAL_TARGET_KB = 50
// Cloudflare Workers limits (compressed): Free 3MB, Paid (Workers Paid/Bundled) 10MB
// Reference: https://developers.cloudflare.com/workers/platform/limits/
const WORKERS_FREE_MB = 3
const WORKERS_PAID_MB = 10

/**
 * Parse build command CLI arguments
 */
export function parseBuildArgs(args: string[]): BuildOptions {
  const options: BuildOptions = {
    analyze: false,
    env: undefined,
    sourcemap: true,
    watch: false,
    clean: false,
    verbose: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--analyze') {
      options.analyze = true
    } else if (arg === '--env' && args[i + 1]) {
      options.env = args[i + 1]
      i++
    } else if (arg === '--no-sourcemaps') {
      options.sourcemap = false
    } else if (arg === '--watch') {
      options.watch = true
    } else if (arg === '--clean') {
      options.clean = true
    } else if (arg === '--verbose') {
      options.verbose = true
    }
  }

  return options
}

/**
 * Calculate gzip size of buffer
 */
export function calculateGzipSize(data: Buffer): number {
  const compressed = gzipSync(data)
  return compressed.length
}

/**
 * Format size in human-readable format
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
}

/**
 * Check bundle size against thresholds and return warnings
 */
export function checkBundleSize(gzipSize: number): string[] {
  const warnings: string[] = []
  const sizeKB = gzipSize / 1024
  const sizeMB = gzipSize / (1024 * 1024)

  // Internal target check (info level)
  if (sizeKB > INTERNAL_TARGET_KB) {
    warnings.push(
      `Bundle exceeds internal target of ${INTERNAL_TARGET_KB}KB (actual: ${formatSize(gzipSize)})`
    )
  }

  // Workers free tier limit
  if (sizeMB > WORKERS_FREE_MB) {
    warnings.push(
      `Bundle exceeds Workers free tier limit of ${WORKERS_FREE_MB}MB (actual: ${formatSize(gzipSize)})`
    )
  }

  // Workers paid tier limit
  if (sizeMB > WORKERS_PAID_MB) {
    warnings.push(
      `Bundle exceeds Workers paid tier limit of ${WORKERS_PAID_MB}MB (actual: ${formatSize(gzipSize)})`
    )
  }

  return warnings
}

/**
 * Collect bundle sizes from dist directory
 */
function collectBundleSizes(distPath: string): BundleSizeInfo[] {
  const bundles: BundleSizeInfo[] = []

  try {
    const files = readdirSync(distPath, { recursive: true })

    for (const file of files) {
      const filePath = join(distPath, file.toString())

      // Skip directories
      try {
        const stat = statSync(filePath)
        if (stat.isDirectory()) continue

        // Only include .js files
        if (!filePath.endsWith('.js')) continue

        const content = readFileSync(filePath)
        const gzipSize = calculateGzipSize(content)

        bundles.push({
          file: file.toString(),
          size: stat.size,
          gzipSize,
        })
      } catch {
        // Skip files we can't read
        continue
      }
    }
  } catch {
    // Dist directory doesn't exist or can't be read
  }

  return bundles
}

/**
 * Display bundle sizes
 */
function displayBundleSizes(bundles: BundleSizeInfo[]): void {
  if (bundles.length === 0) return

  // Find server bundle
  const serverBundle = bundles.find((b) => b.file.includes('_worker'))
  const clientBundles = bundles.filter(
    (b) => !b.file.includes('_worker') && b.file.includes('assets')
  )

  if (serverBundle) {
    console.log(`✓ Server bundle: ${pc.cyan(formatSize(serverBundle.gzipSize))} (gzip)`)
  }

  if (clientBundles.length > 0) {
    console.log('✓ Client bundles:')
    for (const bundle of clientBundles) {
      const fileName = bundle.file.replace('assets/', '').replace(/\.[a-f0-9]+\.js$/, '')
      console.log(`    ${fileName}: ${pc.cyan(formatSize(bundle.gzipSize))}`)
    }
  }

  console.log('✓ Assets optimized')
}

/**
 * Display bundle size warnings
 */
function displayBundleSizeWarnings(bundles: BundleSizeInfo[]): void {
  const serverBundle = bundles.find((b) => b.file.includes('_worker'))

  if (!serverBundle) return

  const warnings = checkBundleSize(serverBundle.gzipSize)

  if (warnings.length > 0) {
    console.log('')
    console.log(pc.yellow('⚠️  Bundle size warning:'))
    console.log(`  Server bundle: ${formatSize(serverBundle.gzipSize)} (gzip)`)
    console.log('')
    console.log('  Suggestions:')
    console.log('  • Check for large dependencies: ix build --analyze')
    console.log('  • Consider lazy loading: docs.ixflare.dev/optimization')
    console.log('')
  }
}

/**
 * Build Vite configuration object
 */
function buildViteConfig(options: {
  projectRoot: string
  env?: string
  sourcemap: boolean
  watch: boolean
  analyze: boolean
}): InlineConfig {
  const { projectRoot, env, sourcemap, watch, analyze } = options

  const config: InlineConfig = {
    root: projectRoot,
    configFile: join(projectRoot, 'vite.config.ts'),
    mode: env || 'production',
    build: {
      outDir: 'dist',
      minify: 'esbuild',
      sourcemap,
      rollupOptions: {
        output: {
          manualChunks: undefined,
          entryFileNames: '_worker/index.js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  }

  // Add watch mode if requested
  if (watch) {
    config.build = {
      ...config.build,
      watch: {},
    }
  }

  // Add visualizer plugin if --analyze flag is set
  if (analyze) {
    config.plugins = [
      visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      }),
    ]
  }

  return config
}

/**
 * Execute Vite build and display results
 */
async function executeBuild(
  viteConfig: InlineConfig,
  projectRoot: string,
  startTime: number
): Promise<void> {
  await viteBuild(viteConfig)

  console.log('✓ TypeScript compilation complete')

  // Collect and display bundle sizes
  const distPath = join(projectRoot, 'dist')
  const bundles = collectBundleSizes(distPath)
  displayBundleSizes(bundles)

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('')
  console.log(`Build complete in ${pc.cyan(duration + 's')}`)
  console.log(`Output: ${pc.dim('dist/')}`)

  // Display bundle size warnings
  displayBundleSizeWarnings(bundles)
}

/**
 * Main build command
 */
export async function build(options: BuildOptions = {}): Promise<void> {
  const projectRoot = process.cwd()
  const runner = new HooksRunner()
  const startTime = Date.now()

  // Parse CLI args and merge with provided options
  const cliArgs = process.argv.slice(3)
  const parsedOptions = { ...parseBuildArgs(cliArgs), ...options }

  // Default sourcemap to true if not explicitly set
  const sourcemap = parsedOptions.sourcemap !== undefined ? parsedOptions.sourcemap : true

  // Clean dist directory if --clean flag is set
  if (parsedOptions.clean) {
    const distPath = join(projectRoot, 'dist')
    try {
      rmSync(distPath, { recursive: true, force: true })
      if (parsedOptions.verbose) {
        console.log(pc.dim('✓ Cleaned dist/ directory'))
      }
    } catch {
      // Ignore if dist doesn't exist
    }
  }

  // Build Vite configuration
  const viteConfig = buildViteConfig({
    projectRoot,
    env: parsedOptions.env,
    sourcemap,
    watch: parsedOptions.watch ?? false,
    analyze: parsedOptions.analyze ?? false,
  })

  // Try to load hooks configuration
  let hooksLoaded = false
  try {
    await runner.loadConfig(projectRoot)
    hooksLoaded = true
  } catch (error) {
    // No hooks config file - proceed without hooks
    if (!(error instanceof Error && error.message.includes('Configuration file not found'))) {
      throw error
    }
  }

  // Execute pre-build hook if hooks are loaded
  if (hooksLoaded) {
    try {
      await runner.runPreBuild()
    } catch (error) {
      if (error instanceof HookError) {
        const buildError = new BuildError({
          code: 'IX_E204',
          message: `Pre-build hook failed: ${error.message}`,
          causes: [
            'Hook script returned non-zero exit code',
            'Hook script threw an error',
            'Hook command not found',
          ],
          fixes: [
            'Check hook script for errors',
            'Ensure hook commands are executable',
            'Run with `--verbose` for detailed output',
          ],
          originalError: error,
        })
        const displayOptions = detectDisplayOptions()
        console.error(buildError.format(displayOptions))
        process.exit(1)
      }
      throw error
    }
  }

  console.log('Building for production...')
  console.log('')

  // Execute Vite build
  try {
    await executeBuild(viteConfig, projectRoot, startTime)

    // Execute post-build hook if hooks are loaded
    if (hooksLoaded) {
      const distPath = join(projectRoot, 'dist')
      try {
        await runner.runPostBuild({ outputPath: distPath })
      } catch (hookError) {
        if (hookError instanceof HookError) {
          const buildError = new BuildError({
            code: 'IX_E204',
            message: `Post-build hook failed: ${hookError.message}`,
            causes: [
              'Hook script returned non-zero exit code',
              'Hook script threw an error',
              'Build succeeded but hook failed',
            ],
            fixes: [
              'Check hook script for errors',
              'Ensure hook commands are executable',
              'Note: Your build was successful',
            ],
            originalError: hookError,
          })
          const displayOptions = detectDisplayOptions()
          console.error(buildError.format(displayOptions))
          process.exit(1)
        }
        throw hookError
      }
    }
  } catch (error) {
    const buildError = new BuildError({
      code: 'IX_E204',
      message: 'Build process failed',
      causes: [error instanceof Error ? error.message : 'Unknown error occurred'],
      fixes: [
        'Check the error message above for details',
        'Run `pnpm typecheck` to check for type errors',
        'Ensure all dependencies are installed: `pnpm install`',
        'Try clearing cache: `rm -rf node_modules/.vite`',
      ],
      originalError: error instanceof Error ? error : undefined,
    })
    const displayOptions = detectDisplayOptions()
    console.error(buildError.format(displayOptions))
    process.exit(1)
  }
}
