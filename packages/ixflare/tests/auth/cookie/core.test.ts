/**
 * Core Cookie Module Tests
 * Story 5-7: Secure Cookie Handling
 */

import { describe, it, expect, vi } from 'vitest'
import { setCookie, getCookie, parseCookies, deleteCookie } from '@/auth/cookie/core'
import { CookieValidationError } from '@/auth/cookie/errors'

describe('setCookie', () => {
  it('should set cookie with default secure options', () => {
    const response = new Response('OK')
    const result = setCookie(response, 'session', 'test-value')

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('session=')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
  })

  it('should URL encode cookie value', () => {
    const response = new Response('OK')
    const result = setCookie(response, 'data', 'value=123&key=test')

    const cookie = result.headers.get('Set-Cookie')!
    expect(cookie).toContain('data=')
    expect(cookie).toContain('value%3D123%26key%3Dtest')
  })

  it('should set Max-Age attribute', () => {
    const response = new Response('OK')
    const result = setCookie(response, 'session', 'value', { maxAge: 3600 })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('Max-Age=3600')
  })

  it('should set Expires attribute with Date object', () => {
    const response = new Response('OK')
    const expires = new Date('2025-12-31T23:59:59Z')
    const result = setCookie(response, 'session', 'value', { expires })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('Expires=')
    expect(cookie).toContain('2025')
  })

  it('should set Expires attribute with timestamp', () => {
    const response = new Response('OK')
    const expires = new Date('2025-12-31T23:59:59Z').getTime()
    const result = setCookie(response, 'session', 'value', { expires })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('Expires=')
  })

  it('should prefer Max-Age over Expires when both provided', () => {
    const response = new Response('OK')
    const result = setCookie(response, 'session', 'value', {
      maxAge: 3600,
      expires: new Date('2025-12-31'),
    })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('Max-Age=3600')
    expect(cookie).not.toContain('Expires=')
  })

  it('should set custom path', () => {
    const response = new Response('OK')
    const result = setCookie(response, 'api-token', 'value', { path: '/api' })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('Path=/api')
  })

  it('should set domain attribute', () => {
    const response = new Response('OK')
    const result = setCookie(response, 'session', 'value', { domain: 'example.com' })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('Domain=example.com')
  })

  it('should set SameSite=Strict', () => {
    const response = new Response('OK')
    const result = setCookie(response, 'csrf', 'value', { sameSite: 'strict' })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('SameSite=Strict')
  })

  it('should set SameSite=None', () => {
    const response = new Response('OK')
    const result = setCookie(response, 'cross-site', 'value', { sameSite: 'none' })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('SameSite=None')
  })

  it('should set Partitioned attribute for CHIPS', () => {
    const response = new Response('OK')
    const result = setCookie(response, '3p-cookie', 'value', { partitioned: true })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('Partitioned')
  })

  it('should allow httpOnly=false for non-auth cookies', () => {
    const response = new Response('OK')
    const result = setCookie(response, 'preferences', 'value', { httpOnly: false })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).not.toContain('HttpOnly')
  })

  it('should validate __Host- prefix', () => {
    const response = new Response('OK')

    expect(() => {
      setCookie(response, '__Host-session', 'value', {
        secure: true,
        path: '/',
      })
    }).not.toThrow()
  })

  it('should reject invalid __Host- prefix configuration', () => {
    const response = new Response('OK')

    expect(() => {
      setCookie(response, '__Host-session', 'value', {
        secure: true,
        domain: 'example.com', // Invalid for __Host-
      })
    }).toThrow(CookieValidationError)
  })

  it('should validate __Secure- prefix', () => {
    const response = new Response('OK')

    expect(() => {
      setCookie(response, '__Secure-token', 'value', {
        secure: true,
      })
    }).not.toThrow()
  })

  it('should reject invalid __Secure- prefix configuration', () => {
    const response = new Response('OK')

    expect(() => {
      setCookie(response, '__Secure-token', 'value', {
        secure: false, // Invalid for __Secure-
      })
    }).toThrow(CookieValidationError)
  })

  it('should preserve response body and status', () => {
    const response = new Response(JSON.stringify({ success: true }), {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' },
    })

    const result = setCookie(response, 'session', 'value')

    expect(result.status).toBe(201)
    expect(result.statusText).toBe('Created')
    expect(result.headers.get('Content-Type')).toBe('application/json')
  })

  it('should support multiple cookies on same response', () => {
    let response = new Response('OK')

    response = setCookie(response, 'session', 'session-value')
    response = setCookie(response, 'preferences', 'prefs-value')

    const cookies = response.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toContain('session=')
    expect(cookies[1]).toContain('preferences=')
  })
})

