/**
 * Security Enforcement Tests
 * Story 5-7: Secure Cookie Handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  enforceSecureDefaults,
  detectEnvironment,
  validateSecurityRequirements,
} from '@/auth/cookie/security'
import { CookieSecurityError } from '@/auth/cookie/errors'
import type { CookieOptions } from '@/auth/cookie/types'

describe('detectEnvironment', () => {
  it('should detect environment correctly', () => {
    const env = detectEnvironment()

    // In test context, should detect 'test' from NODE_ENV
    // In actual Workers runtime, would default to 'production'
    expect(['production', 'development', 'test']).toContain(env)
  })

  // Note: Environment detection varies by runtime
  // These tests verify the function works, actual environment depends on test setup
})

describe('enforceSecureDefaults - Production', () => {
  it('should enforce secure=true in production', () => {
    const options: CookieOptions = {
      secure: false, // Insecure attempt
    }

    const enforced = enforceSecureDefaults('session', options, 'production')

    expect(enforced.secure).toBe(true)
  })

  it('should keep secure=true in production', () => {
    const options: CookieOptions = {
      secure: true,
    }

    const enforced = enforceSecureDefaults('session', options, 'production')

    expect(enforced.secure).toBe(true)
  })

  it('should set secure=true if undefined in production', () => {
    const options: CookieOptions = {}

    const enforced = enforceSecureDefaults('session', options, 'production')

    expect(enforced.secure).toBe(true)
  })

  it('should log warning when overriding insecure cookie in production', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const options: CookieOptions = { secure: false }
    enforceSecureDefaults('session', options, 'production')

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[COOKIE SECURITY]')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Overriding secure=false to secure=true')
    )

    consoleSpy.mockRestore()
  })

  it('should warn about httpOnly=false for auth cookies in production', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const options: CookieOptions = {
      secure: true,
      httpOnly: false,
    }
    enforceSecureDefaults('session', options, 'production')

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[COOKIE SECURITY]')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('httpOnly=false')
    )

    consoleSpy.mockRestore()
  })

  it('should not modify other options in production', () => {
    const options: CookieOptions = {
      secure: true,
      httpOnly: false,
      sameSite: 'strict',
      maxAge: 3600,
      path: '/api',
      domain: 'example.com',
    }

    const enforced = enforceSecureDefaults('preferences', options, 'production')

    expect(enforced.httpOnly).toBe(false)
    expect(enforced.sameSite).toBe('strict')
    expect(enforced.maxAge).toBe(3600)
    expect(enforced.path).toBe('/api')
    expect(enforced.domain).toBe('example.com')
  })
})

describe('enforceSecureDefaults - Development', () => {
  it('should allow secure=false in development', () => {
    const options: CookieOptions = {
      secure: false,
    }

    const enforced = enforceSecureDefaults('session', options, 'development')

    expect(enforced.secure).toBe(false)
  })

  it('should log warning for insecure cookie in development', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const options: CookieOptions = { secure: false }
    enforceSecureDefaults('session', options, 'development')

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[COOKIE SECURITY]')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('would be rejected in production')
    )

    consoleSpy.mockRestore()
  })

  it('should not enforce secure=true in development if undefined', () => {
    const options: CookieOptions = {}

    const enforced = enforceSecureDefaults('test', options, 'development')

    // In development, doesn't auto-set secure=true
    expect(enforced.secure).toBeUndefined()
  })
})

describe('enforceSecureDefaults - Auth Cookie Detection', () => {
  it('should detect session cookies', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    enforceSecureDefaults('session', { secure: true, httpOnly: false }, 'production')
    expect(consoleSpy).toHaveBeenCalled()

    enforceSecureDefaults('user-session', { secure: true, httpOnly: false }, 'production')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should detect token cookies', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    enforceSecureDefaults('token', { secure: true, httpOnly: false }, 'production')
    expect(consoleSpy).toHaveBeenCalled()

    enforceSecureDefaults('access-token', { secure: true, httpOnly: false }, 'production')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should detect auth cookies', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    enforceSecureDefaults('auth', { secure: true, httpOnly: false }, 'production')
    expect(consoleSpy).toHaveBeenCalled()

    enforceSecureDefaults('authentication', { secure: true, httpOnly: false }, 'production')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should detect JWT cookies', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    enforceSecureDefaults('jwt', { secure: true, httpOnly: false }, 'production')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should detect CSRF cookies', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    enforceSecureDefaults('csrf-token', { secure: true, httpOnly: false }, 'production')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should not warn for non-auth cookies with httpOnly=false', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    enforceSecureDefaults('preferences', { secure: true, httpOnly: false }, 'production')
    enforceSecureDefaults('theme', { secure: true, httpOnly: false }, 'production')
    enforceSecureDefaults('language', { secure: true, httpOnly: false }, 'production')

    // Should not warn about httpOnly for non-auth cookies
    const calls = consoleSpy.mock.calls.filter(call =>
      call[0].includes('httpOnly')
    )
    expect(calls.length).toBe(0)

    consoleSpy.mockRestore()
  })

  it('should be case-insensitive for auth cookie detection', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    enforceSecureDefaults('SESSION', { secure: true, httpOnly: false }, 'production')
    expect(consoleSpy).toHaveBeenCalled()

    enforceSecureDefaults('Token', { secure: true, httpOnly: false }, 'production')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})

describe('validateSecurityRequirements', () => {
  it('should pass validation for secure production cookie', () => {
    expect(() => {
      validateSecurityRequirements('session', { secure: true }, 'production')
    }).not.toThrow()
  })

  it('should throw for insecure production cookie', () => {
    expect(() => {
      validateSecurityRequirements('session', { secure: false }, 'production')
    }).toThrow(CookieSecurityError)

    try {
      validateSecurityRequirements('session', { secure: false }, 'production')
    } catch (error) {
      expect(error).toBeInstanceOf(CookieSecurityError)
      expect((error as CookieSecurityError).message).toContain('secure=false')
      expect((error as CookieSecurityError).message).toContain('production')
    }
  })

  it('should throw for auth cookie without httpOnly in production', () => {
    expect(() => {
      validateSecurityRequirements('session', { secure: true, httpOnly: false }, 'production')
    }).toThrow(CookieSecurityError)

    try {
      validateSecurityRequirements('token', { secure: true, httpOnly: false }, 'production')
    } catch (error) {
      expect(error).toBeInstanceOf(CookieSecurityError)
      expect((error as CookieSecurityError).message).toContain('httpOnly=true')
    }
  })

  it('should not throw for non-auth cookie without httpOnly in production', () => {
    expect(() => {
      validateSecurityRequirements('preferences', { secure: true, httpOnly: false }, 'production')
    }).not.toThrow()
  })

  it('should allow insecure cookies in development', () => {
    expect(() => {
      validateSecurityRequirements('session', { secure: false }, 'development')
    }).not.toThrow()
  })

  it('should allow auth cookies without httpOnly in development', () => {
    expect(() => {
      validateSecurityRequirements('session', { secure: true, httpOnly: false }, 'development')
    }).not.toThrow()
  })
})

describe('Security: Production Enforcement', () => {
  it('should prevent MITM attacks by enforcing secure in production', () => {
    // Attacker tries to set insecure cookie
    const options: CookieOptions = {
      secure: false,
      httpOnly: true,
    }

    const enforced = enforceSecureDefaults('session', options, 'production')

    // Security enforcement prevents insecure cookie
    expect(enforced.secure).toBe(true)
  })

  it('should prevent XSS cookie theft by recommending httpOnly for auth cookies', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Developer accidentally sets httpOnly=false for session cookie
    const options: CookieOptions = {
      secure: true,
      httpOnly: false,
    }

    enforceSecureDefaults('session', options, 'production')

    // Warning is logged to alert developer
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('httpOnly=false')
    )

    consoleSpy.mockRestore()
  })

  it('should allow insecure localhost testing in development', () => {
    const options: CookieOptions = {
      secure: false,
    }

    const enforced = enforceSecureDefaults('session', options, 'development')

    // Development allows insecure for localhost
    expect(enforced.secure).toBe(false)
  })
})

describe('Security: Environment-Aware Defaults', () => {
  it('should auto-set secure=true in production if undefined', () => {
    const enforced = enforceSecureDefaults('session', {}, 'production')

    expect(enforced.secure).toBe(true)
  })

  it('should not auto-set secure in development', () => {
    const enforced = enforceSecureDefaults('session', {}, 'development')

    expect(enforced.secure).toBeUndefined()
  })

  it('should not auto-set secure in test environment', () => {
    const enforced = enforceSecureDefaults('session', {}, 'test')

    expect(enforced.secure).toBeUndefined()
  })
})
