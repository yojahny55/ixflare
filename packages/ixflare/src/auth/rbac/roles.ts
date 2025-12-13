/**
 * @module auth/rbac/roles
 * @description Role definition factory with type inference
 * Story 5-4: Authorization with RBAC + Policies
 */

import type { RolesConfig } from './types'

/**
 * Define roles with full TypeScript inference
 *
 * @template T - Role configuration type (inferred from config)
 * @param config - Role configuration object
 * @returns Type-safe role configuration
 *
 * @example
 * ```typescript
 * const roles = defineRoles({
 *   admin: {
 *     permissions: ['*'],
 *   },
 *   moderator: {
 *     permissions: ['posts:read', 'posts:update', 'posts:delete'],
 *   },
 *   user: {
 *     permissions: ['posts:read', 'posts:create'],
 *   },
 * })
 * ```
 */
export function defineRoles<T extends RolesConfig>(config: T): T {
  // Validate role configuration
  for (const [roleName, roleDef] of Object.entries(config)) {
    if (!roleDef.permissions || !Array.isArray(roleDef.permissions)) {
      throw new Error(`Role "${roleName}" must have a permissions array`)
    }

    // Validate permission format (resource:action or *)
    for (const permission of roleDef.permissions) {
      if (typeof permission !== 'string') {
        throw new Error(`Permission in role "${roleName}" must be a string`)
      }

      if (permission !== '*' && !permission.includes(':')) {
        throw new Error(
          `Permission "${permission}" in role "${roleName}" must be in format "resource:action" or "*"`
        )
      }
    }

    // Validate inherits if present
    if (roleDef.inherits) {
      if (!Array.isArray(roleDef.inherits)) {
        throw new Error(`Role "${roleName}" inherits must be an array`)
      }

      for (const inheritedRole of roleDef.inherits) {
        if (!config[inheritedRole as keyof T]) {
          throw new Error(`Role "${roleName}" inherits from undefined role "${inheritedRole}"`)
        }
      }
    }
  }

  return config
}

/**
 * Get all permissions for a role (including inherited permissions)
 *
 * @param config - Role configuration
 * @param roleName - Name of the role
 * @param visited - Set of visited roles (for cycle detection)
 * @returns Array of permissions
 */
export function getRolePermissions<T extends RolesConfig>(
  config: T,
  roleName: keyof T,
  visited: Set<string> = new Set()
): string[] {
  const role = config[roleName]
  if (!role) {
    return []
  }

  // Cycle detection
  const roleKey = String(roleName)
  if (visited.has(roleKey)) {
    throw new Error(`Circular role inheritance detected: ${roleKey}`)
  }
  visited.add(roleKey)

  const permissions = new Set<string>(role.permissions)

  // Add inherited permissions
  if (role.inherits) {
    for (const inheritedRole of role.inherits) {
      const inheritedPermissions = getRolePermissions(
        config,
        inheritedRole as keyof T,
        new Set(visited)
      )
      for (const perm of inheritedPermissions) {
        permissions.add(perm)
      }
    }
  }

  return Array.from(permissions)
}
