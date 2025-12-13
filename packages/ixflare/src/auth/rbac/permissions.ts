/**
 * @module auth/rbac/permissions
 * @description Permission checking utilities
 * Story 5-4: Authorization with RBAC + Policies
 */

import type { User, RolesConfig } from './types'
import { getRolePermissions } from './roles'

/**
 * Check if user has a specific permission
 * Aggregates permissions from all user roles (AC7)
 *
 * @param user - User to check
 * @param permission - Permission to check (format: "resource:action")
 * @param rolesConfig - Role configuration
 * @returns true if user has permission, false otherwise (deny by default - AC8)
 *
 * @example
 * ```typescript
 * const user = { id: '1', roles: ['editor', 'moderator'] }
 * const canEdit = hasPermission(user, 'posts:update', roles) // true
 * const canDelete = hasPermission(user, 'posts:delete', roles) // depends on roles
 * ```
 */
export function hasPermission<T extends RolesConfig>(
  user: User,
  permission: string,
  rolesConfig: T
): boolean {
  // Validate inputs (OWASP: Input validation)
  if (!user || !user.roles || !Array.isArray(user.roles)) {
    return false // Deny by default (AC8)
  }

  if (!permission || typeof permission !== 'string') {
    return false // Deny by default (AC8)
  }

  // Aggregate permissions from all user roles (AC7)
  const userPermissions: string[] = []
  for (const role of user.roles) {
    const rolePerms = getRolePermissions(rolesConfig, role)
    userPermissions.push(...rolePerms)
  }

  // Check for global wildcard (AC1)
  if (userPermissions.includes('*')) {
    return true
  }

  // Check for exact match
  if (userPermissions.includes(permission)) {
    return true
  }

  // Check for resource wildcard (e.g., "posts:*" matches "posts:delete")
  const [resource] = permission.split(':')
  if (resource && userPermissions.includes(`${resource}:*`)) {
    return true
  }

  // Deny by default (AC8, OWASP principle)
  return false
}

/**
 * Check if user has any of the specified permissions
 *
 * @param user - User to check
 * @param permissions - Array of permissions (OR logic)
 * @param rolesConfig - Role configuration
 * @returns true if user has any permission, false otherwise
 */
export function hasAnyPermission<T extends RolesConfig>(
  user: User,
  permissions: string[],
  rolesConfig: T
): boolean {
  for (const permission of permissions) {
    if (hasPermission(user, permission, rolesConfig)) {
      return true
    }
  }
  return false
}

/**
 * Check if user has all of the specified permissions
 *
 * @param user - User to check
 * @param permissions - Array of permissions (AND logic)
 * @param rolesConfig - Role configuration
 * @returns true if user has all permissions, false otherwise
 */
export function hasAllPermissions<T extends RolesConfig>(
  user: User,
  permissions: string[],
  rolesConfig: T
): boolean {
  for (const permission of permissions) {
    if (!hasPermission(user, permission, rolesConfig)) {
      return false
    }
  }
  return true
}

/**
 * Get all permissions for a user (from all their roles)
 *
 * @param user - User to get permissions for
 * @param rolesConfig - Role configuration
 * @returns Array of unique permissions
 */
export function getUserPermissions<T extends RolesConfig>(user: User, rolesConfig: T): string[] {
  if (!user || !user.roles || !Array.isArray(user.roles)) {
    return []
  }

  const permissions = new Set<string>()

  for (const role of user.roles) {
    const rolePerms = getRolePermissions(rolesConfig, role)
    for (const perm of rolePerms) {
      permissions.add(perm)
    }
  }

  return Array.from(permissions)
}
