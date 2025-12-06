/**
 * @module tests/commands/deploy/first-time-guide
 * @description Tests for first-time deployment guide
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execSync } from 'child_process'
import prompts from 'prompts'
import {
  showFirstTimeGuide,
  promptCloudflareAccount,
  validateAndStoreCredentials,
} from '../../../src/commands/deploy/first-time-guide'

vi.mock('child_process')
vi.mock('prompts')

describe('first-time-guide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('showFirstTimeGuide', () => {
    it('should return false when user does not have account', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({ hasAccount: false })

      const result = await showFirstTimeGuide()

      expect(result).toBe(false)
    })

    it('should authenticate via browser and return true on success', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ hasAccount: true })
        .mockResolvedValueOnce({ authMethod: 'browser' })

      vi.mocked(execSync).mockReturnValue(Buffer.from('Success'))

      const result = await showFirstTimeGuide()

      expect(result).toBe(true)
      expect(execSync).toHaveBeenCalledWith('wrangler login', { stdio: 'inherit' })
    })

    it('should return false when browser auth fails', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ hasAccount: true })
        .mockResolvedValueOnce({ authMethod: 'browser' })

      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Auth failed')
      })

      const result = await showFirstTimeGuide()

      expect(result).toBe(false)
    })

    it('should return false when user chooses API token method', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ hasAccount: true })
        .mockResolvedValueOnce({ authMethod: 'token' })

      const result = await showFirstTimeGuide()

      expect(result).toBe(false)
    })
  })

  describe('promptCloudflareAccount', () => {
    it('should return true when user has account', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({ hasAccount: true })

      const result = await promptCloudflareAccount()

      expect(result).toBe(true)
    })

    it('should return false when user does not have account', async () => {
      vi.mocked(prompts).mockResolvedValueOnce({ hasAccount: false })

      const result = await promptCloudflareAccount()

      expect(result).toBe(false)
    })
  })

  describe('validateAndStoreCredentials', () => {
    it('should return true when credentials are valid', async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('User info'))

      const result = await validateAndStoreCredentials()

      expect(result).toBe(true)
      expect(execSync).toHaveBeenCalledWith('wrangler whoami', { stdio: 'pipe' })
    })

    it('should return false when credentials are invalid', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not authenticated')
      })

      const result = await validateAndStoreCredentials()

      expect(result).toBe(false)
    })
  })
})
