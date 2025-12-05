import { describe, it, expect } from 'vitest'

describe('CLI', () => {
  it('should export dev command', async () => {
    const { dev } = await import('../src/commands/dev')
    expect(dev).toBeDefined()
    expect(typeof dev).toBe('function')
  })

  it('should export build command', async () => {
    const { build } = await import('../src/commands/build')
    expect(build).toBeDefined()
    expect(typeof build).toBe('function')
  })

  it('should export deploy command', async () => {
    const { deploy } = await import('../src/commands/deploy')
    expect(deploy).toBeDefined()
    expect(typeof deploy).toBe('function')
  })

  it('should export migrate command', async () => {
    const { migrate } = await import('../src/commands/migrate')
    expect(migrate).toBeDefined()
    expect(typeof migrate).toBe('function')
  })

  it('should export generate command', async () => {
    const { generate } = await import('../src/commands/generate')
    expect(generate).toBeDefined()
    expect(typeof generate).toBe('function')
  })
})
