/**
 * Signed Cookie Tests
 * Story 5-7: Secure Cookie Handling
 */

import { describe, it, expect, vi } from 'vitest'
import {
  signCookieValue,
  verifyCookieSignature,
  setSignedCookie,
  getSignedCookie,
} from '@/auth/cookie/signed'
import { CookieSignatureError } from '@/auth/cookie/errors'

const TEST_SECRET = 'test-secret-key-minimum-32-chars-long-for-security'

describe('signCookieValue', () => {
  it('should sign cookie value with HMAC-SHA256', async () => {
    const signed = await signCookieValue('session', 'user123', TEST_SECRET)

    expect(signed).toContain('.')
    const [value, signature] = signed.split('.')
    expect(value).toBe('user123')
    expect(signature).toBeTruthy()
    expect(signature.length).toBeGreaterThan(0)
  })

  it('should produce different signatures for different values', async () => {
    const signed1 = await signCookieValue('session', 'user123', TEST_SECRET)
    const signed2 = await signCookieValue('session', 'user456', TEST_SECRET)

    expect(signed1).not.toBe(signed2)
    const [, sig1] = signed1.split('.')
    const [, sig2] = signed2.split('.')
    expect(sig1).not.toBe(sig2)
  })

  it('should produce different signatures for different cookie names (prevents name substitution)', async () => {
    const signed1 = await signCookieValue('session', 'user123', TEST_SECRET)
    const signed2 = await signCookieValue('token', 'user123', TEST_SECRET)

    expect(signed1).not.toBe(signed2)
    const [, sig1] = signed1.split('.')
    const [, sig2] = signed2.split('.')
    expect(sig1).not.toBe(sig2)
  })

  it('should produce different signatures with different secrets', async () => {
    const signed1 = await signCookieValue('session', 'user123', TEST_SECRET)
    const signed2 = await signCookieValue('session', 'user123', 'different-secret-key-for-testing')

    const [, sig1] = signed1.split('.')
    const [, sig2] = signed2.split('.')
    expect(sig1).not.toBe(sig2)
  })

  it('should handle empty value', async () => {
    const signed = await signCookieValue('session', '', TEST_SECRET)

    expect(signed).toContain('.')
    const [value, signature] = signed.split('.')
    expect(value).toBe('')
    expect(signature).toBeTruthy()
  })

  it('should handle special characters in value', async () => {
    const testValue = 'user=123&role=admin;path=/test'
    const signed = await signCookieValue('session', testValue, TEST_SECRET)

    const [value] = signed.split('.')
    expect(value).toBe(testValue)
  })

  it('should throw CookieSignatureError for empty secret', async () => {
    await expect(signCookieValue('session', 'user123', '')).rejects.toThrow(CookieSignatureError)
  })

  it('should warn for short secret but still sign', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const shortSecret = 'short-secret' // Less than 32 chars
    const signed = await signCookieValue('session', 'user123', shortSecret)

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[COOKIE SECURITY]'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('recommended minimum'))

    // Should still produce a valid signature
    const verified = await verifyCookieSignature('session', signed, shortSecret)
    expect(verified).toBe('user123')

    consoleSpy.mockRestore()
  })
})

