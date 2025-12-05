import { describe, it, expect } from 'vitest'
import { AppError, AuthError, ValidationError, NotFoundError, ForbiddenError, ConflictError, HttpError } from '../../src/errors'

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with code and status', () => {
      const error = new AppError('TEST.ERROR', 'Test message', 400)

      expect(error.code).toBe('TEST.ERROR')
      expect(error.message).toBe('Test message')
      expect(error.status).toBe(400)
      expect(error.timestamp).toBeDefined()
    })

    it('should serialize to JSON correctly', () => {
      const error = new AppError('TEST.ERROR', 'Test message', 400)
      const json = error.toJSON()

      expect(json.error.code).toBe('TEST.ERROR')
      expect(json.error.message).toBe('Test message')
      expect(json.error.status).toBe(400)
    })
  })

  describe('AuthError', () => {
    it('should prefix code with AUTH', () => {
      const error = new AuthError('TOKEN_EXPIRED', 'Token has expired')

      expect(error.code).toBe('AUTH.TOKEN_EXPIRED')
      expect(error.status).toBe(401)
    })
  })

  describe('ValidationError', () => {
    it('should include field errors', () => {
      const errors = [{ field: 'email', message: 'Invalid email' }]
      const error = new ValidationError('Validation failed', errors)

      expect(error.status).toBe(422)
      expect(error.errors).toEqual(errors)
    })
  })

  describe('NotFoundError', () => {
    it('should create 404 error with resource name', () => {
      const error = new NotFoundError('User', 123)

      expect(error.status).toBe(404)
      expect(error.message).toContain('User')
      expect(error.message).toContain('123')
    })
  })

  describe('ForbiddenError', () => {
    it('should create 403 error', () => {
      const error = new ForbiddenError()

      expect(error.status).toBe(403)
      expect(error.code).toBe('FORBIDDEN')
    })
  })

  describe('ConflictError', () => {
    it('should create 409 error', () => {
      const error = new ConflictError('Email already exists')

      expect(error.status).toBe(409)
    })
  })

  describe('HttpError', () => {
    it('should create error with custom status', () => {
      const error = new HttpError(429, 'RATE_LIMITED', 'Too many requests')

      expect(error.status).toBe(429)
      expect(error.code).toBe('RATE_LIMITED')
    })
  })
})
