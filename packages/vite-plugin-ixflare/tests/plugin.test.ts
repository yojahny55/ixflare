import { describe, it, expect } from 'vitest'
import { ixflarePlugin } from '../src/plugin'

describe('Vite Plugin', () => {
  it('should create plugin with correct name', () => {
    const plugin = ixflarePlugin()

    expect(plugin.name).toBe('vite-plugin-ixflare')
  })

  it('should accept options', () => {
    const plugin = ixflarePlugin({ routesDir: 'app/routes', hmr: false })

    expect(plugin).toBeDefined()
  })

  it('should configure build target to esnext', () => {
    const plugin = ixflarePlugin()

    if (typeof plugin.config === 'function') {
      const config = plugin.config({}, { command: 'build', mode: 'production' })
      expect(config?.build?.target).toBe('esnext')
    }
  })
})
