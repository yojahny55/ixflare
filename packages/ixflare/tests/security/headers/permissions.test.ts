/**
 * Permissions-Policy Header Builder Tests
 * Story 5-8: Security Headers Auto-Injection
 */

import { describe, it, expect } from 'vitest'
import { buildPermissionsPolicyHeader, DEFAULT_PERMISSIONS_POLICY_CONFIG } from '@/security/headers/permissions'

describe('buildPermissionsPolicyHeader', () => {
  it('should build policy with disabled features', () => {
    const policy = buildPermissionsPolicyHeader({
      camera: [],
      microphone: [],
      geolocation: [],
    })

    expect(policy).toBe('camera=(), microphone=(), geolocation=()')
  })

  it('should build policy with self origin', () => {
    const policy = buildPermissionsPolicyHeader({
      camera: ['self'],
      microphone: ['self'],
    })

    expect(policy).toBe('camera=(self), microphone=(self)')
  })

  it('should build policy with specific origins', () => {
    const policy = buildPermissionsPolicyHeader({
      payment: ['self', 'https://stripe.com'],
    })

    expect(policy).toBe('payment=(self "https://stripe.com")')
  })

  it('should build policy with wildcard', () => {
    const policy = buildPermissionsPolicyHeader({
      camera: ['*'],
    })

    expect(policy).toBe('camera=*')
  })

  it('should handle multiple features', () => {
    const policy = buildPermissionsPolicyHeader({
      camera: [],
      microphone: [],
      geolocation: ['self'],
      payment: ['self', 'https://stripe.com'],
      fullscreen: ['*'],
    })

    expect(policy).toContain('camera=()')
    expect(policy).toContain('microphone=()')
    expect(policy).toContain('geolocation=(self)')
    expect(policy).toContain('payment=(self "https://stripe.com")')
    expect(policy).toContain('fullscreen=*')
  })

  it('should convert camelCase to kebab-case', () => {
    const policy = buildPermissionsPolicyHeader({
      ambientLightSensor: [],
      displayCapture: [],
      screenWakeLock: [],
    })

    expect(policy).toContain('ambient-light-sensor=()')
    expect(policy).toContain('display-capture=()')
    expect(policy).toContain('screen-wake-lock=()')
  })

  it('should handle empty configuration', () => {
    const policy = buildPermissionsPolicyHeader({})

    expect(policy).toBe('')
  })

  it('should handle multiple origins', () => {
    const policy = buildPermissionsPolicyHeader({
      payment: ['self', 'https://stripe.com', 'https://paypal.com'],
    })

    expect(policy).toBe('payment=(self "https://stripe.com" "https://paypal.com")')
  })

  it('should quote URLs but not self or *', () => {
    const policy = buildPermissionsPolicyHeader({
      camera: ['self'],
      microphone: ['https://example.com'],
      fullscreen: ['*'],
    })

    expect(policy).toContain('camera=(self)')
    expect(policy).toContain('microphone=("https://example.com")')
    expect(policy).toContain('fullscreen=*')
  })

  it('should handle all common features', () => {
    const policy = buildPermissionsPolicyHeader({
      accelerometer: [],
      autoplay: ['self'],
      camera: [],
      microphone: [],
      geolocation: [],
      gyroscope: [],
      magnetometer: [],
      payment: ['self'],
      usb: [],
    })

    expect(policy).toContain('accelerometer=()')
    expect(policy).toContain('autoplay=(self)')
    expect(policy).toContain('camera=()')
    expect(policy).toContain('payment=(self)')
  })
})

describe('DEFAULT_PERMISSIONS_POLICY_CONFIG', () => {
  it('should disable sensitive features by default', () => {
    expect(DEFAULT_PERMISSIONS_POLICY_CONFIG.camera).toEqual([])
    expect(DEFAULT_PERMISSIONS_POLICY_CONFIG.microphone).toEqual([])
    expect(DEFAULT_PERMISSIONS_POLICY_CONFIG.geolocation).toEqual([])
    expect(DEFAULT_PERMISSIONS_POLICY_CONFIG.payment).toEqual([])
    expect(DEFAULT_PERMISSIONS_POLICY_CONFIG.usb).toEqual([])
  })

  it('should build valid header', () => {
    const policy = buildPermissionsPolicyHeader(DEFAULT_PERMISSIONS_POLICY_CONFIG)

    expect(policy).toBeTruthy()
    expect(policy).toContain('camera=()')
    expect(policy).toContain('microphone=()')
  })
})

describe('Permissions-Policy Security Tests', () => {
  it('should restrict camera and microphone by default', () => {
    const policy = buildPermissionsPolicyHeader(DEFAULT_PERMISSIONS_POLICY_CONFIG)

    expect(policy).toContain('camera=()')
    expect(policy).toContain('microphone=()')
  })

  it('should restrict geolocation by default', () => {
    const policy = buildPermissionsPolicyHeader(DEFAULT_PERMISSIONS_POLICY_CONFIG)

    expect(policy).toContain('geolocation=()')
  })

  it('should restrict USB access by default', () => {
    const policy = buildPermissionsPolicyHeader(DEFAULT_PERMISSIONS_POLICY_CONFIG)

    expect(policy).toContain('usb=()')
  })

  it('should allow enabling features on same origin only', () => {
    const policy = buildPermissionsPolicyHeader({
      camera: ['self'],
      microphone: ['self'],
    })

    expect(policy).toBe('camera=(self), microphone=(self)')
  })
})