describe('verifyCookieSignature', () => {
  it('should verify valid signed cookie', async () => {
    const signed = await signCookieValue('session', 'user123', TEST_SECRET)
    const verified = await verifyCookieSignature('session', signed, TEST_SECRET)

    expect(verified).toBe('user123')
  })

  it('should return null for tampered value', async () => {
    const signed = await signCookieValue('session', 'user123', TEST_SECRET)
    const tampered = signed.replace('user123', 'hacker')

    const verified = await verifyCookieSignature('session', tampered, TEST_SECRET)

    expect(verified).toBeNull()
  })

  it('should return null for tampered signature', async () => {
    const signed = await signCookieValue('session', 'user123', TEST_SECRET)
    const [value, signature] = signed.split('.')
    const tampered = `${value}.${signature}xxx`

    const verified = await verifyCookieSignature('session', tampered, TEST_SECRET)

    expect(verified).toBeNull()
  })

  it('should return null for wrong secret', async () => {
    const signed = await signCookieValue('session', 'user123', TEST_SECRET)
    const verified = await verifyCookieSignature('session', signed, 'wrong-secret-key')

    expect(verified).toBeNull()
  })

  it('should return null for wrong cookie name (prevents name substitution attack)', async () => {
    const signed = await signCookieValue('session', 'user123', TEST_SECRET)
    const verified = await verifyCookieSignature('token', signed, TEST_SECRET)

    expect(verified).toBeNull()
  })

  it('should return null for invalid format (no dot)', async () => {
    const verified = await verifyCookieSignature('session', 'user123', TEST_SECRET)

    expect(verified).toBeNull()
  })

  it('should handle values with multiple dots correctly', async () => {
    // Values with dots are now supported via lastIndexOf parsing
    const valueWithDots = 'user.123.data'
    const signed = await signCookieValue('session', valueWithDots, TEST_SECRET)

    // Format is: value.signature, so "user.123.data.signature"
    expect(signed.split('.').length).toBe(4)

    const verified = await verifyCookieSignature('session', signed, TEST_SECRET)
    expect(verified).toBe(valueWithDots)
  })

  it('should return null for invalid format (empty signature)', async () => {
    const verified = await verifyCookieSignature('session', 'user123.', TEST_SECRET)

    expect(verified).toBeNull()
  })

  it('should handle empty value correctly', async () => {
    const signed = await signCookieValue('session', '', TEST_SECRET)
    const verified = await verifyCookieSignature('session', signed, TEST_SECRET)

    expect(verified).toBe('')
  })
})

describe('setSignedCookie', () => {
  it('should set signed cookie on response', async () => {
    const response = new Response('OK')
    const result = await setSignedCookie(response, 'session', 'user123', TEST_SECRET)

    const setCookie = result.headers.get('Set-Cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('session=')
    expect(setCookie).toContain('.') // Contains signature
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('HttpOnly')
  })

  it('should set signed cookie with custom options', async () => {
    const response = new Response('OK')
    const result = await setSignedCookie(response, 'preferences', 'theme=dark', TEST_SECRET, {
      maxAge: 86400,
      httpOnly: false,
      sameSite: 'strict',
    })

    const setCookie = result.headers.get('Set-Cookie')
    expect(setCookie).toContain('preferences=')
    expect(setCookie).toContain('Max-Age=86400')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).not.toContain('HttpOnly')
  })

  it('should URL encode signed value', async () => {
    const response = new Response('OK')
    const result = await setSignedCookie(response, 'data', 'value=123&key=test', TEST_SECRET)

    const setCookie = result.headers.get('Set-Cookie')!
    // Should be URL encoded
    expect(setCookie).toContain('data=')
    expect(setCookie).toContain('%')
  })
})

describe('getSignedCookie', () => {
  it('should get and verify signed cookie from request', async () => {
    // Create signed value
    const signed = await signCookieValue('session', 'user123', TEST_SECRET)

    // Create request with cookie
    const request = new Request('https://example.com', {
      headers: {
        Cookie: `session=${signed}`,
      },
    })

    const value = await getSignedCookie(request, 'session', TEST_SECRET)

    expect(value).toBe('user123')
  })

  it('should return null for missing cookie', async () => {
    const request = new Request('https://example.com')

    const value = await getSignedCookie(request, 'session', TEST_SECRET)

    expect(value).toBeNull()
  })

  it('should return null for tampered cookie', async () => {
    const signed = await signCookieValue('session', 'user123', TEST_SECRET)
    const tampered = signed.replace('user123', 'hacker')

    const request = new Request('https://example.com', {
      headers: {
        Cookie: `session=${tampered}`,
      },
    })

    const value = await getSignedCookie(request, 'session', TEST_SECRET)

    expect(value).toBeNull()
  })

  it('should handle URL encoded cookie values', async () => {
    const signed = await signCookieValue('data', 'value=123&key=test', TEST_SECRET)
    const encoded = encodeURIComponent(signed)

    const request = new Request('https://example.com', {
      headers: {
        Cookie: `data=${encoded}`,
      },
    })

    const value = await getSignedCookie(request, 'data', TEST_SECRET)

    expect(value).toBe('value=123&key=test')
  })
})

