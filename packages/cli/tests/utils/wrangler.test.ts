/**
 * @module tests/utils/wrangler
 * @description Tests for wrangler authentication detection utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import {
  isWranglerInstalled,
  detectAuthMethod,
  getWranglerConfigPath,
  isAuthenticated,
  hasAccountId,
} from '../../src/utils/wrangler'

vi.mock('child_process')
vi.mock('fs')

describe('wrangler utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env vars
    delete process.env.CLOUDFLARE_API_TOKEN
    delete process.env.CLOUDFLARE_ACCOUNT_ID
  })

  describe('isWranglerInstalled', () => {
    it('should return true when wrangler is installed', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('3.0.0'))

      const result = isWranglerInstalled()

      expect(result).toBe(true)
      expect(execSync).toHaveBeenCalledWith('wrangler --version', { stdio: 'pipe' })
    })

    it('should return false when wrangler is not installed', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command not found')
      })

      const result = isWranglerInstalled()

      expect(result).toBe(false)
    })
  })

  describe('detectAuthMethod', () => {
    it('should detect API token from env var', () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'

      const result = detectAuthMethod()

      expect(result).toBe('api_token')
    })

    it('should detect OAuth from config file', () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const result = detectAuthMethod()

      expect(result).toBe('oauth')
    })

    it('should return none when no auth configured', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const result = detectAuthMethod()

      expect(result).toBe('none')
    })

    it('should prioritize API token over OAuth', () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'
      vi.mocked(existsSync).mockReturnValue(true)

      const result = detectAuthMethod()

      expect(result).toBe('api_token')
    })
  })

  describe('getWranglerConfigPath', () => {
    const originalPlatform = process.platform

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      })
    })

    it('should return macOS path on darwin', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      })
      process.env.HOME = '/Users/test'

      const path = getWranglerConfigPath()

      expect(path).toBe('/Users/test/Library/Preferences/.wrangler/config/default.toml')
    })

    it('should return Windows path on win32', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      })
      const originalHome = process.env.HOME
      delete process.env.HOME
      process.env.USERPROFILE = 'C:\\Users\\test'

      const path = getWranglerConfigPath()

      // On Windows, path should contain backslashes from USERPROFILE
      // but path.join will normalize to platform-specific separators
      // Check that it starts with the home and contains the config path
      expect(path).toContain('C:\\Users\\test')
      expect(path).toContain('.wrangler')
      expect(path).toContain('config')
      expect(path).toContain('default.toml')

      // Restore
      if (originalHome) process.env.HOME = originalHome
    })

    it('should return Linux path on other platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      })
      process.env.HOME = '/home/test'

      const path = getWranglerConfigPath()

      expect(path).toBe('/home/test/.config/.wrangler/config/default.toml')
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when wrangler whoami succeeds', async () => {
      vi.mocked(execSync).mockReturnValue(
        Buffer.from('You are logged in with an API Token')
      )

      const result = await isAuthenticated()

      expect(result).toBe(true)
      expect(execSync).toHaveBeenCalledWith('wrangler whoami', { stdio: 'pipe' })
    })

    it('should return false when wrangler whoami fails', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not authenticated')
      })

      const result = await isAuthenticated()

      expect(result).toBe(false)
    })
  })

  describe('hasAccountId', () => {
    it('should return true when CLOUDFLARE_ACCOUNT_ID env var is set', () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id'

      const result = hasAccountId()

      expect(result).toBe(true)
    })

    it('should return true when account_id exists in wrangler.toml', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue('account_id = "test-account-id"')

      const result = hasAccountId()

      expect(result).toBe(true)
    })

    it('should return false when account_id not found in wrangler.toml', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue('name = "my-worker"')

      const result = hasAccountId()

      expect(result).toBe(false)
    })

    it('should return false when wrangler.toml does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const result = hasAccountId()

      expect(result).toBe(false)
    })

    it('should handle readFileSync errors gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File read error')
      })

      const result = hasAccountId()

      expect(result).toBe(false)
    })
  })
})
