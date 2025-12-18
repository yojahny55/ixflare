/**
 * Tests for log parser
 */

import { describe, it, expect } from 'vitest'
import { parseLogEntry, tryParseLogLine } from '../../../src/commands/logs/parser'
import type { WranglerLogOutput } from '../../../src/commands/logs/types'

describe('Log Parser', () => {
  describe('parseLogEntry', () => {
    it('should parse basic wrangler log output', () => {
      const raw: WranglerLogOutput = {
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [
          {
            message: ['Processing request'],
            level: 'log',
            timestamp: 1733322601000,
          },
        ],
        eventTimestamp: 1733322601000,
        event: {
          request: {
            url: 'https://test.workers.dev/api/users',
            method: 'GET',
            headers: {},
          },
        },
      }

      const result = parseLogEntry(raw)

      expect(result.timestamp).toBe(1733322601000)
      expect(result.method).toBe('GET')
      expect(result.path).toBe('/api/users')
      expect(result.outcome).toBe('ok')
      expect(result.scriptName).toBe('test-worker')
      expect(result.logs).toHaveLength(1)
      expect(result.logs[0].message).toBe('Processing request')
      expect(result.logs[0].level).toBe('log')
    })

    it('should parse log entry with exceptions', () => {
      const raw: WranglerLogOutput = {
        outcome: 'error',
        scriptName: 'test-worker',
        exceptions: [
          {
            name: 'ValidationError',
            message: 'Invalid email format',
            stack: 'at validator.ts:10\nat handler.ts:20',
          },
        ],
        logs: [],
        eventTimestamp: 1733322601000,
        event: {
          request: {
            url: 'https://test.workers.dev/api/users',
            method: 'POST',
          },
        },
      }

      const result = parseLogEntry(raw)

      expect(result.outcome).toBe('error')
      expect(result.exceptions).toHaveLength(1)
      expect(result.exceptions[0].name).toBe('ValidationError')
      expect(result.exceptions[0].message).toBe('Invalid email format')
      expect(result.exceptions[0].stack).toContain('validator.ts:10')
    })

    it('should parse log entry with multiple log messages', () => {
      const raw: WranglerLogOutput = {
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [
          {
            message: ['Request started'],
            level: 'log',
            timestamp: 1733322601000,
          },
          {
            message: ['User authenticated'],
            level: 'info',
            timestamp: 1733322601100,
          },
          {
            message: ['Database query completed'],
            level: 'debug',
            timestamp: 1733322601200,
          },
        ],
        eventTimestamp: 1733322601000,
        event: {
          request: {
            url: 'https://test.workers.dev/api/posts',
            method: 'POST',
          },
        },
      }

      const result = parseLogEntry(raw)

      expect(result.logs).toHaveLength(3)
      expect(result.logs[0].message).toBe('Request started')
      expect(result.logs[0].level).toBe('log')
      expect(result.logs[1].message).toBe('User authenticated')
      expect(result.logs[1].level).toBe('info')
      expect(result.logs[2].message).toBe('Database query completed')
      expect(result.logs[2].level).toBe('debug')
    })

    it('should handle log messages with multiple parts', () => {
      const raw: WranglerLogOutput = {
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [
          {
            message: ['User:', { id: 123, name: 'John' }, 'logged in'],
            level: 'log',
            timestamp: 1733322601000,
          },
        ],
        eventTimestamp: 1733322601000,
        event: {
          request: {
            url: 'https://test.workers.dev/api/login',
            method: 'POST',
          },
        },
      }

      const result = parseLogEntry(raw)

      expect(result.logs).toHaveLength(1)
      // Should join parts with space and JSON stringify objects
      expect(result.logs[0].message).toContain('User:')
      expect(result.logs[0].message).toContain('"id":123')
      expect(result.logs[0].message).toContain('logged in')
    })

    it('should default to outcome-based status code', () => {
      const rawOk: WranglerLogOutput = {
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [],
        eventTimestamp: 1733322601000,
        event: {
          request: {
            url: 'https://test.workers.dev/api/test',
            method: 'GET',
          },
        },
      }

      const resultOk = parseLogEntry(rawOk)
      expect(resultOk.status).toBe(200)

      const rawError: WranglerLogOutput = {
        outcome: 'error',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [],
        eventTimestamp: 1733322601000,
        event: {
          request: {
            url: 'https://test.workers.dev/api/test',
            method: 'GET',
          },
        },
      }

      const resultError = parseLogEntry(rawError)
      expect(resultError.status).toBe(500)

      const rawCanceled: WranglerLogOutput = {
        outcome: 'canceled',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [],
        eventTimestamp: 1733322601000,
        event: {
          request: {
            url: 'https://test.workers.dev/api/test',
            method: 'GET',
          },
        },
      }

      const resultCanceled = parseLogEntry(rawCanceled)
      expect(resultCanceled.status).toBe(499)
    })

    it('should extract status code from "status: XXX" pattern', () => {
      const raw: WranglerLogOutput = {
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [
          {
            message: ['Response status: 404'],
            level: 'log',
            timestamp: 1733322601000,
          },
        ],
        eventTimestamp: 1733322601000,
      }

      const result = parseLogEntry(raw)
      expect(result.status).toBe(404)
    })

    it('should extract status code from "HTTP XXX" pattern', () => {
      const raw: WranglerLogOutput = {
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [
          {
            message: ['HTTP/1.1 201 Created'],
            level: 'log',
            timestamp: 1733322601000,
          },
        ],
        eventTimestamp: 1733322601000,
      }

      const result = parseLogEntry(raw)
      expect(result.status).toBe(201)
    })

    it('should extract status code from "[XXX]" pattern', () => {
      const raw: WranglerLogOutput = {
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [
          {
            message: ['GET /api/users [302] 15ms'],
            level: 'log',
            timestamp: 1733322601000,
          },
        ],
        eventTimestamp: 1733322601000,
      }

      const result = parseLogEntry(raw)
      expect(result.status).toBe(302)
    })

    it('should NOT extract arbitrary 3-digit numbers as status codes', () => {
      const raw: WranglerLogOutput = {
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [
          {
            message: ['User ID: 12345 processed successfully'],
            level: 'log',
            timestamp: 1733322601000,
          },
        ],
        eventTimestamp: 1733322601000,
      }

      const result = parseLogEntry(raw)
      // Should fall back to outcome-based status (200 for 'ok'), not extract "123"
      expect(result.status).toBe(200)
    })

    it('should handle missing event data gracefully', () => {
      const raw: WranglerLogOutput = {
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [],
        eventTimestamp: 1733322601000,
      }

      const result = parseLogEntry(raw)

      expect(result.method).toBe('UNKNOWN')
      expect(result.path).toBe('/')
      expect(result.timestamp).toBe(1733322601000)
    })

    it('should normalize log levels', () => {
      const raw: WranglerLogOutput = {
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [
          { message: ['Test'], level: 'LOG', timestamp: 1 },
          { message: ['Test'], level: 'ERROR', timestamp: 2 },
          { message: ['Test'], level: 'WARN', timestamp: 3 },
          { message: ['Test'], level: 'INFO', timestamp: 4 },
          { message: ['Test'], level: 'DEBUG', timestamp: 5 },
          { message: ['Test'], level: 'unknown', timestamp: 6 },
        ],
        eventTimestamp: 1733322601000,
      }

      const result = parseLogEntry(raw)

      expect(result.logs[0].level).toBe('log')
      expect(result.logs[1].level).toBe('error')
      expect(result.logs[2].level).toBe('warn')
      expect(result.logs[3].level).toBe('info')
      expect(result.logs[4].level).toBe('debug')
      expect(result.logs[5].level).toBe('log') // Unknown defaults to 'log'
    })
  })

  describe('tryParseLogLine', () => {
    it('should parse valid JSON log line', () => {
      const line = JSON.stringify({
        outcome: 'ok',
        scriptName: 'test-worker',
        exceptions: [],
        logs: [],
        eventTimestamp: 1733322601000,
        event: {
          request: {
            url: 'https://test.workers.dev/api/test',
            method: 'GET',
          },
        },
      })

      const result = tryParseLogLine(line)

      expect(result).not.toBeNull()
      expect(result?.method).toBe('GET')
      expect(result?.path).toBe('/api/test')
    })

    it('should return null for invalid JSON', () => {
      const line = 'Not a JSON string'

      const result = tryParseLogLine(line)

      expect(result).toBeNull()
    })

    it('should return null for JSON without required fields', () => {
      const line = JSON.stringify({
        // Missing outcome, scriptName, eventTimestamp
        logs: [],
        exceptions: [],
      })

      const result = tryParseLogLine(line)

      expect(result).toBeNull()
    })

    it('should return null for valid JSON that is not wrangler output', () => {
      const line = JSON.stringify({
        message: 'Some other JSON',
        timestamp: Date.now(),
      })

      const result = tryParseLogLine(line)

      expect(result).toBeNull()
    })

    it('should handle empty string', () => {
      const result = tryParseLogLine('')

      expect(result).toBeNull()
    })
  })
})
