/**
 * @module auth/rbac/types
 * @description Type definitions for Role-Based Access Control (RBAC) and Policies
 * Story 5-4: Authorization with RBAC + Policies
 */

/**
 * Permission string format: "resource:action" or "*" for wildcard
 * Examples: "posts:read", "posts:*", "*"
 */
export type Permission = string

/**
 * Role definition with permissions and optional inheritance
 */
export interface RoleDefinition {
  /** Permissions granted to this role */
  permissions: Permission[]
  /** Optional: inherit permissions from other roles */
  inherits?: string[]
}

/**
 * Role configuration object
 * Generic type T captures role names for type inference
 */
export type RolesConfig<T extends string = string> = Record<T, RoleDefinition>

/**
 * User interface for authorization
 * Must have ID and array of role names
 */
export interface User {
  id: string
  /** Multiple roles supported (AC7) */
  roles: string[]
  [key: string]: unknown
}

/**
 * Authorization context with user and request
 */
export interface AuthorizationContext<TUser = User> {
  user: TUser
  request: Request
}

/**
 * Policy action function type
 * @param user - User attempting the action
 * @param resource - Resource being accessed
 * @returns true if authorized, false otherwise
 */
export type PolicyAction<TUser, TResource> = (user: TUser, resource: TResource) => boolean

/**
 * Policy definition object
 * Maps action names to policy functions
 */
export interface PolicyDefinition<TUser, TResource> {
  [action: string]: PolicyAction<TUser, TResource>
}

/**
 * Policy interface with can() and authorize() methods
 * @template TUser - User type
 * @template TResource - Resource type
 * @template TActions - Union of action names (inferred from policy definition)
 */
export interface Policy<TUser, TResource, TActions extends string> {
  /**
   * Check if user can perform action on resource (synchronous for UI)
   * @param user - User attempting the action
   * @param action - Action being attempted
   * @param resource - Resource being accessed
   * @returns true if authorized, false otherwise
   */
  can: (user: TUser, action: TActions, resource: TResource) => boolean

  /**
   * Authorize user to perform action on resource (throws on failure)
   * @param user - User attempting the action
   * @param action - Action being attempted
   * @param resource - Resource being accessed
   * @throws ForbiddenError if not authorized
   */
  authorize: (user: TUser, action: TActions, resource: TResource) => void
}
