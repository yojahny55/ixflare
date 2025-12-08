/**
 * @module detect-pm.test
 * @description Tests for package manager detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import {
  detectPackageManager,
  detectPackageManagerWithDefault,
  detectFromLockfile,
  detectFromPackageJson,
  detectFromEnvironment,
  getInstallCommand,
  getRunCommand,
} from '../src/detect-pm'

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

describe('detectFromLockfile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should detect pnpm from pnpm-lock.yaml', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('pnpm-lock.yaml')
    })

    const result = detectFromLockfile('/test')
    expect(result).toBe('pnpm')
  })

  it('should detect npm from package-lock.json', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('package-lock.json')
    })

    const result = detectFromLockfile('/test')
    expect(result).toBe('npm')
  })

  it('should detect bun from bun.lockb', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('bun.lockb')
    })

    const result = detectFromLockfile('/test')
    expect(result).toBe('bun')
  })

  it('should detect bun from bun.lock', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('bun.lock')
    })

    const result = detectFromLockfile('/test')
    expect(result).toBe('bun')
  })

  it('should fall back to npm for yarn.lock', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('yarn.lock')
    })

    const result = detectFromLockfile('/test')
    expect(result).toBe('npm')
  })

  it('should return null when no lockfile found', () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const result = detectFromLockfile('/test')
    expect(result).toBeNull()
  })

  it('should prioritize pnpm over npm', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path)
      return p.endsWith('pnpm-lock.yaml') || p.endsWith('package-lock.json')
    })

    const result = detectFromLockfile('/test')
    expect(result).toBe('pnpm')
  })
})

describe('detectFromPackageJson', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should detect pnpm from packageManager field', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ packageManager: 'pnpm@8.0.0' }))

    const result = detectFromPackageJson('/test')
    expect(result).toBe('pnpm')
  })

  it('should detect npm from packageManager field', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ packageManager: 'npm@10.0.0' }))

    const result = detectFromPackageJson('/test')
    expect(result).toBe('npm')
  })

  it('should detect bun from packageManager field', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ packageManager: 'bun@1.0.0' }))

    const result = detectFromPackageJson('/test')
    expect(result).toBe('bun')
  })

  it('should return null when package.json does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const result = detectFromPackageJson('/test')
    expect(result).toBeNull()
  })

  it('should return null when packageManager field is missing', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ name: 'test' }))

    const result = detectFromPackageJson('/test')
    expect(result).toBeNull()
  })

  it('should handle JSON parse errors gracefully', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue('invalid json')

    const result = detectFromPackageJson('/test')
    expect(result).toBeNull()
  })
})

describe('detectFromEnvironment', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should detect pnpm from npm_config_user_agent', () => {
    process.env.npm_config_user_agent = 'pnpm/8.0.0 npm/? node/v18.0.0'

    const result = detectFromEnvironment()
    expect(result).toBe('pnpm')
  })

  it('should detect npm from npm_config_user_agent', () => {
    process.env.npm_config_user_agent = 'npm/10.0.0 node/v18.0.0'

    const result = detectFromEnvironment()
    expect(result).toBe('npm')
  })

  it('should detect bun from npm_config_user_agent', () => {
    process.env.npm_config_user_agent = 'bun/1.0.0'

    const result = detectFromEnvironment()
    expect(result).toBe('bun')
  })

  it('should return null when npm_config_user_agent is not set', () => {
    delete process.env.npm_config_user_agent

    const result = detectFromEnvironment()
    expect(result).toBeNull()
  })
})

describe('detectPackageManager', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    // Clear environment to isolate tests
    process.env = { ...originalEnv }
    delete process.env.npm_config_user_agent
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return null when nothing detected', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ name: 'test' }))

    const result = detectPackageManager('/test')
    expect(result).toBeNull()
  })

  it('should detect from lockfile first', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('pnpm-lock.yaml')
    })

    const result = detectPackageManager('/test')
    expect(result).toBe('pnpm')
  })

  it('should detect from environment when no lockfile or package.json hint', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    process.env.npm_config_user_agent = 'bun/1.0.0'

    const result = detectPackageManager('/test')
    expect(result).toBe('bun')
  })
})

describe('detectPackageManagerWithDefault', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...originalEnv }
    delete process.env.npm_config_user_agent
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return npm as default when nothing detected', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ name: 'test' }))

    const result = detectPackageManagerWithDefault('/test')
    expect(result).toBe('npm')
  })

  it('should return detected PM when available', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('pnpm-lock.yaml')
    })

    const result = detectPackageManagerWithDefault('/test')
    expect(result).toBe('pnpm')
  })
})

describe('getInstallCommand', () => {
  it('should return correct command for npm', () => {
    expect(getInstallCommand('npm')).toBe('npm install')
  })

  it('should return correct command for pnpm', () => {
    expect(getInstallCommand('pnpm')).toBe('pnpm install')
  })

  it('should return correct command for bun', () => {
    expect(getInstallCommand('bun')).toBe('bun install')
  })
})

describe('getRunCommand', () => {
  it('should return correct command for npm', () => {
    expect(getRunCommand('npm')).toBe('npm run')
  })

  it('should return correct command for pnpm', () => {
    expect(getRunCommand('pnpm')).toBe('pnpm')
  })

  it('should return correct command for bun', () => {
    expect(getRunCommand('bun')).toBe('bun run')
  })
})
