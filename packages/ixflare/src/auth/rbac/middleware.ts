/**
 * @module auth/rbac/middleware
 * @description Authorization middleware for role and permission checking
 * Story 5-4: Authorization with RBAC + Policies
 */

import type { Middleware } from '@/core/middleware'
import type { EdgeContext } from '@/types/context'
import type { User, RolesConfig } from './types'
import { hasPermission } from './permissions'
import { PermissionDeniedError, RoleDeniedError } from './errors'
import { AuthError } from '@/errors'

/**
 * Timing-safe string comparison to prevent timing attacks
 * Used for role/permission checks to avoid leaking valid role names
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Use the longer string's length to pad comparison
  // This prevents timing leaks from early length check
  const maxLength = Math.max(a.length, b.length)

  let result = a.length ^ b.length // Will be non-zero if lengths differ

  for (let i = 0; i < maxLength; i++) {
    // Use 0 as default for out-of-bounds access
    const charA = i < a.length ? a.charCodeAt(i) : 0
    const charB = i < b.length ? b.charCodeAt(i) : 0
    result |= charA ^ charB
  }

  return result === 0
}

/**
 * Check if user has a role using timing-safe comparison
 *
 * @param userRoles - Array of user's roles
 * @param requiredRole - Role to check for
 * @returns true if user has the role
 */
function hasRoleTimingSafe(userRoles: string[], requiredRole: string): boolean {
  let found = false
  // Always iterate through all roles to maintain constant time
  for (const role of userRoles) {
    if (timingSafeEqual(role, requiredRole)) {
      found = true
    }
  }
  return found
}

/**
 * Type-safe helper to extract user from EdgeContext
 * Avoids `as any` casts throughout middleware
 *
 * @param ctx - Edge context (generic Env type)
 * @returns User object or undefined
 */
function getUserFromContext<Env>(ctx: EdgeContext<Env>): User | undefined {
  // EdgeContext is augmented with user property in session-integration.ts
  return (ctx as EdgeContext<Env> & { user?: User }).user
}

/**
 * Require user to have a specific role
 *
 * @param role - Required role name
 * @returns Middleware function
 *
 * @throws AuthError (401) if user is not authenticated
 * @throws RoleDeniedError (403) if user lacks required role
 *
 * @example
 * ```typescript
 * // src/routes/admin/users.ts
 * import { requireRole } from 'ixflare/auth'
 *
 * export const middleware = [requireRole('admin')]
 *
 * export const GET: RouteHandler = async () => {
 *   const users = await User.all()
 *   return Response.json(users)
 * }
 * ```
 */
export function requireRole(role: string): Middleware {
  return async (ctx, next) => {
    const user = getUserFromContext(ctx)

    // Authentication check (AC2)
    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    // Validate user has roles array
    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Role check using timing-safe comparison (AC2)
    if (!hasRoleTimingSafe(user.roles, role)) {
      throw new RoleDeniedError('Insufficient permissions', role, user.roles)
    }

    return next()
  }
}

/**
 * Require user to have ANY of the specified roles (OR logic)
 *
 * @param roles - Array of role names (user needs at least one)
 * @returns Middleware function
 *
 * @throws Error if roles array is empty
 * @throws AuthError (401) if user is not authenticated
 * @throws RoleDeniedError (403) if user has none of the required roles
 */
export function requireAnyRole(roles: string[]): Middleware {
  // Validate non-empty array at middleware creation time
  if (roles.length === 0) {
    throw new Error('requireAnyRole requires at least one role')
  }

  return async (ctx, next) => {
    const user = getUserFromContext(ctx)

    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Check if user has any of the required roles using timing-safe comparison
    let hasAnyRole = false
    for (const requiredRole of roles) {
      if (hasRoleTimingSafe(user.roles, requiredRole)) {
        hasAnyRole = true
        // Don't break early to maintain more consistent timing
      }
    }

    if (!hasAnyRole) {
      throw new RoleDeniedError('Insufficient permissions', undefined, user.roles)
    }

    return next()
  }
}

