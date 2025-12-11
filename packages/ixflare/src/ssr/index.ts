/**
 * @module ssr
 * @description Server-side rendering utilities for React
 * @packageDocumentation
 *
 * This module contains all React-dependent code. API-only apps should NOT
 * import from this module to avoid requiring React as a dependency.
 */

export { renderToString, renderToStream } from './render'
export { generateCacheHeaders, renderSSR, renderWithStrategy } from './route-renderer'
export { generateCSRShell, createCSRShellResponse } from './csr-shell'
export type { CSRShellOptions } from './csr-shell'
export {
  generateISRCacheKey,
  prerenderRoute,
  storeISRCache,
  getISRCache,
  handleISRRequest,
  isSSGRoute,
  validateSSGConfig,
} from './ssg'
export {
  createIsland,
  isIslandComponent,
  serializeIslandProps,
  deserializeIslandProps,
  IslandRegistry,
} from './islands'
export { renderLayoutChain, renderWithoutLayouts } from './layout-renderer'
export { useLayoutData, LayoutContextProvider } from '@/core/layout'
export {
  createStreamingResponse,
  streamWithShellCallback,
  createTimeoutController,
  withTimeout,
  createSuspenseFallback,
} from './streaming'
export type {
  RenderOptions,
  RenderResult,
  PageProps,
  LoaderContext,
  IslandConfig,
  IslandLoadStrategy,
  IslandMarkerProps,
  HydrationManifest,
  IslandRegistryEntry,
  RenderingStrategy,
  CacheConfig,
  RouteConfig,
  StaticParams,
  GetStaticPathsFunction,
} from './types'
export type { LayoutComponent } from './layout-renderer'
