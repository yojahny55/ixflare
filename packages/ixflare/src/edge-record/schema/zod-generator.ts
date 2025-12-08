/**
 * @module edge-record/schema/zod-generator
 * @description Generate Zod schemas from EdgeRecord model definitions
 */

import { z } from 'zod'
import type { FieldBuilder } from './field'
import type { Model, SchemaDefinition } from './types'

/**
 * Convert a single field builder to a Zod schema
 *
 * @param builder The field builder to convert
 * @returns Zod schema for the field
 */
export function toZodField(builder: FieldBuilder<unknown>): z.ZodTypeAny {
  const { config } = builder
  let zodSchema: z.ZodTypeAny

  // Base type mapping
  switch (config.type) {
    case 'id':
    case 'integer': {
      zodSchema = z.number().int()
      if (config.min !== undefined) {
        zodSchema = (zodSchema as z.ZodNumber).min(config.min)
      }
      if (config.max !== undefined) {
        zodSchema = (zodSchema as z.ZodNumber).max(config.max)
      }
      if (config.positive) {
        zodSchema = (zodSchema as z.ZodNumber).positive()
      }
      break
    }

    case 'decimal': {
      zodSchema = z.number()
      if (config.positive) {
        zodSchema = (zodSchema as z.ZodNumber).positive()
      }
      if (config.min !== undefined) {
        zodSchema = (zodSchema as z.ZodNumber).min(config.min)
      }
      if (config.max !== undefined) {
        zodSchema = (zodSchema as z.ZodNumber).max(config.max)
      }
      break
    }

    case 'string':
    case 'text': {
      zodSchema = z.string()
      if (config.min !== undefined) {
        zodSchema = (zodSchema as z.ZodString).min(config.min)
      }
      if (config.max !== undefined) {
        zodSchema = (zodSchema as z.ZodString).max(config.max)
      }
      break
    }

    case 'boolean': {
      zodSchema = z.boolean()
      break
    }

    case 'datetime': {
      zodSchema = z.date()
      break
    }

    case 'json': {
      // JSON fields accept any valid JSON value
      zodSchema = z.unknown()
      break
    }

    case 'enum': {
      if (config.values && config.values.length > 0) {
        // Zod enum requires at least 2 values, but we'll handle single value edge case
        if (config.values.length === 1) {
          zodSchema = z.literal(config.values[0])
        } else {
          zodSchema = z.enum(config.values as [string, ...string[]])
        }
      } else {
        zodSchema = z.string()
      }
      break
    }

    default: {
      zodSchema = z.unknown()
    }
  }

  // Handle nullable
  if (config.nullable) {
    zodSchema = zodSchema.nullable()
  }

  // Handle default values (only static values, not functions)
  if (config.default !== undefined && typeof config.default !== 'function') {
    zodSchema = zodSchema.default(config.default)
  }

  return zodSchema
}

/**
 * Generate a Zod schema from a model definition
 *
 * @param model The model to generate Zod schema for
 * @returns Zod object schema
 *
 * @example
 * ```typescript
 * const User = defineModel('users', {
 *   email: field.string().unique(),
 *   name: field.string().min(2).max(100),
 * })
 *
 * const userSchema = generateZodSchema(User)
 * // Equivalent to:
 * // z.object({
 * //   email: z.string(),
 * //   name: z.string().min(2).max(100),
 * // })
 *
 * // Use for validation
 * const result = userSchema.safeParse(input)
 * ```
 */
export function generateZodSchema(
  model: Model<SchemaDefinition>
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const { $schema } = model
  const zodFields: Record<string, z.ZodTypeAny> = {}

  // Convert each field to Zod schema
  for (const [fieldName, builder] of Object.entries($schema)) {
    zodFields[fieldName] = toZodField(builder)
  }

  return z.object(zodFields)
}
