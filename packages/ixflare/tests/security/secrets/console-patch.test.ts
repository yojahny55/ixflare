import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  patchConsole,
  unpatchConsole,
  isConsolePatched,
} from '../../../src/security/secrets/console-patch'
import { getSecretTracker, resetGlobalTracker } from '../../../src/security/secrets/tracker'

describe('patchConsole', () => {
  let originalLog: typeof console.log
  let originalInfo: typeof console.info
  let originalWarn: typeof console.warn
  let originalError: typeof console.error
  let originalDebug: typeof console.debug

  beforeEach(() => {
    // Store original console methods
    originalLog = console.log
    originalInfo = console.info
    originalWarn = console.warn
    originalError = console.error
    originalDebug = console.debug

    // Reset tracker
    resetGlobalTracker()

    // Ensure console is unpatched before each test
    unpatchConsole()
  })

  afterEach(() => {
    // Restore original console methods
    unpatchConsole()
    console.log = originalLog
    console.info = originalInfo
    console.warn = originalWarn
    console.error = originalError
    console.debug = originalDebug
    resetGlobalTracker()
  })

  describe('patching behavior', () => {
    it('should patch console methods', () => {
      expect(isConsolePatched()).toBe(false)

      patchConsole()

      expect(isConsolePatched()).toBe(true)
    })

    it('should return cleanup function', () => {
      const cleanup = patchConsole()

      expect(isConsolePatched()).toBe(true)

      cleanup()

      expect(isConsolePatched()).toBe(false)
    })

    it('should unpatch console methods', () => {
      patchConsole()
      expect(isConsolePatched()).toBe(true)

      unpatchConsole()
      expect(isConsolePatched()).toBe(false)
    })

    it('should handle multiple patch calls gracefully', () => {
      patchConsole()
      patchConsole() // Second call should not break anything

      expect(isConsolePatched()).toBe(true)

      unpatchConsole()
      expect(isConsolePatched()).toBe(false)
    })

    it('should handle unpatch without patch', () => {
      // Should not throw
      unpatchConsole()
      unpatchConsole()

      expect(isConsolePatched()).toBe(false)
    })
  })

  describe('redaction with tracked secrets', () => {
    it('should redact tracked secrets in console.log', () => {
      const mockLog = vi.fn()
      console.log = mockLog

      patchConsole()

      const tracker = getSecretTracker()
      tracker.track('API_KEY', 'sk_live_abc123')

      console.log('My API key is sk_live_abc123')

      expect(mockLog).toHaveBeenCalledWith('My API key is [REDACTED:API_KEY]')
    })

    it('should redact tracked secrets in console.info', () => {
      const mockInfo = vi.fn()
      console.info = mockInfo

      patchConsole()

      const tracker = getSecretTracker()
      tracker.track('PASSWORD', 'super_secret')

      console.info('Password: super_secret')

      expect(mockInfo).toHaveBeenCalledWith('Password: [REDACTED:PASSWORD]')
    })

    it('should redact tracked secrets in console.warn', () => {
      const mockWarn = vi.fn()
      console.warn = mockWarn

      patchConsole()

      const tracker = getSecretTracker()
      tracker.track('TOKEN', 'jwt_token_value')

      console.warn('Token leaked: jwt_token_value')

      expect(mockWarn).toHaveBeenCalledWith('Token leaked: [REDACTED:TOKEN]')
    })

    it('should redact tracked secrets in console.error', () => {
      const mockError = vi.fn()
      console.error = mockError

      patchConsole()

      const tracker = getSecretTracker()
      tracker.track('DB_URL', 'postgres://user:pass@host/db')

      console.error('Connection failed: postgres://user:pass@host/db')

      expect(mockError).toHaveBeenCalledWith('Connection failed: [REDACTED:DB_URL]')
    })

    it('should redact tracked secrets in console.debug', () => {
      const mockDebug = vi.fn()
      console.debug = mockDebug

      patchConsole()

      const tracker = getSecretTracker()
      tracker.track('SECRET', 'debug_secret_value')

      console.debug('Debug: debug_secret_value')

      expect(mockDebug).toHaveBeenCalledWith('Debug: [REDACTED:SECRET]')
    })
  })

  describe('pattern-based redaction', () => {
    it('should redact JWT tokens without tracking', () => {
      const mockLog = vi.fn()
      console.log = mockLog

      patchConsole()

      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      console.log(`Token: ${jwt}`)

      const call = mockLog.mock.calls[0][0]
      expect(call).toContain('[REDACTED]')
      expect(call).not.toContain('eyJ')
    })

    it('should redact Stripe keys without tracking', () => {
      const mockLog = vi.fn()
      console.log = mockLog

      patchConsole()

      console.log('Stripe key: sk_live_51HvI9aB2C3D4E5F6G7H8I9J')

      const call = mockLog.mock.calls[0][0]
      expect(call).toContain('[REDACTED]')
      expect(call).not.toContain('sk_live_')
    })

    it('should redact sensitive field values in objects', () => {
      const mockLog = vi.fn()
      console.log = mockLog

      patchConsole()

      console.log('User data:', {
        name: 'John',
        password: 'secret123',
        email: 'john@example.com',
      })

      const call = mockLog.mock.calls[0]
      expect(call[0]).toBe('User data:')
      expect(call[1]).toEqual({
        name: 'John',
        password: '[REDACTED]',
        email: 'john@example.com',
      })
    })
  })

  describe('combined redaction', () => {
    it('should apply both pattern and tracker redaction', () => {
      const mockLog = vi.fn()
      console.log = mockLog

      patchConsole()

      const tracker = getSecretTracker()
      tracker.track('CUSTOM_SECRET', 'my_custom_value')

      // Message with both a tracked secret and a pattern-matched secret
      console.log('Custom: my_custom_value, Stripe: sk_live_51HvI9aB2C3D4E5F6G7H8I9J')

      const call = mockLog.mock.calls[0][0]
      expect(call).toContain('[REDACTED:CUSTOM_SECRET]')
      expect(call).toContain('[REDACTED]')
      expect(call).not.toContain('my_custom_value')
      expect(call).not.toContain('sk_live_')
    })

    it('should redact tracked secrets in nested objects', () => {
      const mockLog = vi.fn()
      console.log = mockLog

      patchConsole()

      const tracker = getSecretTracker()
      tracker.track('NESTED_SECRET', 'deeply_nested_value')

      console.log('Config:', {
        level1: {
          level2: {
            value: 'deeply_nested_value',
          },
        },
      })

      const call = mockLog.mock.calls[0]
      expect(call[1].level1.level2.value).toBe('[REDACTED:NESTED_SECRET]')
    })
  })

  describe('edge cases', () => {
    it('should handle null and undefined arguments', () => {
      const mockLog = vi.fn()
      console.log = mockLog

      patchConsole()

      console.log(null, undefined, 'text')

      expect(mockLog).toHaveBeenCalledWith(null, undefined, 'text')
    })

    it('should handle arrays', () => {
      const mockLog = vi.fn()
      console.log = mockLog

      patchConsole()

      const tracker = getSecretTracker()
      tracker.track('ARRAY_SECRET', 'secret_in_array')

      console.log(['item1', 'secret_in_array', 'item2'])

      const call = mockLog.mock.calls[0][0]
      expect(call).toContain('[REDACTED:ARRAY_SECRET]')
      expect(call).not.toContain('secret_in_array')
    })

    it('should preserve non-secret data', () => {
      const mockLog = vi.fn()
      console.log = mockLog

      patchConsole()

      console.log('Regular message', 123, true, { name: 'John', age: 30 })

      expect(mockLog).toHaveBeenCalledWith('Regular message', 123, true, {
        name: 'John',
        age: 30,
      })
    })
  })
})

describe('isConsolePatched', () => {
  afterEach(() => {
    unpatchConsole()
    resetGlobalTracker()
  })

  it('should return false initially', () => {
    expect(isConsolePatched()).toBe(false)
  })

  it('should return true after patching', () => {
    patchConsole()
    expect(isConsolePatched()).toBe(true)
  })

  it('should return false after unpatching', () => {
    patchConsole()
    unpatchConsole()
    expect(isConsolePatched()).toBe(false)
  })
})
