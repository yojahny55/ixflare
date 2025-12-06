/**
 * @module body-parser
 * @description Request body parsing utilities with content-type detection and Zod validation
 */

import type { ZodSchema, ZodError } from 'zod'
import { ValidationError } from '@/errors'

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
 * @returns Parsed body as JSON object, FormData, or text
 *
 * @example
 * ```typescript
 * const body = await parseBody(request)
 * if (body instanceof FormData) {
 *   const email = body.get('email')
 * } else {
 *   // JSON object or text
 * }
 * ```
 */
export async function parseBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return request.json()
  }
  if (contentType.includes('form')) {
    return request.formData()
  }
  return request.text()
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
 * @throws {ValidationError} When validation fails with detailed field errors
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   email: z.string().email(),
 *   name: z.string().min(2),
 * })
 *
 * const data = await parseJson(request, schema)
 * // data is typed: { email: string, name: string }
 * ```
 */
export async function parseJson<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  const body = await request.json()
  const result = schema.safeParse(body)

  if (!result.success) {
    throw new ValidationError(
      'Request body validation failed',
      formatZodErrors(result.error)
    )
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
export async function parseFormData<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  const formData = await request.formData()
  const body = formDataToObject(formData)
  const result = schema.safeParse(body)

  if (!result.success) {
    throw new ValidationError(
      'Form data validation failed',
      formatZodErrors(result.error)
    )
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
export function validateFile(
  file: File,
  options: FileValidationOptions
): void {
  if (options.maxSize && file.size > options.maxSize) {
    throw new ValidationError(
      `File size exceeds limit of ${options.maxSize} bytes`,
      [{ field: file.name, message: 'File too large' }]
    )
  }
  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    throw new ValidationError(
      `File type ${file.type} not allowed`,
      [{ field: file.name, message: 'Invalid file type' }]
    )
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
  // Use type assertion since FormData.entries() is a standard Web API but types might be incomplete
  const entries = (formData as any).entries() as IterableIterator<[string, FormDataEntryValue]>
  for (const [key, value] of entries) {
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
  }
  return obj
}

/**
 * Transform Zod validation errors to ValidationError format
 * Converts Zod's path arrays to dot notation (e.g., ['user', 'email'] → 'user.email')
 */
function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  // Zod uses 'issues' not 'errors' for the array of validation problems
  if (!error || !error.issues || !Array.isArray(error.issues)) {
    return [{ field: 'unknown', message: error?.message || 'Validation failed' }]
  }

  return error.issues.map(e => ({
    field: e.path.join('.'),
    message: e.message,
  }))
}
