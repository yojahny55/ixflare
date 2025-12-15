/**
 * Security Headers Configuration Schema Tests
 * Story 5-8: Security Headers Auto-Injection
 */

import { describe, it, expect } from 'vitest'
import {
  securityHeadersConfigSchema,
  cspConfigSchema,
  hstsConfigSchema,
  permissionsPolicyConfigSchema,
} from '@/config/schema'

describe('CSP Configuration Schema', () => {
  it('should validate valid CSP configuration', () => {
    const config = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    }

    const result = cspConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate CSP with report-uri', () => {
    const config = {
      defaultSrc: ["'self'"],
      reportUri: '/csp-report',
    }

    const result = cspConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate CSP with report-only mode', () => {
    const config = {
      defaultSrc: ["'self'"],
      reportOnly: true,
    }

    const result = cspConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate all CSP directives', () => {
    const config = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
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
      prefetchSrc: ["'self'"],
      childSrc: ["'self'"],
    }

    const result = cspConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })
})

describe('HSTS Configuration Schema', () => {
  it('should validate HSTS with all options', () => {
    const config = {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    }

    const result = hstsConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate HSTS with minimal configuration', () => {
    const config = {
      maxAge: 31536000,
    }

    const result = hstsConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should reject negative maxAge', () => {
    const config = {
      maxAge: -1,
    }

    const result = hstsConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('should reject non-integer maxAge', () => {
    const config = {
      maxAge: 31536000.5,
    }

    const result = hstsConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })
})

describe('Permissions-Policy Configuration Schema', () => {
  it('should validate permissions policy with disabled features', () => {
    const config = {
      camera: [],
      microphone: [],
      geolocation: [],
    }

    const result = permissionsPolicyConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate permissions policy with self origin', () => {
    const config = {
      camera: ['self'],
      microphone: ['self'],
      payment: ['self', 'https://stripe.com'],
    }

    const result = permissionsPolicyConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate all permissions policy features', () => {
    const config = {
      accelerometer: [],
      ambientLightSensor: [],
      autoplay: ['self'],
      battery: [],
      camera: [],
      microphone: [],
      geolocation: [],
      fullscreen: ['self'],
      payment: ['self'],
      usb: [],
    }

    const result = permissionsPolicyConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })
})

describe('Security Headers Configuration Schema', () => {
  it('should validate complete security headers configuration', () => {
    const config = {
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
      },
      strictTransportSecurity: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      },
      xContentTypeOptions: true,
      xFrameOptions: 'DENY' as const,
      referrerPolicy: 'strict-origin-when-cross-origin' as const,
      xXssProtection: true,
      httpsRedirect: true,
    }

    const result = securityHeadersConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate HSTS as boolean', () => {
    const config = {
      strictTransportSecurity: true,
    }

    const result = securityHeadersConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate CSP disabled', () => {
    const config = {
      contentSecurityPolicy: false,
    }

    const result = securityHeadersConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate X-Frame-Options options', () => {
    const denyConfig = { xFrameOptions: 'DENY' as const }
    const sameoriginConfig = { xFrameOptions: 'SAMEORIGIN' as const }

    expect(securityHeadersConfigSchema.safeParse(denyConfig).success).toBe(true)
    expect(securityHeadersConfigSchema.safeParse(sameoriginConfig).success).toBe(true)
  })

  it('should validate all referrer policy options', () => {
    const policies = [
      'no-referrer',
      'no-referrer-when-downgrade',
      'origin',
      'origin-when-cross-origin',
      'same-origin',
      'strict-origin',
      'strict-origin-when-cross-origin',
      'unsafe-url',
    ]

    for (const policy of policies) {
      const config = { referrerPolicy: policy }
      const result = securityHeadersConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    }
  })

  it('should validate cross-origin policies', () => {
    const config = {
      crossOriginEmbedderPolicy: 'require-corp' as const,
      crossOriginOpenerPolicy: 'same-origin' as const,
      crossOriginResourcePolicy: 'same-origin' as const,
    }

    const result = securityHeadersConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate empty configuration', () => {
    const config = {}

    const result = securityHeadersConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate with permissions policy', () => {
    const config = {
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: ['self'],
      },
    }

    const result = securityHeadersConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })
})
