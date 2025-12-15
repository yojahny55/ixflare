/**
 * Common Security Headers Tests
 * Story 5-8: Security Headers Auto-Injection
 */

import { describe, it, expect } from 'vitest'
import {
  buildXContentTypeOptionsHeader,
  buildXFrameOptionsHeader,
  buildReferrerPolicyHeader,
  buildXXssProtectionHeader,
  buildCrossOriginEmbedderPolicyHeader,
  buildCrossOriginOpenerPolicyHeader,
  buildCrossOriginResourcePolicyHeader,
  DEFAULT_SECURITY_HEADERS,
} from '@/security/headers/common'

describe('buildXContentTypeOptionsHeader', () => {
  it('should return nosniff', () => {
    const header = buildXContentTypeOptionsHeader()

    expect(header).toBe('nosniff')
  })
})

describe('buildXFrameOptionsHeader', () => {
  it('should return DENY by default', () => {
    const header = buildXFrameOptionsHeader()

    expect(header).toBe('DENY')
  })

  it('should return DENY when explicitly set', () => {
    const header = buildXFrameOptionsHeader('DENY')

    expect(header).toBe('DENY')
  })

  it('should return SAMEORIGIN when set', () => {
    const header = buildXFrameOptionsHeader('SAMEORIGIN')

    expect(header).toBe('SAMEORIGIN')
  })
})

describe('buildReferrerPolicyHeader', () => {
  it('should return strict-origin-when-cross-origin by default', () => {
    const header = buildReferrerPolicyHeader()

    expect(header).toBe('strict-origin-when-cross-origin')
  })

  it('should return no-referrer when set', () => {
    const header = buildReferrerPolicyHeader('no-referrer')

    expect(header).toBe('no-referrer')
  })

  it('should return origin when set', () => {
    const header = buildReferrerPolicyHeader('origin')

    expect(header).toBe('origin')
  })

  it('should return same-origin when set', () => {
    const header = buildReferrerPolicyHeader('same-origin')

    expect(header).toBe('same-origin')
  })

  it('should return strict-origin when set', () => {
    const header = buildReferrerPolicyHeader('strict-origin')

    expect(header).toBe('strict-origin')
  })

  it('should return origin-when-cross-origin when set', () => {
    const header = buildReferrerPolicyHeader('origin-when-cross-origin')

    expect(header).toBe('origin-when-cross-origin')
  })

  it('should return no-referrer-when-downgrade when set', () => {
    const header = buildReferrerPolicyHeader('no-referrer-when-downgrade')

    expect(header).toBe('no-referrer-when-downgrade')
  })

  it('should return unsafe-url when set', () => {
    const header = buildReferrerPolicyHeader('unsafe-url')

    expect(header).toBe('unsafe-url')
  })
})

describe('buildXXssProtectionHeader', () => {
  it('should return 0 to disable legacy XSS filter', () => {
    const header = buildXXssProtectionHeader()

    expect(header).toBe('0')
  })
})

describe('buildCrossOriginEmbedderPolicyHeader', () => {
  it('should return unsafe-none by default', () => {
    const header = buildCrossOriginEmbedderPolicyHeader()

    expect(header).toBe('unsafe-none')
  })

  it('should return require-corp when set', () => {
    const header = buildCrossOriginEmbedderPolicyHeader('require-corp')

    expect(header).toBe('require-corp')
  })

  it('should return credentialless when set', () => {
    const header = buildCrossOriginEmbedderPolicyHeader('credentialless')

    expect(header).toBe('credentialless')
  })
})

describe('buildCrossOriginOpenerPolicyHeader', () => {
  it('should return unsafe-none by default', () => {
    const header = buildCrossOriginOpenerPolicyHeader()

    expect(header).toBe('unsafe-none')
  })

  it('should return same-origin when set', () => {
    const header = buildCrossOriginOpenerPolicyHeader('same-origin')

    expect(header).toBe('same-origin')
  })

  it('should return same-origin-allow-popups when set', () => {
    const header = buildCrossOriginOpenerPolicyHeader('same-origin-allow-popups')

    expect(header).toBe('same-origin-allow-popups')
  })
})

describe('buildCrossOriginResourcePolicyHeader', () => {
  it('should return same-site by default', () => {
    const header = buildCrossOriginResourcePolicyHeader()

    expect(header).toBe('same-site')
  })

  it('should return same-origin when set', () => {
    const header = buildCrossOriginResourcePolicyHeader('same-origin')

    expect(header).toBe('same-origin')
  })

  it('should return cross-origin when set', () => {
    const header = buildCrossOriginResourcePolicyHeader('cross-origin')

    expect(header).toBe('cross-origin')
  })
})

describe('DEFAULT_SECURITY_HEADERS', () => {
  it('should have secure defaults', () => {
    expect(DEFAULT_SECURITY_HEADERS.xContentTypeOptions).toBe('nosniff')
    expect(DEFAULT_SECURITY_HEADERS.xFrameOptions).toBe('DENY')
    expect(DEFAULT_SECURITY_HEADERS.referrerPolicy).toBe('strict-origin-when-cross-origin')
    expect(DEFAULT_SECURITY_HEADERS.xXssProtection).toBe('0')
  })
})

describe('Security Headers Protection Tests', () => {
  it('should prevent MIME sniffing attacks', () => {
    const header = buildXContentTypeOptionsHeader()

    expect(header).toBe('nosniff')
  })

  it('should prevent clickjacking by default', () => {
    const header = buildXFrameOptionsHeader()

    expect(header).toBe('DENY')
  })

  it('should allow embedding on same origin when needed', () => {
    const header = buildXFrameOptionsHeader('SAMEORIGIN')

    expect(header).toBe('SAMEORIGIN')
  })

  it('should limit referrer information leakage', () => {
    const header = buildReferrerPolicyHeader()

    expect(header).toBe('strict-origin-when-cross-origin')
  })

  it('should disable legacy XSS filter (vulnerable)', () => {
    const header = buildXXssProtectionHeader()

    // Legacy filter has vulnerabilities, disable it
    expect(header).toBe('0')
  })

  it('should provide Spectre mitigation options', () => {
    const coep = buildCrossOriginEmbedderPolicyHeader('require-corp')
    const coop = buildCrossOriginOpenerPolicyHeader('same-origin')
    const corp = buildCrossOriginResourcePolicyHeader('same-origin')

    expect(coep).toBe('require-corp')
    expect(coop).toBe('same-origin')
    expect(corp).toBe('same-origin')
  })
})
