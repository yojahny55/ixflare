/**
 * @module auth/rbac/middleware
 * @description Authorization middleware for role and permission checking
 * Story 5-4: Authorization with RBAC + Policies
 */

import type { Middleware } from '@/core/middleware'
import type { User, RolesConfig } from './types'
import { hasPermission } from './permissions'
import { PermissionDeniedError, RoleDeniedError } from './errors'
import { AuthError } from '@/errors'

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
    const user = (ctx as any).user as User | undefined

    // Authentication check (AC2)
    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    // Validate user has roles array
    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Role check (AC2)
    if (!user.roles.includes(role)) {
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
 * @throws AuthError (401) if user is not authenticated
 * @throws RoleDeniedError (403) if user has none of the required roles
 */
export function requireAnyRole(roles: string[]): Middleware {
  return async (ctx, next) => {
    const user = (ctx as any).user as User | undefined

    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Check if user has any of the required roles
    const hasAnyRole = roles.some((role) => user.roles.includes(role))

    if (!hasAnyRole) {
      throw new RoleDeniedError(`Requires one of: ${roles.join(', ')}`, undefined, user.roles)
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
    const user = (ctx as any).user as User | undefined

    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Check if user has all of the required roles
    const hasAllRoles = roles.every((role) => user.roles.includes(role))

    if (!hasAllRoles) {
      throw new RoleDeniedError(`Requires all of: ${roles.join(', ')}`, undefined, user.roles)
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
    const user = (ctx as any).user as User | undefined

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
 * @throws AuthError (401) if user is not authenticated
 * @throws PermissionDeniedError (403) if user has none of the required permissions
 */
export function requireAnyPermission<T extends RolesConfig>(
  permissions: string[],
  rolesConfig: T
): Middleware {
  return async (ctx, next) => {
    const user = (ctx as any).user as User | undefined

    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Check if user has any of the permissions
    const hasAnyPerm = permissions.some((perm) => hasPermission(user, perm, rolesConfig))

    if (!hasAnyPerm) {
      throw new PermissionDeniedError(`Requires one of: ${permissions.join(', ')}`, undefined, user.roles)
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
    const user = (ctx as any).user as User | undefined

    if (!user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      throw new AuthError('INVALID_USER', 'User object is malformed')
    }

    // Check if user has all of the permissions
    const hasAllPerms = permissions.every((perm) => hasPermission(user, perm, rolesConfig))

    if (!hasAllPerms) {
      throw new PermissionDeniedError(`Requires all of: ${permissions.join(', ')}`, undefined, user.roles)
    }

    return next()
  }
}
