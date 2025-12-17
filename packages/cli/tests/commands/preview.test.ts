import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { parsePreviewArgs } from '../../src/commands/preview'

describe('preview command', () => {
  describe('parsePreviewArgs', () => {
    let mockExit: ReturnType<typeof vi.spyOn>
    let mockConsoleError: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
      mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      mockExit.mockRestore()
      mockConsoleError.mockRestore()
    })

    it('should return default options when no args provided', () => {
      const options = parsePreviewArgs([])

      expect(options).toEqual({
        port: 3001,
        open: false,
      })
    })

    it('should parse --port flag with valid port', () => {
      const options = parsePreviewArgs(['--port', '3002'])

      expect(options.port).toBe(3002)
    })

    it('should parse --env flag', () => {
      const options = parsePreviewArgs(['--env', 'production'])

      expect(options.env).toBe('production')
    })

    it('should parse --open flag', () => {
      const options = parsePreviewArgs(['--open'])

      expect(options.open).toBe(true)
    })

    it('should parse multiple flags together', () => {
      const options = parsePreviewArgs(['--port', '4000', '--env', 'staging', '--open'])

      expect(options).toEqual({
        port: 4000,
        env: 'staging',
        open: true,
      })
    })

    it('should exit with error for invalid port (non-numeric)', () => {
      parsePreviewArgs(['--port', 'invalid'])

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid port: "invalid"'),
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should exit with error for port below valid range', () => {
      parsePreviewArgs(['--port', '0'])

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Invalid port: "0"'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should exit with error for port above valid range', () => {
      parsePreviewArgs(['--port', '65536'])

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid port: "65536"'),
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should accept minimum valid port (1)', () => {
      const options = parsePreviewArgs(['--port', '1'])

      expect(options.port).toBe(1)
    })

    it('should accept maximum valid port (65535)', () => {
      const options = parsePreviewArgs(['--port', '65535'])

      expect(options.port).toBe(65535)
    })

    it('should handle --port without value by using default', () => {
      const options = parsePreviewArgs(['--port'])

      // When --port is present but no value follows, it's undefined
      // parseInt(undefined) returns NaN, which fails validation
      // However, the loop structure means it just gets skipped
      expect(options.port).toBe(3001) // Uses default
    })

    it('should handle --env without value', () => {
      const options = parsePreviewArgs(['--env'])

      // env should remain undefined when no value provided
      expect(options.env).toBeUndefined()
    })

    it('should ignore unknown flags', () => {
      const options = parsePreviewArgs(['--unknown', 'value', '--port', '3003'])

      expect(options.port).toBe(3003)
      expect(options).not.toHaveProperty('unknown')
    })

    it('should use default port 3001 (different from dev port 3000)', () => {
      const options = parsePreviewArgs([])

      expect(options.port).toBe(3001)
      expect(options.port).not.toBe(3000) // Explicitly test it's not dev port
    })

    it('should handle environment names with special characters', () => {
      const options = parsePreviewArgs(['--env', 'staging-us-west-1'])

      expect(options.env).toBe('staging-us-west-1')
    })

    it('should parse flags in any order', () => {
      const options1 = parsePreviewArgs(['--open', '--port', '3005', '--env', 'prod'])
      const options2 = parsePreviewArgs(['--env', 'prod', '--open', '--port', '3005'])

      expect(options1).toEqual(options2)
    })

    it('should handle duplicate flags by using last value', () => {
      const options = parsePreviewArgs(['--port', '3001', '--port', '3002'])

      expect(options.port).toBe(3002)
    })

    it('should handle negative port numbers as invalid', () => {
      parsePreviewArgs(['--port', '-1'])

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Invalid port: "-1"'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should handle floating point port numbers by parsing as integer', () => {
      // parseInt('3000.5') returns 3000, which is valid
      const options = parsePreviewArgs(['--port', '3000.5'])

      expect(options.port).toBe(3000)
    })

    it('should preserve case in environment names', () => {
      const options = parsePreviewArgs(['--env', 'Production'])

      expect(options.env).toBe('Production')
    })
  })
})
