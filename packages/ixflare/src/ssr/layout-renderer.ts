/**
 * @module ssr/layout-renderer
 * @description Layout composition and rendering for SSR
 * @worker-only
 */

import * as React from 'react'
import { LayoutContextProvider } from '@/core/layout'
import type { LayoutProps } from '@/types/handlers'

/**
 * Layout component type - default export from _layout.tsx files
 */
export type LayoutComponent<TData = unknown> = React.ComponentType<LayoutProps<TData>>

/**
 * Render a chain of layouts wrapping page content
 *
 * Layouts are rendered from outermost (root) to innermost, with each layout
 * wrapping the next one via the `children` prop.
 *
 * Layout data is accumulated and provided via LayoutContext, allowing child
 * components to access data from all PARENT layouts (not siblings or children).
 *
 * @param layoutChain - Array of layout components (outermost first)
 * @param layoutData - Array of data objects (one per layout)
 * @param pageContent - The innermost page content to wrap
 * @param params - Route parameters available to all layouts
 * @param request - Original request available to all layouts
 * @returns React element with fully composed layout hierarchy
 *
 * @example
 * ```typescript
 * const layouts = [RootLayout, DashboardLayout, SettingsLayout]
 * const data = [{ theme: 'dark' }, { dashboard: {...} }, { settings: {...} }]
 * const element = renderLayoutChain(layouts, data, <Page />, {}, request)
 * // Context at each level:
 * // - RootLayout sees: { theme: 'dark' }
 * // - DashboardLayout sees: { theme: 'dark', dashboard: {...} }
 * // - SettingsLayout sees: { theme: 'dark', dashboard: {...}, settings: {...} }
 * // - Page sees all accumulated data
 * ```
 */
export function renderLayoutChain(
  layoutChain: LayoutComponent[],
  layoutData: unknown[],
  pageContent: React.ReactNode,
  params: Record<string, string> = {},
  request?: Request
): React.ReactElement {
  // Base case: no layouts, return page content wrapped in fragment
  if (layoutChain.length === 0) {
    return React.createElement(React.Fragment, {}, pageContent)
  }

  // Pre-compute accumulated data at each level (outermost to innermost)
  // This ensures each layout's context includes all PARENT data, not child data
  const accumulatedDataAtLevel: Record<string, unknown>[] = []
  let accumulated: Record<string, unknown> = {}

  for (let i = 0; i < layoutChain.length; i++) {
    const data = layoutData[i]
    if (data && typeof data === 'object') {
      accumulated = { ...accumulated, ...(data as Record<string, unknown>) }
    }
    accumulatedDataAtLevel[i] = { ...accumulated }
  }

  // Build nested structure from innermost to outermost (reverse order)
  let children: React.ReactNode = pageContent

  // Wrap page content with full accumulated context (all layout data)
  children = React.createElement(
    LayoutContextProvider,
    { value: accumulated },
    children
  )

  // Process layouts in reverse (innermost first) so we build the tree bottom-up
  for (let i = layoutChain.length - 1; i >= 0; i--) {
    const Layout = layoutChain[i]
    const data = layoutData[i]

    // Create layout element with its own data prop
    const layoutProps: LayoutProps = {
      children,
      data,
      params,
      request,
    }

    // Each layout gets context with accumulated data up to and including its level
    children = React.createElement(
      LayoutContextProvider,
      { value: accumulatedDataAtLevel[i] },
      React.createElement(Layout, layoutProps)
    )
  }

  return children as React.ReactElement
}

/**
 * Simple wrapper to render page content without layouts
 *
 * @param pageContent - Page content to render
 * @returns React element
 */
export function renderWithoutLayouts(pageContent: React.ReactNode): React.ReactElement {
  return React.createElement(React.Fragment, {}, pageContent)
}