describe('getCookie', () => {
  it('should get cookie from request', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'session=test-value',
      },
    })

    const value = getCookie(request, 'session')
    expect(value).toBe('test-value')
  })

  it('should URL decode cookie value', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'data=value%3D123%26key%3Dtest',
      },
    })

    const value = getCookie(request, 'data')
    expect(value).toBe('value=123&key=test')
  })

  it('should return null for missing cookie', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'other=value',
      },
    })

    const value = getCookie(request, 'session')
    expect(value).toBeNull()
  })

  it('should return null for request without Cookie header', () => {
    const request = new Request('https://example.com')

    const value = getCookie(request, 'session')
    expect(value).toBeNull()
  })

  it('should handle multiple cookies', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'session=value1; preferences=value2; theme=dark',
      },
    })

    expect(getCookie(request, 'session')).toBe('value1')
    expect(getCookie(request, 'preferences')).toBe('value2')
    expect(getCookie(request, 'theme')).toBe('dark')
  })

  it('should handle cookie values with equals sign', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'data=key=value',
      },
    })

    const value = getCookie(request, 'data')
    expect(value).toBe('key=value')
  })

  it('should handle empty cookie value', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'empty=',
      },
    })

    const value = getCookie(request, 'empty')
    expect(value).toBe('')
  })

  it('should return raw value if decoding fails', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'malformed=%',
      },
    })

    const value = getCookie(request, 'malformed')
    expect(value).toBe('%')
  })
})

describe('parseCookies', () => {
  it('should parse all cookies from request', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'session=value1; preferences=value2; theme=dark',
      },
    })

    const cookies = parseCookies(request)

    expect(cookies).toEqual({
      session: 'value1',
      preferences: 'value2',
      theme: 'dark',
    })
  })

  it('should return empty object for request without cookies', () => {
    const request = new Request('https://example.com')

    const cookies = parseCookies(request)

    expect(cookies).toEqual({})
  })

  it('should handle cookies with spaces', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: '  session  =  value  ;  theme  =  dark  ',
      },
    })

    const cookies = parseCookies(request)

    expect(cookies).toHaveProperty('session', 'value')
    expect(cookies).toHaveProperty('theme', 'dark')
  })

  it('should preserve URL-encoded values', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'data=value%3D123',
      },
    })

    const cookies = parseCookies(request)

    // parseCookies returns raw (encoded) values
    expect(cookies.data).toBe('value%3D123')
  })

  it('should handle cookie with equals in value', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'equation=a=b=c',
      },
    })

    const cookies = parseCookies(request)

    expect(cookies.equation).toBe('a=b=c')
  })

  it('should skip malformed cookie pairs', () => {
    const request = new Request('https://example.com', {
      headers: {
        Cookie: 'valid=value; ; =empty; name-only; another=good',
      },
    })

    const cookies = parseCookies(request)

    expect(cookies.valid).toBe('value')
    expect(cookies.another).toBe('good')
  })
})

describe('Cookie Name Validation', () => {
  it('should reject empty cookie name', () => {
    const response = new Response('OK')

    expect(() => {
      setCookie(response, '', 'value')
    }).toThrow(CookieValidationError)
  })

  it('should reject cookie name with spaces', () => {
    const response = new Response('OK')

    expect(() => {
      setCookie(response, 'my cookie', 'value')
    }).toThrow(CookieValidationError)
  })

  it('should reject cookie name with special characters', () => {
    const response = new Response('OK')
    const invalidNames = ['cookie=value', 'cookie;path', 'cookie,name', 'cookie(test)', 'cookie[0]']

    for (const name of invalidNames) {
      expect(() => setCookie(response, name, 'value')).toThrow(CookieValidationError)
    }
  })

  it('should accept valid cookie names with hyphen and underscore', () => {
    const response = new Response('OK')
    const validNames = ['session', 'my-cookie', 'my_cookie', '__Host-session', '__Secure-token']

    for (const name of validNames) {
      expect(() =>
        setCookie(response, name, 'value', { secure: true, path: '/' })
      ).not.toThrow()
    }
  })
})

