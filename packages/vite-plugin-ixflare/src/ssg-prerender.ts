/**
 * @module ssg-prerender
 * @description SSG build-time pre-rendering for static routes
 * @node-only
 *
 * This module handles pre-rendering SSG routes at build time.
 * It discovers routes with `rendering: 'ssg'`, calls their getStaticPaths(),
 * renders them to HTML, and writes the files to the output directory.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { Route } from './router-codegen'

export interface SSGRoute {
  route: Route
  paths: StaticPath[]
}

export interface StaticPath {
  params: Record<string, string>
}

export interface PrerenderResult {
  route: string
  outputPath: string
  success: boolean
  error?: string
}

export interface SSGPrerenderConfig {
  outputDir: string
  routes: Route[]
  /** Function to load and execute a route module */
  loadModule: (file: string) => Promise<{
    getStaticPaths?: () => Promise<StaticPath[]> | StaticPath[]
    default?: React.ComponentType<unknown>
    GET?: (ctx: unknown) => Promise<Response> | Response
  }>
  /** Function to render a component to HTML */
  renderToHtml: (
    component: React.ComponentType<unknown>,
    props: Record<string, unknown>
  ) => Promise<string>
}

/**
 * Identify SSG routes from route manifest
 */
export function identifySSGRoutes(routes: Route[]): Route[] {
  return routes.filter((route) => route.config?.rendering === 'ssg')
}

/**
 * Convert route path pattern to actual path with params
 * /blog/:slug → /blog/hello-world
 */
export function resolveRoutePath(routePath: string, params: Record<string, string>): string {
  let resolved = routePath

  for (const [key, value] of Object.entries(params)) {
    // Replace :param with value
    resolved = resolved.replace(`:${key}`, value)
    // Replace [...param] catch-all (represented as * in route path)
    resolved = resolved.replace('*', value)
  }

  return resolved
}

/**
 * Convert route path to output file path
 * /blog/hello-world → blog/hello-world.html
 * / → index.html
 */
export function routePathToOutputFile(routePath: string): string {
  if (routePath === '/') {
    return 'index.html'
  }

  // Remove leading slash and add .html
  const withoutLeadingSlash = routePath.startsWith('/') ? routePath.slice(1) : routePath

  // If path ends with a segment (not /), add .html
  // /blog/post → blog/post.html
  // /blog/ → blog/index.html
  if (withoutLeadingSlash.endsWith('/')) {
    return `${withoutLeadingSlash}index.html`
  }

  return `${withoutLeadingSlash}.html`
}

/**
 * Pre-render SSG routes at build time
 *
 * This function:
 * 1. Identifies routes with rendering: 'ssg'
 * 2. Calls getStaticPaths() for dynamic routes
 * 3. Renders each path to HTML
 * 4. Writes HTML files to output directory
 */
export async function prerenderSSGRoutes(config: SSGPrerenderConfig): Promise<PrerenderResult[]> {
  const results: PrerenderResult[] = []
  const ssgRoutes = identifySSGRoutes(config.routes)

  if (ssgRoutes.length === 0) {
    return results
  }

  for (const route of ssgRoutes) {
    try {
      // Load the route module
      const module = await config.loadModule(route.file)

      // Determine paths to pre-render
      let pathsToRender: StaticPath[] = []

      if (route.hasGetStaticPaths && module.getStaticPaths) {
        // Dynamic SSG route - call getStaticPaths
        const staticPaths = await module.getStaticPaths()
        pathsToRender = staticPaths
      } else if (route.params.length === 0) {
        // Static SSG route (no dynamic params) - render once
        pathsToRender = [{ params: {} }]
      } else {
        // Dynamic route without getStaticPaths - skip with warning
        results.push({
          route: route.path,
          outputPath: '',
          success: false,
          error: `SSG route ${route.path} has dynamic params but no getStaticPaths export`,
        })
        continue
      }

      // Render each path
      for (const staticPath of pathsToRender) {
        const resolvedPath = resolveRoutePath(route.path, staticPath.params)
        const outputFile = routePathToOutputFile(resolvedPath)
        const outputPath = join(config.outputDir, outputFile)

        try {
          let html: string

          // Try to render using the component if available
          if (module.default) {
            html = await config.renderToHtml(module.default, {
              params: staticPath.params,
            })
          } else if (module.GET) {
            // Use GET handler if no default component
            const response = await module.GET({ params: staticPath.params })
            html = await response.text()
          } else {
            throw new Error(`Route ${route.path} has no default export or GET handler`)
          }

          // Ensure output directory exists
          await mkdir(dirname(outputPath), { recursive: true })

          // Write HTML file
          await writeFile(outputPath, html, 'utf-8')

          results.push({
            route: resolvedPath,
            outputPath: outputFile,
            success: true,
          })
        } catch (renderError) {
          results.push({
            route: resolvedPath,
            outputPath: outputFile,
            success: false,
            error: renderError instanceof Error ? renderError.message : String(renderError),
          })
        }
      }
    } catch (error) {
      results.push({
        route: route.path,
        outputPath: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return results
}

/**
 * Generate SSG manifest with pre-rendered routes
 * This manifest can be used by the runtime to serve static files
 */
export interface SSGManifest {
  routes: {
    path: string
    file: string
    revalidate?: number
  }[]
  generatedAt: number
}

export function generateSSGManifest(results: PrerenderResult[], routes: Route[]): SSGManifest {
  const successfulResults = results.filter((r) => r.success)

  return {
    routes: successfulResults.map((result) => {
      const route = routes.find(
        (r) => r.path === result.route || resolveRoutePath(r.path, {}) === result.route
      )
      return {
        path: result.route,
        file: result.outputPath,
        revalidate: route?.config?.revalidate,
      }
    }),
    generatedAt: Date.now(),
  }
}
