/**
 * @module auth/rbac
 * @description Role-Based Access Control (RBAC) and Policy-based authorization
 * Story 5-4: Authorization with RBAC + Policies
 *
 * Hybrid RBAC + Policies approach:
 * - RBAC for broad role-based access (admin, moderator, user)
 * - Policies for resource-level rules (ownership, company-specific)
 */

export * from './types'
export * from './errors'
export * from './roles'
export * from './permissions'
export * from './policies'
export * from './middleware'
export * from './session-integration'
