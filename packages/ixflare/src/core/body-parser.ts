/**
 * @module body-parser
 * @description Request body parsing utilities with content-type detection and Zod validation
 */

import type { ZodSchema, ZodError } from 'zod'
import { ValidationError } from '@/errors'

/**
 * Options for parsing request body
 */
export interface ParseBodyOptions {
  /** Clone request before reading body (for multiple reads) */
  clone?: boolean
  /** Maximum body size in bytes (throws ValidationError if exceeded) */
  maxSize?: number
}

/**
 * Automatically parse request body based on Content-Type header
 *
 * Supports:
 * - application/json → parsed JSON object
 * - application/x-www-form-urlencoded → FormData
 * - multipart/form-data → FormData (with file support)
 * - fallback → raw text
 *
 * @param request - The incoming Request object
 * @param options - Optional parsing options (clone, maxSize)
 * @returns Parsed body as JSON object, FormData, or text
 * @throws {ValidationError} When body size exceeds maxSize limit
 *
 * @example
 * ```typescript
 * // Basic usage
 * const body = await parseBody(request)
 * if (body instanceof FormData) {
 *   const email = body.get('email')
 * }
 *
 * // With options
 * const body = await parseBody(request, {
 *   clone: true,           // Clone for multiple reads
 *   maxSize: 1024 * 1024   // 1MB limit
 * })
 * ```
 */
export async function parseBody(
  request: Request,
  options: ParseBodyOptions = {}
): Promise<unknown> {
  const { clone = false, maxSize } = options
  const targetRequest = clone ? request.clone() : request

  // Check Content-Length header for size limit (if available)
  if (maxSize !== undefined) {
    const contentLength = targetRequest.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      throw new ValidationError(`Request body size exceeds limit of ${maxSize} bytes`, [
        { field: 'body', message: 'Request body too large' },
      ])
    }
  }

  const contentType = targetRequest.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return targetRequest.json()
  }
  if (contentType.includes('form')) {
    return targetRequest.formData()
  }
  return targetRequest.text()
}

/**
 * Parse and validate JSON request body using Zod schema
 *
 * Uses safeParse for graceful error handling without try/catch.
 * Throws ValidationError with field-level errors on validation failure.
 *
 * @param request - The incoming Request object
 * @param schema - Zod schema for validation
 * @returns Fully typed validated data
 * @throws {ValidationError} When JSON parsing fails or validation fails with detailed field errors
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 * import { parseJson } from 'ixflare'
 *
 * const schema = z.object({
 *   email: z.string().email(),
 *   name: z.string().min(2),
 * })
 *
 * const data = await parseJson(request, schema)
 * // data is typed: { email: string, name: string }
 * ```
 */
export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body', [
      { field: 'body', message: error instanceof Error ? error.message : 'Failed to parse JSON' },
    ])
  }

  const result = schema.safeParse(body)

  if (!result.success) {
    throw new ValidationError('Request body validation failed', formatZodErrors(result.error))
  }

  return result.data
}

/**
 * Parse and validate form data request body using Zod schema
 *
 * Converts FormData to plain object before validation.
 * Handles multiple values with same key as arrays.
 *
 * @param request - The incoming Request object
 * @param schema - Zod schema for validation
 * @returns Fully typed validated data
 * @throws {ValidationError} When validation fails with detailed field errors
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   email: z.string().email(),
 *   subscribe: z.boolean(),
 * })
 *
 * const data = await parseFormData(request, schema)
 * ```
 */
export async function parseFormData<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const formData = await request.formData()
  const body = formDataToObject(formData)
  const result = schema.safeParse(body)

  if (!result.success) {
    throw new ValidationError('Form data validation failed', formatZodErrors(result.error))
  }

  return result.data
}

/**
 * Extract a single file from FormData
 *
 * @param formData - The FormData object
 * @param key - The field name
 * @returns File if found, null otherwise
 *
 * @example
 * ```typescript
 * const formData = await request.formData()
 * const avatar = getFile(formData, 'avatar')
 * if (avatar) {
 *   const buffer = await avatar.arrayBuffer()
 * }
 * ```
 */
export function getFile(formData: FormData, key: string): File | null {
  const value = formData.get(key)
  return value instanceof File ? value : null
}

/**
 * Extract multiple files from FormData (same field name)
 *
 * @param formData - The FormData object
 * @param key - The field name
 * @returns Array of File objects
 *
 * @example
 * ```typescript
 * const formData = await request.formData()
 * const attachments = getFiles(formData, 'attachments')
 * for (const file of attachments) {
 *   console.log(file.name, file.size)
 * }
 * ```
 */
export function getFiles(formData: FormData, key: string): File[] {
  return formData.getAll(key).filter((v): v is File => v instanceof File)
}

/**
 * File validation options
 */
export interface FileValidationOptions {
  /** Maximum file size in bytes */
  maxSize?: number
  /** Allowed MIME types (e.g., ['image/png', 'image/jpeg']) */
  allowedTypes?: string[]
}

/**
 * Validate a file against size and type constraints
 *
 * @param file - The File object to validate
 * @param options - Validation constraints
 * @throws {ValidationError} When file validation fails
 *
 * @example
 * ```typescript
 * const file = getFile(formData, 'avatar')
 * if (file) {
 *   validateFile(file, {
 *     maxSize: 5 * 1024 * 1024, // 5MB
 *     allowedTypes: ['image/png', 'image/jpeg']
 *   })
 * }
 * ```
 */
export function validateFile(file: File, options: FileValidationOptions): void {
  if (options.maxSize && file.size > options.maxSize) {
    throw new ValidationError(`File size exceeds limit of ${options.maxSize} bytes`, [
      { field: file.name, message: 'File too large' },
    ])
  }
  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    throw new ValidationError(`File type ${file.type} not allowed`, [
      { field: file.name, message: 'Invalid file type' },
    ])
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Convert FormData to plain object
 * Handles multiple values with same key as arrays
 */
function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  // FormData.forEach is well-typed and available in all Workers environments
  formData.forEach((value, key) => {
    // Handle multiple values with same key
    const existing = obj[key]
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        obj[key] = [existing, value]
      }
    } else {
      obj[key] = value
    }
  })
  return obj
}

/**
 * Transform Zod validation errors to ValidationError format
 * Converts Zod's path arrays to dot notation (e.g., ['user', 'email'] → 'user.email')
 * Root-level errors (empty path) use '_root' as field name
 */
export function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  // Zod uses 'issues' not 'errors' for the array of validation problems
  if (!error || !error.issues || !Array.isArray(error.issues)) {
    return [{ field: '_root', message: error?.message || 'Validation failed' }]
  }

  return error.issues.map((e) => ({
    // Use '_root' for root-level validation errors (empty path array)
    field: e.path.length > 0 ? e.path.join('.') : '_root',
    message: e.message,
  }))
}