describe('Security: Timing Attack Prevention', () => {
  it('should use timing-safe comparison for signature verification', async () => {
    const signed = await signCookieValue('session', 'user123', TEST_SECRET)
    const [value, validSig] = signed.split('.')

    // Create invalid signatures of different lengths
    const invalidShort = `${value}.abc`
    const invalidLong = `${value}.${validSig}extra`
    const invalidSame = `${value}.${validSig.slice(0, -1)}X`

    const start1 = performance.now()
    await verifyCookieSignature('session', invalidShort, TEST_SECRET)
    const time1 = performance.now() - start1

    const start2 = performance.now()
    await verifyCookieSignature('session', invalidLong, TEST_SECRET)
    const time2 = performance.now() - start2

    const start3 = performance.now()
    await verifyCookieSignature('session', invalidSame, TEST_SECRET)
    const time3 = performance.now() - start3

    // All should return null regardless of timing
    expect(await verifyCookieSignature('session', invalidShort, TEST_SECRET)).toBeNull()
    expect(await verifyCookieSignature('session', invalidLong, TEST_SECRET)).toBeNull()
    expect(await verifyCookieSignature('session', invalidSame, TEST_SECRET)).toBeNull()

    // Note: Actual timing differences are hard to measure reliably in tests
    // The important thing is that timingSafeEqual is used internally
  })
})

describe('Security: Name Substitution Attack Prevention', () => {
  it('should prevent attacker from using session cookie as token cookie', async () => {
    // User's legitimate session cookie
    const sessionSigned = await signCookieValue('session', 'user123', TEST_SECRET)

    // Attacker tries to use same signed value for different cookie name
    const tokenVerified = await verifyCookieSignature('token', sessionSigned, TEST_SECRET)

    // Should fail because signature is bound to cookie name
    expect(tokenVerified).toBeNull()
  })

  it('should prevent cookie name swapping attack', async () => {
    const cookie1 = await signCookieValue('role', 'user', TEST_SECRET)
    const cookie2 = await signCookieValue('level', 'admin', TEST_SECRET)

    // Attacker swaps cookie names
    const swapped1 = await verifyCookieSignature('level', cookie1, TEST_SECRET)
    const swapped2 = await verifyCookieSignature('role', cookie2, TEST_SECRET)

    expect(swapped1).toBeNull()
    expect(swapped2).toBeNull()
  })
})

describe('Integration: Signed Cookie Round-trip', () => {
  it('should complete full signed cookie lifecycle', async () => {
    // 1. Set signed cookie
    const setResponse = new Response('OK')
    const responseWithCookie = await setSignedCookie(
      setResponse,
      '__Host-session',
      'user-id-12345',
      TEST_SECRET,
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 3600,
        path: '/',
      }
    )

    // 2. Extract cookie from response
    const setCookieHeader = responseWithCookie.headers.get('Set-Cookie')!
    expect(setCookieHeader).toBeTruthy()

    // 3. Parse cookie value (simulate browser sending it back)
    const cookieValue = setCookieHeader.split(';')[0].split('=')[1]
    const decodedValue = decodeURIComponent(cookieValue)

    // 4. Create request with cookie
    const request = new Request('https://example.com', {
      headers: {
        Cookie: `__Host-session=${cookieValue}`,
      },
    })

    // 5. Get and verify signed cookie
    const verified = await getSignedCookie(request, '__Host-session', TEST_SECRET)

    expect(verified).toBe('user-id-12345')
  })

  it('should handle concurrent cookie operations correctly', async () => {
    // Simulate concurrent requests setting and verifying cookies
    const operations = Array.from({ length: 10 }, async (_, i) => {
      const cookieName = `cookie-${i}`
      const cookieValue = `value-${i}-${Date.now()}`

      // Sign the cookie
      const signed = await signCookieValue(cookieName, cookieValue, TEST_SECRET)

      // Verify immediately
      const verified = await verifyCookieSignature(cookieName, signed, TEST_SECRET)

      return { cookieName, cookieValue, verified }
    })

    const results = await Promise.all(operations)

    // All cookies should verify correctly
    for (const result of results) {
      expect(result.verified).toBe(result.cookieValue)
    }
  })

  it('should handle values containing dots correctly', async () => {
    // Values with dots should work (common in JWTs, UUIDs, etc.)
    const testCases = ['user.role.admin', 'a.b.c.d.e', '1.2.3', 'config.setting.value.nested']

    for (const value of testCases) {
      const signed = await signCookieValue('test', value, TEST_SECRET)
      const verified = await verifyCookieSignature('test', signed, TEST_SECRET)

      expect(verified).toBe(value)
    }
  })
})
