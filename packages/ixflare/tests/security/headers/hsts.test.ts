/**
 * HSTS Header Builder Tests
 * Story 5-8: Security Headers Auto-Injection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  buildHSTSHeader,
  validateHSTSPreloadRequirements,
  createHttpsRedirectMiddleware,
  DEFAULT_HSTS_CONFIG,
  HSTS_PRELOAD_MIN_MAX_AGE,
} from '@/security/headers/hsts'
import { HSTSConfigError } from '@/security/headers/errors'
import { setEnvironment, clearEnvironment } from '@/auth/cookie/security'

describe('buildHSTSHeader', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('should build HSTS header with defaults when config is true', () => {
    const header = buildHSTSHeader(true)

    expect(header).toBe('max-age=31536000; includeSubDomains')
  })

  it('should build HSTS header with custom maxAge', () => {
    const header = buildHSTSHeader({
      maxAge: 63072000,
    })

    expect(header).toContain('max-age=63072000')
    expect(header).toContain('includeSubDomains') // Default
  })

  it('should build HSTS header with includeSubDomains', () => {
    const header = buildHSTSHeader({
      maxAge: 31536000,
      includeSubDomains: true,
    })

    expect(header).toBe('max-age=31536000; includeSubDomains')
  })

  it('should build HSTS header without includeSubDomains', () => {
    const header = buildHSTSHeader({
      maxAge: 31536000,
      includeSubDomains: false,
    })

    expect(header).toBe('max-age=31536000')
  })

  it('should build HSTS header with preload', () => {
    const header = buildHSTSHeader({
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    })

    expect(header).toBe('max-age=63072000; includeSubDomains; preload')
  })

  it('should not include preload when false', () => {
    const header = buildHSTSHeader({
      maxAge: 63072000,
      includeSubDomains: true,
      preload: false,
    })

    expect(header).not.toContain('preload')
  })

  it('should throw error for negative maxAge', () => {
    expect(() => {
      buildHSTSHeader({ maxAge: -1 })
    }).toThrow(HSTSConfigError)
  })

  it('should warn when preload is true but maxAge is too low', () => {
    buildHSTSHeader({
      maxAge: 1000,
      preload: true,
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Preload requires maxAge >= 31536000')
    )
  })

  it('should warn when preload is true but includeSubDomains is false', () => {
    buildHSTSHeader({
      maxAge: 63072000,
      includeSubDomains: false,
      preload: true,
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Preload requires includeSubDomains to be true')
    )
  })

  it('should not warn when preload requirements are met', () => {
    buildHSTSHeader({
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    })

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('should handle minimal configuration', () => {
    const header = buildHSTSHeader({})

    // Should use defaults
    expect(header).toBe('max-age=31536000; includeSubDomains')
  })

  it('should build header with 2 year maxAge for preload', () => {
    const header = buildHSTSHeader({
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true,
    })

    expect(header).toContain('max-age=63072000')
    expect(header).toContain('preload')
  })
})

describe('validateHSTSPreloadRequirements', () => {
  it('should return true when preload requirements are met', () => {
    const config = {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    }

    expect(validateHSTSPreloadRequirements(config)).toBe(true)
  })

  it('should return true when preload is not requested', () => {
    const config = {
      maxAge: 1000,
      includeSubDomains: false,
      preload: false,
    }

    expect(validateHSTSPreloadRequirements(config)).toBe(true)
  })

  it('should return false when maxAge is too low for preload', () => {
    const config = {
      maxAge: 1000,
      includeSubDomains: true,
      preload: true,
    }

    expect(validateHSTSPreloadRequirements(config)).toBe(false)
  })

  it('should return false when includeSubDomains is false for preload', () => {
    const config = {
      maxAge: 63072000,
      includeSubDomains: false,
      preload: true,
    }

    expect(validateHSTSPreloadRequirements(config)).toBe(false)
  })

  it('should return true for minimum valid preload config', () => {
    const config = {
      maxAge: HSTS_PRELOAD_MIN_MAX_AGE,
      includeSubDomains: true,
      preload: true,
    }

    expect(validateHSTSPreloadRequirements(config)).toBe(true)
  })

  it('should handle undefined maxAge using default', () => {
    const config = {
      includeSubDomains: true,
      preload: true,
    }

    // Default maxAge is 31536000 which meets minimum
    expect(validateHSTSPreloadRequirements(config)).toBe(true)
  })
})

describe('createHttpsRedirectMiddleware', () => {
  beforeEach(() => {
    clearEnvironment()
  })

  afterEach(() => {
    clearEnvironment()
  })

  it('should redirect HTTP to HTTPS in production', async () => {
    setEnvironment('production')

    const middleware = createHttpsRedirectMiddleware()
    const mockRequest = new Request('http://example.com/path?query=1')
    const mockContext = {
      request: mockRequest,
    } as any

    const mockNext = vi.fn()

    const response = await middleware(mockContext, mockNext)

    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(301)
    expect(response.headers.get('Location')).toBe('https://example.com/path?query=1')
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should preserve path and query string during redirect', async () => {
    setEnvironment('production')

    const middleware = createHttpsRedirectMiddleware()
    const mockRequest = new Request('http://example.com/users/123?sort=asc&filter=active')
    const mockContext = {
      request: mockRequest,
    } as any

    const mockNext = vi.fn()

    const response = await middleware(mockContext, mockNext)

    expect(response.headers.get('Location')).toBe(
      'https://example.com/users/123?sort=asc&filter=active'
    )
  })

  it('should not redirect if already HTTPS', async () => {
    setEnvironment('production')

    const middleware = createHttpsRedirectMiddleware()
    const mockRequest = new Request('https://example.com/path')
    const mockContext = {
      request: mockRequest,
    } as any

    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(response).toBeInstanceOf(Response)
    expect(response.status).not.toBe(301)
  })

  it('should allow HTTP in development', async () => {
    setEnvironment('development')

    const middleware = createHttpsRedirectMiddleware()
    const mockRequest = new Request('http://localhost:3000/path')
    const mockContext = {
      request: mockRequest,
    } as any

    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(response.status).not.toBe(301)
  })

  it('should allow HTTP in test environment', async () => {
    setEnvironment('test')

    const middleware = createHttpsRedirectMiddleware()
    const mockRequest = new Request('http://example.com/path')
    const mockContext = {
      request: mockRequest,
    } as any

    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    await middleware(mockContext, mockNext)

    expect(mockNext).toHaveBeenCalled()
  })

  it('should use 301 permanent redirect', async () => {
    setEnvironment('production')

    const middleware = createHttpsRedirectMiddleware()
    const mockRequest = new Request('http://example.com/path')
    const mockContext = {
      request: mockRequest,
    } as any

    const mockNext = vi.fn()

    const response = await middleware(mockContext, mockNext)

    expect(response.status).toBe(301) // Moved Permanently
  })
})

describe('DEFAULT_HSTS_CONFIG', () => {
  it('should have secure defaults', () => {
    expect(DEFAULT_HSTS_CONFIG.maxAge).toBe(31536000) // 1 year
    expect(DEFAULT_HSTS_CONFIG.includeSubDomains).toBe(true)
    expect(DEFAULT_HSTS_CONFIG.preload).toBe(false) // Not enabled by default
  })

  it('should meet minimum security requirements', () => {
    expect(DEFAULT_HSTS_CONFIG.maxAge).toBeGreaterThanOrEqual(HSTS_PRELOAD_MIN_MAX_AGE)
  })
})

describe('HSTS Security Tests', () => {
  it('should enforce HTTPS with long-term caching', () => {
    const header = buildHSTSHeader({
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
    })

    expect(header).toContain('max-age=63072000')
    expect(header).toContain('includeSubDomains')
  })

  it('should protect all subdomains by default', () => {
    const header = buildHSTSHeader(true)

    expect(header).toContain('includeSubDomains')
  })

  it('should prevent SSL stripping with permanent redirect', async () => {
    setEnvironment('production')
    const middleware = createHttpsRedirectMiddleware()
    const mockRequest = new Request('http://example.com/login')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn()

    const response = await middleware(mockContext, mockNext)

    expect(response.status).toBe(301) // Permanent redirect
    expect(response.headers.get('Location')).toContain('https://')
  })
})
