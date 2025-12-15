/**
 * Cookie Prefix Validation Tests
 * Story 5-7: Secure Cookie Handling
 */

import { describe, it, expect } from 'vitest'
import { validateCookiePrefix } from '@/auth/cookie/prefix-validator'
import { CookieValidationError } from '@/auth/cookie/errors'
import type { CookieOptions } from '@/auth/cookie/types'

describe('validateCookiePrefix - __Host- prefix', () => {
  it('should pass validation with correct __Host- attributes', () => {
    expect(() => {
      validateCookiePrefix('__Host-session', {
        secure: true,
        path: '/',
      })
    }).not.toThrow()
  })

  it('should pass validation with __Host- and no path specified', () => {
    expect(() => {
      validateCookiePrefix('__Host-token', {
        secure: true,
        // path not specified - will default to '/'
      })
    }).not.toThrow()
  })

  it('should reject __Host- without secure attribute', () => {
    expect(() => {
      validateCookiePrefix('__Host-session', {
        secure: false,
        path: '/',
      })
    }).toThrow(CookieValidationError)

    try {
      validateCookiePrefix('__Host-session', {
        secure: false,
        path: '/',
      })
    } catch (error) {
      expect(error).toBeInstanceOf(CookieValidationError)
      expect((error as CookieValidationError).code).toBe('COOKIE.PREFIX_HOST_SECURE_REQUIRED')
      expect((error as CookieValidationError).message).toContain('Secure')
    }
  })

  it('should reject __Host- with domain attribute', () => {
    expect(() => {
      validateCookiePrefix('__Host-session', {
        secure: true,
        path: '/',
        domain: 'example.com',
      })
    }).toThrow(CookieValidationError)

    try {
      validateCookiePrefix('__Host-session', {
        secure: true,
        path: '/',
        domain: 'example.com',
      })
    } catch (error) {
      expect(error).toBeInstanceOf(CookieValidationError)
      expect((error as CookieValidationError).code).toBe('COOKIE.PREFIX_HOST_NO_DOMAIN')
      expect((error as CookieValidationError).message).toContain('Domain')
    }
  })

  it('should reject __Host- with path not equal to /', () => {
    expect(() => {
      validateCookiePrefix('__Host-session', {
        secure: true,
        path: '/app',
      })
    }).toThrow(CookieValidationError)

    try {
      validateCookiePrefix('__Host-session', {
        secure: true,
        path: '/app',
      })
    } catch (error) {
      expect(error).toBeInstanceOf(CookieValidationError)
      expect((error as CookieValidationError).code).toBe('COOKIE.PREFIX_HOST_PATH_ROOT')
      expect((error as CookieValidationError).message).toContain('Path="/"')
    }
  })

  it('should handle __Host- with empty path as invalid', () => {
    expect(() => {
      validateCookiePrefix('__Host-session', {
        secure: true,
        path: '',
      })
    }).toThrow(CookieValidationError)
  })
})

describe('validateCookiePrefix - __Secure- prefix', () => {
  it('should pass validation with correct __Secure- attributes', () => {
    expect(() => {
      validateCookiePrefix('__Secure-token', {
        secure: true,
      })
    }).not.toThrow()
  })

  it('should pass __Secure- with domain attribute', () => {
    expect(() => {
      validateCookiePrefix('__Secure-token', {
        secure: true,
        domain: 'example.com',
      })
    }).not.toThrow()
  })

  it('should pass __Secure- with any path', () => {
    expect(() => {
      validateCookiePrefix('__Secure-token', {
        secure: true,
        path: '/api',
      })
    }).not.toThrow()
  })

  it('should reject __Secure- without secure attribute', () => {
    expect(() => {
      validateCookiePrefix('__Secure-token', {
        secure: false,
      })
    }).toThrow(CookieValidationError)

    try {
      validateCookiePrefix('__Secure-token', {
        secure: false,
      })
    } catch (error) {
      expect(error).toBeInstanceOf(CookieValidationError)
      expect((error as CookieValidationError).code).toBe('COOKIE.PREFIX_SECURE_REQUIRED')
      expect((error as CookieValidationError).message).toContain('Secure')
    }
  })
})

describe('validateCookiePrefix - no prefix', () => {
  it('should pass validation for regular cookie names', () => {
    expect(() => {
      validateCookiePrefix('session', {
        secure: false,
        domain: 'example.com',
        path: '/app',
      })
    }).not.toThrow()
  })

  it('should not enforce secure for regular cookies', () => {
    expect(() => {
      validateCookiePrefix('preferences', {
        secure: false,
        httpOnly: false,
      })
    }).not.toThrow()
  })
})

describe('validateCookiePrefix - edge cases', () => {
  it('should be case-sensitive for prefix matching', () => {
    // __host- (lowercase) should not trigger __Host- validation
    expect(() => {
      validateCookiePrefix('__host-session', {
        secure: false,
        domain: 'example.com',
      })
    }).not.toThrow()
  })

  it('should handle prefix-like names that are not exact matches', () => {
    expect(() => {
      validateCookiePrefix('__HostName', {
        secure: false,
      })
    }).not.toThrow()

    expect(() => {
      validateCookiePrefix('my__Host-cookie', {
        secure: false,
      })
    }).not.toThrow()
  })

  it('should validate multiple attributes simultaneously for __Host-', () => {
    // All three violations at once
    expect(() => {
      validateCookiePrefix('__Host-session', {
        secure: false, // violation 1
        domain: 'example.com', // violation 2
        path: '/app', // violation 3
      })
    }).toThrow(CookieValidationError)

    // Should throw on first violation (secure)
    try {
      validateCookiePrefix('__Host-session', {
        secure: false,
        domain: 'example.com',
        path: '/app',
      })
    } catch (error) {
      expect((error as CookieValidationError).code).toBe('COOKIE.PREFIX_HOST_SECURE_REQUIRED')
    }
  })
})

describe('Security: Prefix Validation Defense-in-Depth', () => {
  it('should prevent subdomain cookie injection with __Host-', () => {
    // Attacker tries to set cookie from subdomain with domain attribute
    expect(() => {
      validateCookiePrefix('__Host-session', {
        secure: true,
        domain: '.example.com', // Attacker's attempt
        path: '/',
      })
    }).toThrow(CookieValidationError)
  })

  it('should enforce path restriction with __Host-', () => {
    // Attacker tries to set cookie with specific path
    expect(() => {
      validateCookiePrefix('__Host-session', {
        secure: true,
        path: '/admin', // Attacker's attempt
      })
    }).toThrow(CookieValidationError)
  })

  it('should prevent insecure __Host- cookies', () => {
    // Attacker tries to set insecure cookie with __Host- prefix
    expect(() => {
      validateCookiePrefix('__Host-session', {
        secure: false,
        path: '/',
      })
    }).toThrow(CookieValidationError)
  })
})
