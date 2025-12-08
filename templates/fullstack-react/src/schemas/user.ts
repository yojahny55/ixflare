/**
 * User Validation Schemas
 * Shared between client and server for consistent validation
 */
import { z } from 'zod'

/**
 * Schema for creating a new user
 */
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
})

/**
 * Schema for updating an existing user
 */
export const updateUserSchema = createUserSchema.partial()

/**
 * Schema for user ID parameter
 */
export const userIdSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
})

/**
 * Schema for user query parameters
 */
export const userQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'email', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * Full user schema (for API responses)
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
})

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type UserIdInput = z.infer<typeof userIdSchema>
export type UserQueryInput = z.infer<typeof userQuerySchema>
export type User = z.infer<typeof userSchema>