/**
 * Require user to have ALL of the specified roles (AND logic)
 *
 * @param roles - Array of role names (user needs all of them)
 * @returns Middleware function
 *
 * @throws AuthError (401) if user is not authenticated
 * @throws RoleDeniedError (403) if user lacks any of the required roles
 */
export function requireAllRoles(roles: string[]): Middleware {
  return async (ctx, next) => {
    const user = getUserFromContext(ctx)

    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Check if user has all of the required roles using timing-safe comparison
    let hasAllRoles = true
    for (const requiredRole of roles) {
      if (!hasRoleTimingSafe(user.roles, requiredRole)) {
        hasAllRoles = false
        // Don't break early to maintain more consistent timing
      }
    }

    if (!hasAllRoles) {
      throw new RoleDeniedError('Insufficient permissions', undefined, user.roles)
    }

    return next()
  }
}

/**
 * Require user to have a specific permission
 *
 * @param permission - Required permission (format: "resource:action")
 * @param rolesConfig - Role configuration
 * @returns Middleware function
 *
 * @throws AuthError (401) if user is not authenticated
 * @throws PermissionDeniedError (403) if user lacks required permission
 *
 * @example
 * ```typescript
 * import { requirePermission } from 'ixflare/auth'
 * import { roles } from '@/auth/roles'
 *
 * export const middleware = [requirePermission('posts:delete', roles)]
 *
 * export const DELETE: RouteHandler = async ({ params }) => {
 *   await Post.findOrFail(params.id).delete()
 *   return Response.json({ success: true })
 * }
 * ```
 */
export function requirePermission<T extends RolesConfig>(
  permission: string,
  rolesConfig: T
): Middleware {
  return async (ctx, next) => {
    const user = getUserFromContext(ctx)

    // Authentication check (AC3)
    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Permission check (AC3, AC8 - deny by default)
    if (!hasPermission(user, permission, rolesConfig)) {
      throw new PermissionDeniedError('Insufficient permissions', permission, user.roles)
    }

    return next()
  }
}

/**
 * Require user to have ANY of the specified permissions (OR logic)
 *
 * @param permissions - Array of permissions (user needs at least one)
 * @param rolesConfig - Role configuration
 * @returns Middleware function
 *
 * @throws Error if permissions array is empty
 * @throws AuthError (401) if user is not authenticated
 * @throws PermissionDeniedError (403) if user has none of the required permissions
 */
export function requireAnyPermission<T extends RolesConfig>(
  permissions: string[],
  rolesConfig: T
): Middleware {
  // Validate non-empty array at middleware creation time
  if (permissions.length === 0) {
    throw new Error('requireAnyPermission requires at least one permission')
  }

  return async (ctx, next) => {
    const user = getUserFromContext(ctx)

    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Check if user has any of the permissions
    const hasAnyPerm = permissions.some((perm) => hasPermission(user, perm, rolesConfig))

    if (!hasAnyPerm) {
      throw new PermissionDeniedError('Insufficient permissions', undefined, user.roles)
    }

    return next()
  }
}

/**
 * Require user to have ALL of the specified permissions (AND logic)
 *
 * @param permissions - Array of permissions (user needs all of them)
 * @param rolesConfig - Role configuration
 * @returns Middleware function
 *
 * @throws AuthError (401) if user is not authenticated
 * @throws PermissionDeniedError (403) if user lacks any of the required permissions
 */
export function requireAllPermissions<T extends RolesConfig>(
  permissions: string[],
  rolesConfig: T
): Middleware {
  return async (ctx, next) => {
    const user = getUserFromContext(ctx)

    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Check if user has all of the permissions
    const hasAllPerms = permissions.every((perm) => hasPermission(user, perm, rolesConfig))

    if (!hasAllPerms) {
      throw new PermissionDeniedError('Insufficient permissions', undefined, user.roles)
    }

    return next()
  }
}
