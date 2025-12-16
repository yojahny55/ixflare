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
export async function calculateGzipSize(data: Buffer): Promise<number> {
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
    warnings.push(`Bundle exceeds internal target of ${INTERNAL_TARGET_KB}KB (actual: ${formatSize(gzipSize)})`)
  }

  // Workers free tier limit
  if (sizeMB > WORKERS_FREE_MB) {
    warnings.push(`Bundle exceeds Workers free tier limit of ${WORKERS_FREE_MB}MB (actual: ${formatSize(gzipSize)})`)
  }

  // Workers paid tier limit
  if (sizeMB > WORKERS_PAID_MB) {
    warnings.push(`Bundle exceeds Workers paid tier limit of ${WORKERS_PAID_MB}MB (actual: ${formatSize(gzipSize)})`)
  }

  return warnings
}

/**
 * Collect bundle sizes from dist directory
 */
async function collectBundleSizes(distPath: string): Promise<BundleSizeInfo[]> {
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
        const gzipSize = await calculateGzipSize(content)

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
  const clientBundles = bundles.filter((b) => !b.file.includes('_worker') && b.file.includes('assets'))

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
 * Main build command
 */
export async function build(options: BuildOptions = {}): Promise<void> {
  const projectRoot = process.cwd()
  const runner = new HooksRunner()
  const startTime = Date.now()

  // Default sourcemap to true if not explicitly set
  const sourcemap = options.sourcemap !== undefined ? options.sourcemap : true

  // Clean dist directory if --clean flag is set
  if (options.clean) {
    const distPath = join(projectRoot, 'dist')
    try {
      rmSync(distPath, { recursive: true, force: true })
      if (options.verbose) {
        console.log(pc.dim('✓ Cleaned dist/ directory'))
      }
    } catch {
      // Ignore if dist doesn't exist
    }
  }

  try {
    // Load configuration
    await runner.loadConfig(projectRoot)

    // Execute pre-build hook
    try {
      await runner.runPreBuild()
    } catch (error) {
      if (error instanceof HookError) {
        console.error(`\n❌ ${error.message}`)
        console.error('\nBuild stopped due to hook failure.\n')
        process.exit(1)
      }
      throw error
    }

    console.log('Building for production...')
    console.log('')

    // Build Vite configuration
    const viteConfig: InlineConfig = {
      root: projectRoot,
      configFile: join(projectRoot, 'vite.config.ts'),
      mode: options.env || 'production',
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
    if (options.watch) {
      viteConfig.build = {
        ...viteConfig.build,
        watch: {},
      }
    }

    // Add visualizer plugin if --analyze flag is set
    if (options.analyze) {
      viteConfig.plugins = [
        visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
          template: 'treemap',
        }),
      ]
    }

    // Execute Vite build
    try {
      await viteBuild(viteConfig)

      console.log('✓ TypeScript compilation complete')

      // Collect and display bundle sizes
      const distPath = join(projectRoot, 'dist')
      const bundles = await collectBundleSizes(distPath)
      displayBundleSizes(bundles)

      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log('')
      console.log(`Build complete in ${pc.cyan(duration + 's')}`)
      console.log(`Output: ${pc.dim('dist/')}`)

      // Display bundle size warnings
      displayBundleSizeWarnings(bundles)

      // Determine output path for hooks
      const outputPath = distPath

      // Execute post-build hook
      try {
        await runner.runPostBuild({ outputPath })
      } catch (error) {
        if (error instanceof HookError) {
          console.error(`\n❌ ${error.message}`)
          console.error('\nBuild completed but post-build hook failed.\n')
          process.exit(1)
        }
        throw error
      }
    } catch (error) {
      console.error(`\n❌ Build failed:\n`)
      if (error instanceof Error) {
        console.error(error.message)
      } else {
        console.error('Unknown error occurred')
      }
      console.log('')
      process.exit(1)
    }
  } catch (error) {
    // Handle config loading errors gracefully
    // If no config file exists, just run build without hooks
    if (error instanceof Error && error.message.includes('Configuration file not found')) {
      console.log('Building for production...')
      console.log('')

      // Build without hooks
      const viteConfig: InlineConfig = {
        root: projectRoot,
        configFile: join(projectRoot, 'vite.config.ts'),
        mode: options.env || 'production',
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

      if (options.watch) {
        viteConfig.build = {
          ...viteConfig.build,
          watch: {},
        }
      }

      if (options.analyze) {
        viteConfig.plugins = [
          visualizer({
            filename: 'dist/stats.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
      }

      try {
        await viteBuild(viteConfig)

        console.log('✓ TypeScript compilation complete')

        const distPath = join(projectRoot, 'dist')
        const bundles = await collectBundleSizes(distPath)
        displayBundleSizes(bundles)

        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log('')
        console.log(`Build complete in ${pc.cyan(duration + 's')}`)
        console.log(`Output: ${pc.dim('dist/')}`)

        displayBundleSizeWarnings(bundles)
      } catch (buildError) {
        console.error(`\n❌ Build failed:\n`)
        if (buildError instanceof Error) {
          console.error(buildError.message)
        }
        console.log('')
        process.exit(1)
      }

      return
    }
    throw error
  }
}
