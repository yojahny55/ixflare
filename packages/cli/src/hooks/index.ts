/**
 * @module hooks
 * @description Lifecycle hooks runner for build and deployment customization
 * @node-only - CLI-only module that uses config loader
 */

import { loadConfig } from 'ixflare/config'
import type { IxflareConfig } from 'ixflare'

/**
 * Post-build hook context
 */
export interface PostBuildContext {
  /** Path to the build output directory */
  outputPath: string
}

/**
 * Pre-deploy hook context
 */
export interface PreDeployContext {
  /** Target environment (development, staging, production) */
  environment: string
}

/**
 * Post-deploy hook context
 */
export interface PostDeployContext {
  /** Deployment URL */
  url: string
}

/**
 * Error thrown when a lifecycle hook fails
 */
export class HookError extends Error {
  /**
   * Create a new HookError
   * @param hookName - Name of the failed hook (e.g., 'pre-build')
   * @param cause - Original error that caused the hook to fail
   */
  constructor(
    public readonly hookName: string,
    public readonly cause: unknown
  ) {
    const message = cause instanceof Error ? cause.message : String(cause)
    super(`Hook "${hookName}" failed: ${message}`)
    this.name = 'HookError'
  }
}

/**
 * Lifecycle hooks runner
 * Executes configured hooks at appropriate build and deployment stages
 */
export class HooksRunner {
  private config: IxflareConfig | null = null

  /**
   * Load configuration from project root
   * Must be called before running any hooks
   *
   * @param projectRoot - Root directory of the project
   */
  async loadConfig(projectRoot: string): Promise<void> {
    this.config = await loadConfig(projectRoot)
  }

  /**
   * Execute pre-build hook if configured
   * Called before build starts
   *
   * @throws {HookError} When hook execution fails
   */
  async runPreBuild(): Promise<void> {
    const hook = this.config?.hooks?.['pre-build']
    if (!hook) return

    try {
      await hook()
    } catch (error) {
      throw new HookError('pre-build', error)
    }
  }

  /**
   * Execute post-build hook if configured
   * Called after build completes successfully
   *
   * @param context - Build context with output path
   * @throws {HookError} When hook execution fails
   */
  async runPostBuild(context: PostBuildContext): Promise<void> {
    const hook = this.config?.hooks?.['post-build'] as ((ctx: PostBuildContext) => void | Promise<void>) | undefined
    if (!hook) return

    try {
      await hook(context)
    } catch (error) {
      throw new HookError('post-build', error)
    }
  }

  /**
   * Execute pre-deploy hook if configured
   * Called before deployment starts
   *
   * @param context - Deploy context with environment
   * @throws {HookError} When hook execution fails
   */
  async runPreDeploy(context: PreDeployContext): Promise<void> {
    const hook = this.config?.hooks?.['pre-deploy'] as ((ctx: PreDeployContext) => void | Promise<void>) | undefined
    if (!hook) return

    try {
      await hook(context)
    } catch (error) {
      throw new HookError('pre-deploy', error)
    }
  }

  /**
   * Execute post-deploy hook if configured
   * Called after deployment completes successfully
   *
   * @param context - Deploy context with URL
   * @throws {HookError} When hook execution fails
   */
  async runPostDeploy(context: PostDeployContext): Promise<void> {
    const hook = this.config?.hooks?.['post-deploy'] as ((ctx: PostDeployContext) => void | Promise<void>) | undefined
    if (!hook) return

    try {
      await hook(context)
    } catch (error) {
      throw new HookError('post-deploy', error)
    }
  }
}
