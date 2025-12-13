/**
 * @module auth/rbac/policies
 * @description Resource-level policy definition and enforcement
 * Story 5-4: Authorization with RBAC + Policies
 */

import type { PolicyDefinition, Policy } from './types'
import { ForbiddenError } from '@/errors'

/**
 * Define a resource-level policy with type-safe actions
 *
 * @template TUser - User type
 * @template TResource - Resource type
 * @param definition - Policy definition object mapping actions to functions
 * @returns Policy object with can() and authorize() methods
 *
 * @example
 * ```typescript
 * // Define policy for Post resources
 * const postPolicy = definePolicy({
 *   view: (user, post) => true,  // Anyone can view
 *   update: (user, post) => user.id === post.authorId || user.role === 'admin',
 *   delete: (user, post) => user.id === post.authorId || user.role === 'admin',
 * })
 *
 * // Usage in handler
 * export const PUT: RouteHandler = async ({ user, params }) => {
 *   const post = await Post.findOrFail(params.id)
 *
 *   if (!postPolicy.can(user, 'update', post)) {
 *     throw new ForbiddenError('Cannot update this post')
 *   }
 *
 *   // ... update post
 * }
 * ```
 */
export function definePolicy<TUser = any, TResource = any>(
  definition: PolicyDefinition<TUser, TResource>
): Policy<TUser, TResource, Extract<keyof typeof definition, string>> {
  // Validate policy definition
  if (!definition || typeof definition !== 'object') {
    throw new Error('Policy definition must be an object')
  }

  for (const [action, fn] of Object.entries(definition)) {
    if (typeof fn !== 'function') {
      throw new Error(`Policy action "${action}" must be a function`)
    }
  }

  /**
   * Check if user can perform action on resource (synchronous for UI)
   *
   * @param user - User attempting the action
   * @param action - Action being attempted
   * @param resource - Resource being accessed
   * @returns true if authorized, false otherwise
   */
  function can(
    user: TUser,
    action: Extract<keyof typeof definition, string>,
    resource: TResource
  ): boolean {
    const policyFn = definition[action]

    // Deny by default if action doesn't exist (AC8, OWASP)
    if (!policyFn) {
      return false
    }

    // Validate inputs (OWASP: Input validation)
    if (!user) {
      return false
    }

    try {
      // Execute policy function
      return policyFn(user, resource)
    } catch (error) {
      // Log error but deny access (fail-safe)
      console.error(`Policy check failed for action "${String(action)}":`, error)
      return false
    }
  }

  /**
   * Authorize user to perform action on resource (throws on failure)
   *
   * @param user - User attempting the action
   * @param action - Action being attempted
   * @param resource - Resource being accessed
   * @throws ForbiddenError if not authorized
   */
  function authorize(
    user: TUser,
    action: Extract<keyof typeof definition, string>,
    resource: TResource
  ): void {
    if (!can(user, action, resource)) {
      throw new ForbiddenError(`Cannot perform action: ${String(action)}`)
    }
  }

  return {
    can,
    authorize,
  }
}
