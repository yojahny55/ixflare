/**
 * @module vite-plugin-ixflare
 * @description Vite plugin for Ixflare framework
 * @node-only
 */

import { ixflarePlugin } from './plugin'

export { ixflarePlugin }
export default ixflarePlugin

export type { IxflarePluginOptions, MiniflareConfig } from './types'
export type { Route, RouteManifest, RouteParam, HttpMethod } from './router-codegen'
export type { DevServerConfig, DevServer } from './dev-server'
export type { BuildConfig, BuildResult } from './build'
