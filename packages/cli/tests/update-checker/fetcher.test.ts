/**
 * Tests for npm registry version fetcher
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchLatestVersion } from '../../src/update-checker/fetcher'

describe('fetchLatestVersion', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('should fetch latest version from npm registry', async () => {
    // Mock successful response
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.2.3' }),
    } as Response)

    const version = await fetchLatestVersion('ixflare')

    expect(version).toBe('1.2.3')
    expect(fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/ixflare/latest',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      })
    )
  })

  it('should return null on network error', async () => {
    // Mock network error
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const version = await fetchLatestVersion('ixflare')

    expect(version).toBeNull()
  })

  it('should return null on non-ok response', async () => {
    // Mock 404 response
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    const version = await fetchLatestVersion('ixflare')

    expect(version).toBeNull()
  })

  it('should return null on timeout (aborted request)', async () => {
    // Mock timeout by throwing AbortError
    vi.mocked(fetch).mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const version = await fetchLatestVersion('ixflare')

    expect(version).toBeNull()
  })

  it('should return null on invalid JSON response', async () => {
    // Mock invalid JSON
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Invalid JSON')
      },
    } as Response)

    const version = await fetchLatestVersion('ixflare')

    expect(version).toBeNull()
  })

  it('should include abort signal for timeout handling', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    } as Response)

    await fetchLatestVersion('ixflare')

    const callArgs = vi.mocked(fetch).mock.calls[0]
    expect(callArgs[1]).toHaveProperty('signal')
    expect(callArgs[1]?.signal).toBeInstanceOf(AbortSignal)
  })
})
