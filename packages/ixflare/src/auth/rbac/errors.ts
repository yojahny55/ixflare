/**
 * @module auth/rbac/errors
 * @description RBAC-specific error classes
 * Story 5-4: Authorization with RBAC + Policies
 */

import { ForbiddenError } from '@/errors'

/**
 * Error thrown when user lacks required permissions
 * Extends base ForbiddenError (403 status)
 */
export class PermissionDeniedError extends ForbiddenError {
  readonly requiredPermission?: string
  readonly userPermissions: string[]

  constructor(
    message: string = 'Insufficient permissions',
    requiredPermission?: string,
    userPermissions: string[] = []
  ) {
    // Base message is safe for client
    super(message)
    this.name = 'PermissionDeniedError'
    this.requiredPermission = requiredPermission
    this.userPermissions = userPermissions
  }

  /**
   * Override toJSON to prevent leaking permission details
   * Only include safe error information
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message, // Safe message only
        status: this.status,
        timestamp: this.timestamp,
      },
    }
  }
}

/**
 * Error thrown when required role is missing
 * Extends base ForbiddenError (403 status)
 */
export class RoleDeniedError extends ForbiddenError {
  readonly requiredRole?: string
  readonly userRoles: string[]

  constructor(
    message: string = 'Insufficient role privileges',
    requiredRole?: string,
    userRoles: string[] = []
  ) {
    super(message)
    this.name = 'RoleDeniedError'
    this.requiredRole = requiredRole
    this.userRoles = userRoles
  }

  /**
   * Override toJSON to prevent leaking role details
   * Only include safe error information
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message, // Safe message only
        status: this.status,
        timestamp: this.timestamp,
      },
    }
  }
}
