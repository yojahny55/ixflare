/**
 * @module ssr/page-renderer
 * @description Page rendering utilities that integrate loaders with SSR
 * @worker-only
 */

import * as React from 'react'
import { renderToString, renderToStream } from './render'
import type { RenderOptions, RouteConfig } from './types'
import type { EdgeContext } from '@/types/context'
import { generateCacheHeaders } from './route-renderer'

/**
 * Page component type - receives loader data via `data` prop
 *
 * @template TData - Type of data returned by the loader
 *
 * @example
 * ```typescript
 * interface UserPageData {
 *   user: User
 *   posts: Post[]
 * }
 *
 * // Page component receives loader data automatically
 * export default function UserPage({ data }: { data: UserPageData }) {
 *   return (
 *     <div>
 *       <h1>{data.user.name}</h1>
 *       {data.posts.map(post => <PostCard key={post.id} post={post} />)}
 *     </div>
 *   )
 * }
 * ```
 */
export type PageComponent<TData = unknown> = React.ComponentType<{
  data: TData
  params?: Record<string, string>
  request?: Request
}>

/**
 * Options for page rendering
 */
export interface PageRenderOptions extends Omit<RenderOptions, 'bootstrapData'> {
  /** Route configuration for caching */
  config?: RouteConfig
  /** Include loader data in bootstrap data for hydration */
  hydrateData?: boolean
}

/**
 * Render a page component with loader data from EdgeContext
 *
 * This helper integrates the loader → SSR flow by:
 * 1. Extracting loaderData from context
 * 2. Creating React element with data prop
 * 3. Rendering to HTML Response with proper headers
 *
 * @template TData - Type of loader data
 * @param Page - Page component to render
 * @param context - EdgeContext with loaderData from router
 * @param options - Render options
 * @returns Response with SSR HTML
 *
 * @example
 * ```typescript
 * // In route file (e.g., routes/users/[id].tsx)
 *
 * export async function loader({ params, env }: LoaderArgs) {
 *   const user = await User.find(params.id)
 *   if (!user) throw new NotFoundError('User not found')
 *   return { user }
 * }
 *
 * function UserPage({ data }: { data: { user: User } }) {
 *   return <h1>{data.user.name}</h1>
 * }
 *
 * export async function GET(ctx: EdgeContext) {
 *   return renderPage(UserPage, ctx, {
 *     title: 'User Profile',
 *     config: { cache: { maxAge: 60 } }
 *   })
 * }
 * ```
 */
export async function renderPage<TData = unknown>(
  Page: PageComponent<TData>,
  context: EdgeContext,
  options: PageRenderOptions = {}
): Promise<Response> {
  const { config, hydrateData = true, streaming, ...renderOptions } = options

  // Extract loader data from context
  const loaderData = context.loaderData as TData

  // Create page element with data prop
  const element = React.createElement(Page, {
    data: loaderData,
    params: context.params,
    request: context.request,
  })

  // Build bootstrap data for hydration
  const bootstrapData = hydrateData
    ? {
        loaderData,
        params: context.params,
        url: context.url.toString(),
      }
    : undefined

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
  }

  // Add cache headers if config specifies caching
  if (config?.cache) {
    const cacheHeaders = generateCacheHeaders(config.cache)
    Object.assign(headers, cacheHeaders)
  }

  // Render based on streaming preference
  if (streaming) {
    const stream = renderToStream(element, {
      ...renderOptions,
      bootstrapData,
    })

    return new Response(stream, {
      status: 200,
      headers,
    })
  } else {
    const html = await renderToString(element, {
      ...renderOptions,
      bootstrapData,
    })

    return new Response(html, {
      status: 200,
      headers,
    })
  }
}

/**
 * Create a page handler that automatically integrates loader with SSR
 *
 * This is a higher-order function that wraps a page component, creating
 * a route handler that automatically renders with loader data.
 *
 * @template TData - Type of loader data
 * @param Page - Page component to render
 * @param options - Default render options
 * @returns Route handler function
 *
 * @example
 * ```typescript
 * // In route file (e.g., routes/dashboard.tsx)
 *
 * export async function loader({ env }: LoaderArgs) {
 *   const stats = await getStats(env.DB)
 *   return { stats }
 * }
 *
 * function DashboardPage({ data }: { data: { stats: Stats } }) {
 *   return <Dashboard stats={data.stats} />
 * }
 *
 * // Export GET handler with automatic SSR
 * export const GET = createPageHandler(DashboardPage, {
 *   title: 'Dashboard',
 *   streaming: true,
 *   config: { cache: { maxAge: 30 } }
 * })
 * ```
 */
export function createPageHandler<TData = unknown>(
  Page: PageComponent<TData>,
  options: PageRenderOptions = {}
): (context: EdgeContext) => Promise<Response> {
  return async (context: EdgeContext) => {
    return renderPage(Page, context, options)
  }
}
