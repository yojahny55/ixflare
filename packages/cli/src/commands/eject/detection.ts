/**
 * Project state detection utilities
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ProjectState } from './types.js'

/**
 * Detect the current state of the project
 */
export async function detectProjectState(projectRoot: string): Promise<ProjectState> {
  const hasEdgeConfig = existsSync(join(projectRoot, 'edge.config.ts'))
  const hasWranglerToml = existsSync(join(projectRoot, 'wrangler.toml'))
  const hasViteConfig = existsSync(join(projectRoot, 'vite.config.ts'))

  // Project is considered ejected if it has wrangler.toml but no edge.config.ts
  const isEjected = hasWranglerToml && !hasEdgeConfig

  return {
    isEjected,
    hasEdgeConfig,
    hasWranglerToml,
    hasViteConfig,
  }
}
