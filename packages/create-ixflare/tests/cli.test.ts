import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Create Ixflare CLI', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('should have scaffold function', async () => {
    const { scaffold } = await import('../src/scaffold')
    expect(scaffold).toBeDefined()
    expect(typeof scaffold).toBe('function')
  })

  it('should accept valid options and execute without error', async () => {
    const { scaffold } = await import('../src/scaffold')

    await expect(scaffold({
      projectName: 'test-app',
      template: 'minimal',
      packageManager: 'pnpm',
    })).resolves.toBeUndefined()
  })

  it('should log project creation message with project name', async () => {
    const { scaffold } = await import('../src/scaffold')

    await scaffold({
      projectName: 'my-awesome-app',
      template: 'minimal',
      packageManager: 'pnpm',
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('my-awesome-app')
    )
  })

  it('should log template name in creation message', async () => {
    const { scaffold } = await import('../src/scaffold')

    await scaffold({
      projectName: 'test-app',
      template: 'fullstack-react',
      packageManager: 'npm',
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('fullstack-react')
    )
  })

  it('should include package manager in next steps', async () => {
    const { scaffold } = await import('../src/scaffold')

    await scaffold({
      projectName: 'test-app',
      template: 'minimal',
      packageManager: 'yarn',
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('yarn dev')
    )
  })

  it('should accept all valid template options', async () => {
    const { scaffold } = await import('../src/scaffold')
    const templates = ['minimal', 'fullstack-react', 'api-backend']

    for (const template of templates) {
      await expect(scaffold({
        projectName: 'test-app',
        template: template as 'minimal' | 'fullstack-react' | 'api-backend',
        packageManager: 'pnpm',
      })).resolves.toBeUndefined()
    }
  })
})
