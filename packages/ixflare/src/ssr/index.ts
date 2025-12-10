/**
 * @module ssr
 * @description Server-side rendering utilities for React
 * @packageDocumentation
 *
 * This module contains all React-dependent code. API-only apps should NOT
 * import from this module to avoid requiring React as a dependency.
 */

export { renderToString, renderToStream } from './render'
export { createIsland, hydrateIsland } from './islands'
export { renderLayoutChain, renderWithoutLayouts } from './layout-renderer'
export { useLayoutData, LayoutContextProvider } from '@/core/layout'
export type {
  RenderOptions,
  RenderResult,
  PageProps,
  LoaderContext,
  IslandConfig
} from './types'
export type { LayoutComponent } from './layout-renderer'
