/**
 * @module vite-plugin-ixflare
 * @description Vite plugin for Ixflare framework
 * @node-only
 */

import type { Plugin } from 'vite'
import { ixflarePlugin } from './plugin'

export { ixflarePlugin }
export default ixflarePlugin

export type { IxflarePluginOptions } from './types'
