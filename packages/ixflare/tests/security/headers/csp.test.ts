/**
 * Content-Security-Policy Builder Tests
 * Story 5-8: Security Headers Auto-Injection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  generateNonce,
  getNonce,
  setRequestNonce,
  clearRequestNonce,
  buildCSPHeader,
  getCSPHeaderName,
  DEFAULT_CSP_CONFIG,
} from '@/security/headers/csp'
import { NonceGenerationError } from '@/security/headers/errors'

describe('generateNonce', () => {
  it('should generate a cryptographically secure nonce', async () => {
    const nonce = await generateNonce()

    expect(nonce).toBeDefined()
    expect(typeof nonce).toBe('string')
    expect(nonce.length).toBeGreaterThan(0)
  })

  it('should generate unique nonces', async () => {
    const nonce1 = await generateNonce()
    const nonce2 = await generateNonce()

    expect(nonce1).not.toBe(nonce2)
  })

  it('should generate base64url encoded nonces', async () => {
    const nonce = await generateNonce()

    // Base64url should not contain +, /, or = characters
    expect(nonce).not.toMatch(/[+/=]/)
    // Should only contain URL-safe characters
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('should generate nonces of minimum 128 bits', async () => {
    const nonce = await generateNonce()
    const buffer = Uint8Array.from(atob(nonce.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

    // 128 bits = 16 bytes
    expect(buffer.length).toBeGreaterThanOrEqual(16)
  })

  it('should generate consistent length nonces', async () => {
    const nonces = await Promise.all([generateNonce(), generateNonce(), generateNonce()])

    const lengths = nonces.map((n) => n.length)
    expect(new Set(lengths).size).toBe(1) // All same length
  })
})

describe('getNonce / setRequestNonce', () => {
  beforeEach(() => {
    clearRequestNonce()
  })

  afterEach(() => {
    clearRequestNonce()
  })

  it('should throw error when called outside request context', () => {
    expect(() => getNonce()).toThrow(NonceGenerationError)
    expect(() => getNonce()).toThrow('must be called within a request context')
  })

  it('should return nonce after setRequestNonce is called', () => {
    const testNonce = 'test-nonce-123'
    setRequestNonce(testNonce)

    expect(getNonce()).toBe(testNonce)
  })

  it('should clear nonce after clearRequestNonce is called', () => {
    setRequestNonce('test-nonce')
    expect(getNonce()).toBe('test-nonce')

    clearRequestNonce()
    expect(() => getNonce()).toThrow(NonceGenerationError)
  })

  it('should allow updating nonce for new request', () => {
    setRequestNonce('nonce-1')
    expect(getNonce()).toBe('nonce-1')

    setRequestNonce('nonce-2')
    expect(getNonce()).toBe('nonce-2')
  })
})

describe('buildCSPHeader', () => {
  it('should build basic CSP header', () => {
    const csp = buildCSPHeader({
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    })

    expect(csp).toBe("default-src 'self'; script-src 'self'")
  })

  it('should build CSP with multiple sources', () => {
    const csp = buildCSPHeader({
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.example.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
    })

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self' https://cdn.example.com")
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('should include nonce in script-src when provided', () => {
    const csp = buildCSPHeader(
      {
        scriptSrc: ["'self'"],
      },
      'ABC123'
    )

    expect(csp).toContain("'nonce-ABC123'")
    expect(csp).toContain("'strict-dynamic'")
  })

  it('should include nonce in style-src when provided', () => {
    const csp = buildCSPHeader(
      {
        styleSrc: ["'self'"],
      },
      'ABC123'
    )

    expect(csp).toContain("'nonce-ABC123'")
  })

  it('should add strict-dynamic to script-src with nonce', () => {
    const csp = buildCSPHeader(
      {
        scriptSrc: ["'self'"],
      },
      'NONCE123'
    )

    expect(csp).toContain("'strict-dynamic'")
    expect(csp).toMatch(/script-src.*'nonce-NONCE123'.*'strict-dynamic'/)
  })

  it('should not duplicate strict-dynamic if already present', () => {
    const csp = buildCSPHeader(
      {
        scriptSrc: ["'self'", "'strict-dynamic'"],
      },
      'NONCE'
    )

    const matches = csp.match(/'strict-dynamic'/g)
    expect(matches?.length).toBe(1)
  })

  it('should convert camelCase to kebab-case directive names', () => {
    const csp = buildCSPHeader({
      defaultSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    })

    expect(csp).toContain('default-src')
    expect(csp).toContain('frame-ancestors')
    expect(csp).toContain('form-action')
  })

  it('should build CSP with all directive types', () => {
    const csp = buildCSPHeader({
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
    })

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('should include report-uri directive', () => {
    const csp = buildCSPHeader({
      defaultSrc: ["'self'"],
      reportUri: '/csp-report',
    })

    expect(csp).toContain('report-uri /csp-report')
  })

  it('should include report-to directive', () => {
    const csp = buildCSPHeader({
      defaultSrc: ["'self'"],
      reportTo: 'csp-endpoint',
    })

    expect(csp).toContain('report-to csp-endpoint')
  })

  it('should include upgrade-insecure-requests', () => {
    const csp = buildCSPHeader({
      defaultSrc: ["'self'"],
      upgradeInsecureRequests: true,
    })

    expect(csp).toContain('upgrade-insecure-requests')
  })

  it('should include block-all-mixed-content', () => {
    const csp = buildCSPHeader({
      defaultSrc: ["'self'"],
      blockAllMixedContent: true,
    })

    expect(csp).toContain('block-all-mixed-content')
  })

  it('should return secure default when no config provided', () => {
    const csp = buildCSPHeader()

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
  })

  it('should return secure default with nonce when only nonce provided', () => {
    const csp = buildCSPHeader({}, 'NONCE')

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("'nonce-NONCE'")
    expect(csp).toContain("'strict-dynamic'")
  })

  it('should handle empty arrays in directives', () => {
    const csp = buildCSPHeader({
      defaultSrc: ["'self'"],
      scriptSrc: [],
    })

    // Empty arrays should be ignored
    expect(csp).not.toContain('script-src')
  })

  it('should preserve all sources with nonce', () => {
    const csp = buildCSPHeader(
      {
        scriptSrc: ["'self'", 'https://cdn.example.com', "'unsafe-eval'"],
      },
      'XYZ'
    )

    expect(csp).toContain("'self'")
    expect(csp).toContain('https://cdn.example.com')
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toContain("'nonce-XYZ'")
    expect(csp).toContain("'strict-dynamic'")
  })
})

describe('getCSPHeaderName', () => {
  it('should return enforcing header name by default', () => {
    expect(getCSPHeaderName()).toBe('Content-Security-Policy')
  })

  it('should return enforcing header name when reportOnly is false', () => {
    expect(getCSPHeaderName(false)).toBe('Content-Security-Policy')
  })

  it('should return report-only header name when reportOnly is true', () => {
    expect(getCSPHeaderName(true)).toBe('Content-Security-Policy-Report-Only')
  })
})

describe('DEFAULT_CSP_CONFIG', () => {
  it('should have secure defaults', () => {
    expect(DEFAULT_CSP_CONFIG.defaultSrc).toEqual(["'self'"])
    expect(DEFAULT_CSP_CONFIG.scriptSrc).toEqual(["'self'"])
    expect(DEFAULT_CSP_CONFIG.styleSrc).toEqual(["'self'"])
    expect(DEFAULT_CSP_CONFIG.objectSrc).toEqual(["'none'"])
    expect(DEFAULT_CSP_CONFIG.frameAncestors).toEqual(["'none'"])
  })

  it('should allow images from data URIs and HTTPS', () => {
    expect(DEFAULT_CSP_CONFIG.imgSrc).toContain('data:')
    expect(DEFAULT_CSP_CONFIG.imgSrc).toContain('https:')
  })

  it('should restrict base-uri to self', () => {
    expect(DEFAULT_CSP_CONFIG.baseUri).toEqual(["'self'"])
  })

  it('should restrict form actions to self', () => {
    expect(DEFAULT_CSP_CONFIG.formAction).toEqual(["'self'"])
  })

  it('should build valid CSP header', () => {
    const csp = buildCSPHeader(DEFAULT_CSP_CONFIG)

    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
  })
})

describe('CSP Security Tests', () => {
  it('should prevent XSS with strict CSP', () => {
    const csp = buildCSPHeader({
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
    })

    // No unsafe-inline or unsafe-eval
    expect(csp).not.toContain("'unsafe-inline'")
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('should use strict-dynamic for nonce-based CSP', () => {
    const csp = buildCSPHeader(
      {
        scriptSrc: ["'self'"],
      },
      'SECURE_NONCE'
    )

    // Strict-dynamic should be present with nonce
    expect(csp).toMatch(/script-src.*'nonce-SECURE_NONCE'.*'strict-dynamic'/)
  })

  it('should block inline scripts by default', () => {
    const csp = buildCSPHeader(DEFAULT_CSP_CONFIG)

    // Should not allow unsafe-inline
    expect(csp).not.toContain("'unsafe-inline'")
  })

  it('should prevent clickjacking with frame-ancestors', () => {
    const csp = buildCSPHeader(DEFAULT_CSP_CONFIG)

    expect(csp).toContain("frame-ancestors 'none'")
  })
})
