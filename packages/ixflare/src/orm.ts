/**
 * @module ixflare/orm
 * @description EdgeRecord ORM - Type-safe database layer for Cloudflare D1
 * @packageDocumentation
 *
 * This module provides the EdgeRecord ORM for working with Cloudflare D1 databases.
 *
 * @example
 * ```typescript
 * import { defineModel, field, timestamps } from 'ixflare/orm'
 *
 * export const User = defineModel('users', {
 *   id: field.id(),
 *   email: field.string().unique(),
 *   name: field.string(),
 *   role: field.enum(['user', 'admin', 'moderator']).default('user'),
 *   bio: field.text().nullable(),
 *   ...timestamps(),
 * })
 *
 * // Type is automatically inferred
 * export type User = typeof User.$infer
 * ```
 */

// Re-export everything from edge-record
export * from './edge-record'
