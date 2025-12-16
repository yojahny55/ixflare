import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  Logger,
  createLogger,
  getLogger,
  resetGlobalLogger,
} from '../../../src/security/secrets/logger'
import { getSecretTracker, resetGlobalTracker } from '../../../src/security/secrets/tracker'

describe('Logger', () => {
  let mockOutput: {
    debug: ReturnType<typeof vi.fn>
    info: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    resetGlobalTracker()
    resetGlobalLogger()

    mockOutput = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
  })

  afterEach(() => {
    resetGlobalTracker()
    resetGlobalLogger()
  })

  describe('basic logging', () => {
    it('should log info messages', () => {
      const logger = new Logger({ output: mockOutput })
      logger.info('Test message')

      expect(mockOutput.info).toHaveBeenCalledWith('Test message')
    })

    it('should log warn messages', () => {
      const logger = new Logger({ output: mockOutput })
      logger.warn('Warning message')

      expect(mockOutput.warn).toHaveBeenCalledWith('Warning message')
    })

    it('should log error messages', () => {
      const logger = new Logger({ output: mockOutput })
      logger.error('Error message')

      expect(mockOutput.error).toHaveBeenCalledWith('Error message')
    })

    it('should log debug messages', () => {
      const logger = new Logger({ level: 'debug', output: mockOutput })
      logger.debug('Debug message')

      expect(mockOutput.debug).toHaveBeenCalledWith('Debug message')
    })
  })

  describe('log levels', () => {
    it('should respect minimum log level', () => {
      const logger = new Logger({ level: 'warn', output: mockOutput })

      logger.debug('Debug')
      logger.info('Info')
      logger.warn('Warn')
      logger.error('Error')

      expect(mockOutput.debug).not.toHaveBeenCalled()
      expect(mockOutput.info).not.toHaveBeenCalled()
      expect(mockOutput.warn).toHaveBeenCalled()
      expect(mockOutput.error).toHaveBeenCalled()
    })

    it('should default to info level', () => {
      const logger = new Logger({ output: mockOutput })

      logger.debug('Debug')
      logger.info('Info')

      expect(mockOutput.debug).not.toHaveBeenCalled()
      expect(mockOutput.info).toHaveBeenCalled()
    })
  })

  describe('automatic redaction', () => {
    it('should redact sensitive field values', () => {
      const logger = new Logger({ output: mockOutput })

      logger.info('User authenticated', {
        userId: '123',
        sessionToken: 'secret_token',
      })

      expect(mockOutput.info).toHaveBeenCalled()
      const args = mockOutput.info.mock.calls[0]

      // First arg is the message
      expect(args[0]).toBe('User authenticated')

      // Second arg should have redacted token
      expect(args[1]).toHaveProperty('userId', '123')
      expect(args[1]).toHaveProperty('sessionToken', '[REDACTED]')
    })

    it('should redact secrets from string messages', () => {
      const logger = new Logger({ output: mockOutput })

      logger.info('API key: sk_live_51HvI9aB2C3D4E5F6G7H8I9J')

      const args = mockOutput.info.mock.calls[0]
      expect(args[0]).toContain('[REDACTED]')
      expect(args[0]).not.toContain('sk_live_')
    })

    it('should redact tracked secrets', () => {
      const tracker = getSecretTracker()
      tracker.track('DATABASE_URL', 'postgres://user:pass@localhost/db')

      const logger = new Logger({ output: mockOutput })
      logger.error('Connection failed: postgres://user:pass@localhost/db')

      const args = mockOutput.error.mock.calls[0]
      expect(args[0]).toContain('[REDACTED:DATABASE_URL]')
      expect(args[0]).not.toContain('postgres://user:pass')
    })

    it('should redact multiple arguments', () => {
      const logger = new Logger({ output: mockOutput })

      logger.warn('Auth failed', {
        password: 'secret123',
        attemptedKey: 'sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
      })

      const args = mockOutput.warn.mock.calls[0]
      expect(args[1]).toHaveProperty('password', '[REDACTED]')
      expect(args[1].attemptedKey).toContain('[REDACTED]')
    })
  })

  describe('complex data structures', () => {
    it('should redact nested objects', () => {
      const logger = new Logger({ output: mockOutput })

      logger.info('Request data', {
        user: {
          id: '123',
          auth: {
            token: 'secret_token',
            apiKey: 'sk_live_abc',
          },
        },
      })

      const args = mockOutput.info.mock.calls[0]
      expect(args[1].user.id).toBe('123')
      expect(args[1].user.auth).toBe('[REDACTED]')
    })

    it('should redact arrays of objects', () => {
      const logger = new Logger({ output: mockOutput })

      logger.info('Multiple users', {
        users: [
          { name: 'Alice', password: 'pass1' },
          { name: 'Bob', password: 'pass2' },
        ],
      })

      const args = mockOutput.info.mock.calls[0]
      expect(args[1].users[0].name).toBe('Alice')
      expect(args[1].users[0].password).toBe('[REDACTED]')
      expect(args[1].users[1].password).toBe('[REDACTED]')
    })
  })

  describe('custom configuration', () => {
    it('should respect custom redaction patterns', () => {
      const logger = new Logger({
        output: mockOutput,
        redaction: {
          patterns: [/\b\d{3}-\d{2}-\d{4}\b/g],
        },
      })

      logger.info('SSN: 123-45-6789')

      const args = mockOutput.info.mock.calls[0]
      expect(args[0]).toContain('[REDACTED]')
      expect(args[0]).not.toContain('123-45-6789')
    })

    it('should respect custom field names', () => {
      const logger = new Logger({
        output: mockOutput,
        redaction: {
          fields: ['customSecret'],
        },
      })

      logger.info('Data', {
        customSecret: 'sensitive_value',
        publicData: 'public',
      })

      const args = mockOutput.info.mock.calls[0]
      expect(args[1].customSecret).toBe('[REDACTED]')
      expect(args[1].publicData).toBe('public')
    })

    it('should respect whitelist', () => {
      const logger = new Logger({
        output: mockOutput,
        redaction: {
          whitelist: ['token'],
        },
      })

      logger.info('Data', {
        token: 'should_not_be_redacted',
        password: 'should_be_redacted',
      })

      const args = mockOutput.info.mock.calls[0]
      expect(args[1].token).toBe('should_not_be_redacted')
      expect(args[1].password).toBe('[REDACTED]')
    })
  })
})

describe('createLogger', () => {
  afterEach(() => {
    resetGlobalLogger()
  })

  it('should create a new logger instance', () => {
    const logger = createLogger()
    expect(logger).toBeInstanceOf(Logger)
  })

  it('should accept configuration', () => {
    const mockOutput = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
    const logger = createLogger({ level: 'debug', output: mockOutput })

    logger.debug('Test')
    expect(mockOutput.debug).toHaveBeenCalled()
  })
})

describe('getLogger', () => {
  afterEach(() => {
    resetGlobalLogger()
  })

  it('should return singleton instance', () => {
    const logger1 = getLogger()
    const logger2 = getLogger()

    expect(logger1).toBe(logger2)
  })

  it('should create new instance after reset', () => {
    const logger1 = getLogger()
    resetGlobalLogger()
    const logger2 = getLogger()

    expect(logger1).not.toBe(logger2)
  })
})
