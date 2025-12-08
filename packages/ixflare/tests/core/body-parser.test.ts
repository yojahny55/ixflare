/**
 * @fileoverview Tests for body parsing utilities
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  parseBody,
  parseJson,
  parseFormData,
  getFile,
  getFiles,
  validateFile,
} from '@/core/body-parser'
import { ValidationError } from '@/errors'

describe('parseBody', () => {
  it('should parse JSON body when content-type is application/json', async () => {
    const body = { email: 'test@example.com', name: 'Test User' }
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    const result = await parseBody(request)
    expect(result).toEqual(body)
  })

  it('should parse form data when content-type is application/x-www-form-urlencoded', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=test@example.com&name=Test+User',
    })

    const result = await parseBody(request)
    expect(result).toBeInstanceOf(FormData)

    const formData = result as FormData
    expect(formData.get('email')).toBe('test@example.com')
    expect(formData.get('name')).toBe('Test User')
  })

  it('should parse form data when content-type is multipart/form-data', async () => {
    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('name', 'Test User')

    const request = new Request('https://example.com', {
      method: 'POST',
      body: formData,
    })

    const result = await parseBody(request)
    expect(result).toBeInstanceOf(FormData)

    const parsedFormData = result as FormData
    expect(parsedFormData.get('email')).toBe('test@example.com')
    expect(parsedFormData.get('name')).toBe('Test User')
  })

  it('should return text when content-type is unknown', async () => {
    const text = 'plain text body'
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: text,
    })

    const result = await parseBody(request)
    expect(result).toBe(text)
  })

  it('should return text when content-type is missing', async () => {
    const text = 'plain text body'
    const request = new Request('https://example.com', {
      method: 'POST',
      body: text,
    })

    const result = await parseBody(request)
    expect(result).toBe(text)
  })

  it('should handle empty body', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })

    const result = await parseBody(request)
    expect(result).toEqual({})
  })

  it('should clone request when clone option is true', async () => {
    const body = { test: 'value' }
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    // First read with clone
    const result1 = await parseBody(request.clone(), { clone: true })
    expect(result1).toEqual(body)

    // Original request should still be readable
    const result2 = await request.json()
    expect(result2).toEqual(body)
  })

  it('should throw ValidationError when body exceeds maxSize', async () => {
    const largeBody = 'x'.repeat(1000)
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'content-length': '1000',
      },
      body: largeBody,
    })

    await expect(parseBody(request, { maxSize: 500 })).rejects.toThrow(ValidationError)
  })

  it('should pass when body is within maxSize limit', async () => {
    const body = { test: 'value' }
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '17',
      },
      body: JSON.stringify(body),
    })

    const result = await parseBody(request, { maxSize: 1000 })
    expect(result).toEqual(body)
  })
})

describe('parseJson', () => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
    age: z.number().optional(),
  })

  it('should parse and validate valid JSON', async () => {
    const body = { email: 'test@example.com', name: 'Test User', age: 25 }
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    const result = await parseJson(request, schema)
    expect(result).toEqual(body)
  })

  it('should throw ValidationError when validation fails', async () => {
    const body = { email: 'invalid-email', name: 'T' }
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    await expect(parseJson(request, schema)).rejects.toThrow(ValidationError)
  })

  it('should provide field-level errors', async () => {
    const body = { email: 'invalid-email', name: 'T' }
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    try {
      await parseJson(request, schema)
      expect.fail('Should have thrown ValidationError')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      expect(validationError.errors).toHaveLength(2)
      expect(validationError.errors[0].field).toBe('email')
      expect(validationError.errors[1].field).toBe('name')
    }
  })

  it('should handle nested object validation', async () => {
    const nestedSchema = z.object({
      user: z.object({
        email: z.string().email(),
        profile: z.object({
          age: z.number().min(18),
        }),
      }),
    })

    const body = { user: { email: 'invalid', profile: { age: 16 } } }
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    try {
      await parseJson(request, nestedSchema)
      expect.fail('Should have thrown ValidationError')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      expect(validationError.errors.some((e) => e.field === 'user.email')).toBe(true)
      expect(validationError.errors.some((e) => e.field === 'user.profile.age')).toBe(true)
    }
  })

  it('should throw ValidationError when body is not valid JSON', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })

    try {
      await parseJson(request, schema)
      expect.fail('Should have thrown ValidationError')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      expect(validationError.message).toBe('Invalid JSON in request body')
      expect(validationError.errors[0].field).toBe('body')
    }
  })
})

describe('parseFormData', () => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
    subscribe: z.string().optional(),
  })

  it('should parse and validate form data', async () => {
    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('name', 'Test User')
    formData.append('subscribe', 'true')

    const request = new Request('https://example.com', {
      method: 'POST',
      body: formData,
    })

    const result = await parseFormData(request, schema)
    expect(result).toEqual({
      email: 'test@example.com',
      name: 'Test User',
      subscribe: 'true',
    })
  })

  it('should handle URL-encoded form data', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=test@example.com&name=Test+User',
    })

    const result = await parseFormData(request, schema)
    expect(result.email).toBe('test@example.com')
    expect(result.name).toBe('Test User')
  })

  it('should throw ValidationError when validation fails', async () => {
    const formData = new FormData()
    formData.append('email', 'invalid-email')
    formData.append('name', 'T')

    const request = new Request('https://example.com', {
      method: 'POST',
      body: formData,
    })

    await expect(parseFormData(request, schema)).rejects.toThrow(ValidationError)
  })

  it('should handle multiple values with same key as array', async () => {
    const arraySchema = z.object({
      tags: z.array(z.string()),
    })

    const formData = new FormData()
    formData.append('tags', 'javascript')
    formData.append('tags', 'typescript')
    formData.append('tags', 'cloudflare')

    const request = new Request('https://example.com', {
      method: 'POST',
      body: formData,
    })

    const result = await parseFormData(request, arraySchema)
    expect(result.tags).toEqual(['javascript', 'typescript', 'cloudflare'])
  })

  it('should provide field-level errors', async () => {
    const formData = new FormData()
    formData.append('email', 'invalid')
    formData.append('name', 'T')

    const request = new Request('https://example.com', {
      method: 'POST',
      body: formData,
    })

    try {
      await parseFormData(request, schema)
      expect.fail('Should have thrown ValidationError')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      expect(validationError.errors).toHaveLength(2)
      expect(validationError.errors[0].field).toBe('email')
      expect(validationError.errors[1].field).toBe('name')
    }
  })
})

describe('getFile', () => {
  it('should extract File from FormData', () => {
    const formData = new FormData()
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    formData.append('avatar', file)

    const result = getFile(formData, 'avatar')
    expect(result).toBeInstanceOf(File)
    expect(result?.name).toBe('test.txt')
    expect(result?.type).toBe('text/plain')
  })

  it('should return null when field does not exist', () => {
    const formData = new FormData()
    const result = getFile(formData, 'nonexistent')
    expect(result).toBeNull()
  })

  it('should return null when field is not a File', () => {
    const formData = new FormData()
    formData.append('text', 'not a file')

    const result = getFile(formData, 'text')
    expect(result).toBeNull()
  })

  it('should return first file when multiple files with same key', () => {
    const formData = new FormData()
    const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' })
    const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' })
    formData.append('files', file1)
    formData.append('files', file2)

    const result = getFile(formData, 'files')
    expect(result).toBeInstanceOf(File)
    expect(result?.name).toBe('test1.txt')
  })
})

describe('getFiles', () => {
  it('should extract array of Files from FormData', () => {
    const formData = new FormData()
    const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' })
    const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' })
    formData.append('attachments', file1)
    formData.append('attachments', file2)

    const result = getFiles(formData, 'attachments')
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('test1.txt')
    expect(result[1].name).toBe('test2.txt')
  })

  it('should return empty array when field does not exist', () => {
    const formData = new FormData()
    const result = getFiles(formData, 'nonexistent')
    expect(result).toEqual([])
  })

  it('should filter out non-File values', () => {
    const formData = new FormData()
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    formData.append('mixed', 'text value')
    formData.append('mixed', file)

    const result = getFiles(formData, 'mixed')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('test.txt')
  })

  it('should handle single file', () => {
    const formData = new FormData()
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    formData.append('document', file)

    const result = getFiles(formData, 'document')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('test.txt')
  })
})

describe('validateFile', () => {
  it('should pass validation for valid file', () => {
    const file = new File(['x'.repeat(1000)], 'test.txt', { type: 'text/plain' })

    expect(() => {
      validateFile(file, {
        maxSize: 2000,
        allowedTypes: ['text/plain', 'text/html'],
      })
    }).not.toThrow()
  })

  it('should throw ValidationError when file size exceeds limit', () => {
    const file = new File(['x'.repeat(2000)], 'large.txt', { type: 'text/plain' })

    expect(() => {
      validateFile(file, { maxSize: 1000 })
    }).toThrow(ValidationError)
  })

  it('should throw ValidationError when file type not allowed', () => {
    const file = new File(['content'], 'test.exe', { type: 'application/exe' })

    expect(() => {
      validateFile(file, {
        allowedTypes: ['image/png', 'image/jpeg'],
      })
    }).toThrow(ValidationError)
  })

  it('should include file name in error details', () => {
    const file = new File(['x'.repeat(2000)], 'large-file.pdf', { type: 'application/pdf' })

    try {
      validateFile(file, { maxSize: 1000 })
      expect.fail('Should have thrown ValidationError')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      expect(validationError.errors[0].field).toBe('large-file.pdf')
      expect(validationError.errors[0].message).toBe('File too large')
    }
  })

  it('should validate both size and type', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })

    expect(() => {
      validateFile(file, {
        maxSize: 100,
        allowedTypes: ['text/plain'],
      })
    }).not.toThrow()
  })

  it('should not throw when no validation options provided', () => {
    const file = new File(['x'.repeat(10000)], 'huge.txt', { type: 'text/plain' })

    expect(() => {
      validateFile(file, {})
    }).not.toThrow()
  })
})

describe('Integration Tests', () => {
  it('should handle full request flow with JSON validation', async () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2),
    })

    const body = { email: 'test@example.com', name: 'Test User' }
    const request = new Request('https://example.com/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    const result = await parseJson(request, schema)
    expect(result).toEqual(body)
  })

  it('should handle file upload with validation', async () => {
    const formData = new FormData()
    const file = new File(['x'.repeat(1000)], 'avatar.png', { type: 'image/png' })
    formData.append('avatar', file)
    formData.append('email', 'test@example.com')

    const request = new Request('https://example.com/api/upload', {
      method: 'POST',
      body: formData,
    })

    const parsedFormData = (await parseBody(request)) as FormData
    const uploadedFile = getFile(parsedFormData, 'avatar')

    expect(uploadedFile).not.toBeNull()
    expect(() => {
      validateFile(uploadedFile!, {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/png', 'image/jpeg'],
      })
    }).not.toThrow()
  })

  it('should handle validation error with correct format', async () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2),
    })

    const body = { email: 'invalid', name: 'T' }
    const request = new Request('https://example.com/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    try {
      await parseJson(request, schema)
      expect.fail('Should have thrown ValidationError')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError

      // Verify error response format
      const json = validationError.toJSON()
      expect(json.error.code).toBe('VALIDATION.FAILED')
      expect(json.error.status).toBe(422)
      expect(json.error.timestamp).toBeDefined()
      expect(json.error.errors).toHaveLength(2)
    }
  })

  it('should handle root-level validation errors with _root field name', async () => {
    // Schema that validates the root value (not properties)
    const stringSchema = z.string().min(5)

    const request = new Request('https://example.com/api/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify('ab'), // Too short
    })

    try {
      await parseJson(request, stringSchema)
      expect.fail('Should have thrown ValidationError')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      // Root-level errors should use '_root' as field name
      expect(validationError.errors[0].field).toBe('_root')
    }
  })

  it('should handle empty FormData with required schema fields', async () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string(),
    })

    const formData = new FormData()
    // Empty - no fields added

    const request = new Request('https://example.com/api/form', {
      method: 'POST',
      body: formData,
    })

    await expect(parseFormData(request, schema)).rejects.toThrow(ValidationError)
  })
})