describe('deleteCookie', () => {
  it('should delete cookie by setting Max-Age=0 and Expires', () => {
    const response = new Response('OK')
    const result = deleteCookie(response, 'session')

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('session=')
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
    expect(cookie).toContain('Path=/')
  })

  it('should delete cookie with custom path', () => {
    const response = new Response('OK')
    const result = deleteCookie(response, 'api-token', { path: '/api' })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('Path=/api')
  })

  it('should delete cookie with domain', () => {
    const response = new Response('OK')
    const result = deleteCookie(response, 'session', { domain: 'example.com' })

    const cookie = result.headers.get('Set-Cookie')
    expect(cookie).toContain('Domain=example.com')
  })

  it('should preserve response properties', () => {
    const response = new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

    const result = deleteCookie(response, 'session')

    expect(result.status).toBe(200)
    expect(result.headers.get('Content-Type')).toBe('application/json')
  })
})

describe('Cookie Round-trip Integration', () => {
  it('should complete full cookie lifecycle', () => {
    // 1. Set cookie
    const setResponse = new Response('OK')
    const responseWithCookie = setCookie(setResponse, 'session', 'user-123', {
      httpOnly: true,
      secure: true,
      maxAge: 3600,
    })

    // 2. Extract cookie from response
    const setCookieHeader = responseWithCookie.headers.get('Set-Cookie')!
    expect(setCookieHeader).toBeTruthy()

    // 3. Simulate browser sending cookie back
    const cookieValue = setCookieHeader.split(';')[0].split('=')[1]

    // 4. Create request with cookie
    const request = new Request('https://example.com', {
      headers: {
        Cookie: `session=${cookieValue}`,
      },
    })

    // 5. Get cookie value
    const value = getCookie(request, 'session')

    expect(value).toBe('user-123')
  })

  it('should handle special characters in round-trip', () => {
    const specialValue = 'user=123&role=admin;path=/test'

    // Set
    const setResponse = new Response('OK')
    const responseWithCookie = setCookie(setResponse, 'data', specialValue)

    // Extract
    const setCookieHeader = responseWithCookie.headers.get('Set-Cookie')!
    const cookieValue = setCookieHeader.split(';')[0].split('=')[1]

    // Get
    const request = new Request('https://example.com', {
      headers: {
        Cookie: `data=${cookieValue}`,
      },
    })
    const value = getCookie(request, 'data')

    expect(value).toBe(specialValue)
  })
})

describe('Security: Cookie Injection Prevention', () => {
  it('should URL encode special characters to prevent injection', () => {
    const response = new Response('OK')

    // Attempt to inject additional cookie attributes
    const maliciousValue = 'value; Path=/admin; HttpOnly'
    const result = setCookie(response, 'data', maliciousValue)

    const cookie = result.headers.get('Set-Cookie')!

    // Value should be URL encoded, preventing injection
    expect(cookie).toContain('data=')
    expect(cookie).toContain('%3B') // Encoded semicolon
    expect(cookie).not.toMatch(/data=value; Path=\/admin/)
  })

  it('should prevent newline injection in cookie value', () => {
    const response = new Response('OK')
    const maliciousValue = 'value\r\nSet-Cookie: admin=true'

    const result = setCookie(response, 'data', maliciousValue)

    const cookie = result.headers.get('Set-Cookie')!

    // Newlines should be encoded
    expect(cookie).toContain('%0D%0A')
  })
})

describe('Multi-Cookie Support', () => {
  it('should support multiple Set-Cookie headers', () => {
    let response = new Response('OK')

    response = setCookie(response, 'session', 'session-value')
    response = setCookie(response, 'preferences', 'prefs-value')
    response = setCookie(response, 'theme', 'dark')

    const cookies = response.headers.getSetCookie()

    expect(cookies).toHaveLength(3)
    expect(cookies[0]).toContain('session=')
    expect(cookies[1]).toContain('preferences=')
    expect(cookies[2]).toContain('theme=')
  })

  it('should preserve existing Set-Cookie headers', () => {
    const response = new Response('OK', {
      headers: {
        'Set-Cookie': 'existing=value',
      },
    })

    const result = setCookie(response, 'new', 'new-value')

    const cookies = result.headers.getSetCookie()

    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toContain('existing=')
    expect(cookies[1]).toContain('new=')
  })
})
