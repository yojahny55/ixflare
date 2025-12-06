/**
 * @module minimal.test
 * @description Tests for minimal template structure (minimal files only)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Template path relative to monorepo root
const TEMPLATE_DIR = resolve(__dirname, '../../../../templates/minimal')

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      if (!['node_modules', 'dist', '.wrangler'].includes(entry)) {
        getAllFiles(fullPath, files)
      }
    } else {
      files.push(fullPath.replace(TEMPLATE_DIR + '/', ''))
    }
  }
  return files
}

describe('minimal template', () => {
  let templateFiles: string[]

  beforeAll(() => {
    templateFiles = getAllFiles(TEMPLATE_DIR)
  })

  describe('structure completeness (AC: #3)', () => {
    it('should have template directory', () => {
      expect(existsSync(TEMPLATE_DIR)).toBe(true)
    })

    it('should have required root files', () => {
      const requiredFiles = [
        'package.json',
        'edge.config.ts',
        'wrangler.toml',
        'vite.config.ts',
        'tsconfig.json',
        '_gitignore',
        '_env.example',
        'README.md',
      ]

      for (const file of requiredFiles) {
        expect(existsSync(join(TEMPLATE_DIR, file)), `Missing: ${file}`).toBe(true)
      }
    })

    it('should have example route demonstrating routing pattern', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/routes/index.ts'))).toBe(true)
    })

    it('should have example model demonstrating EdgeRecord ORM', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/models/example.ts'))).toBe(true)
    })

    it('should have example test demonstrating testing pattern', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'tests/example.test.ts'))).toBe(true)
    })

    it('should have types directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/types/index.ts'))).toBe(true)
    })
  })

  describe('truly minimal (no extra files)', () => {
    it('should NOT have React files', () => {
      const reactFiles = templateFiles.filter((f) => f.endsWith('.tsx'))
      expect(reactFiles, 'Should not contain .tsx files').toEqual([])
    })

    it('should NOT have CSS files', () => {
      const cssFiles = templateFiles.filter((f) => f.endsWith('.css'))
      expect(cssFiles, 'Should not contain CSS files').toEqual([])
    })

    it('should NOT have tailwind config', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'tailwind.config.js'))).toBe(false)
    })

    it('should NOT have public directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'public'))).toBe(false)
    })

    it('should NOT have components directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/components'))).toBe(false)
    })

    it('should NOT have services directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/services'))).toBe(false)
    })

    it('should NOT have schemas directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/schemas'))).toBe(false)
    })

    it('should have minimal number of source files', () => {
      const srcFiles = templateFiles.filter((f) => f.startsWith('src/') && f.endsWith('.ts'))
      // Should only have: index.ts, routes/index.ts, models/example.ts, types/index.ts
      expect(srcFiles.length).toBeLessThanOrEqual(5)
    })

    it('should have minimal number of test files', () => {
      const testFiles = templateFiles.filter((f) => f.startsWith('tests/') && f.endsWith('.ts'))
      // Should only have example.test.ts
      expect(testFiles.length).toBeLessThanOrEqual(2)
    })
  })

  describe('package.json', () => {
    let pkg: Record<string, unknown>

    beforeAll(() => {
      const content = readFileSync(join(TEMPLATE_DIR, 'package.json'), 'utf-8')
      pkg = JSON.parse(content)
    })

    it('should have correct project name template variable', () => {
      expect(pkg.name).toBe('{{projectName}}')
    })

    it('should have required scripts', () => {
      const scripts = pkg.scripts as Record<string, string>
      expect(scripts.dev).toBe('ix dev')
      expect(scripts.build).toBe('ix build')
      expect(scripts.deploy).toBe('ix deploy')
      expect(scripts.test).toContain('vitest')
    })

    it('should have ixflare workspace dependency', () => {
      const deps = pkg.dependencies as Record<string, string>
      expect(deps.ixflare).toBe('workspace:*')
    })

    it('should NOT have Zod (minimal template)', () => {
      const deps = pkg.dependencies as Record<string, string>
      expect(deps.zod).toBeUndefined()
    })

    it('should NOT have React dependencies', () => {
      const deps = pkg.dependencies as Record<string, string>
      expect(deps.react).toBeUndefined()
      expect(deps['react-dom']).toBeUndefined()
    })

    it('should have minimal devDependencies', () => {
      const devDeps = pkg.devDependencies as Record<string, string>
      // Core tools only
      expect(devDeps.typescript).toBeDefined()
      expect(devDeps.vitest).toBeDefined()
      expect(devDeps.vite).toBeDefined()
      expect(devDeps.wrangler).toBeDefined()

      // Should NOT have extras
      expect(devDeps.tailwindcss).toBeUndefined()
      expect(devDeps.eslint).toBeUndefined()
    })
  })

  describe('example route', () => {
    it('should demonstrate basic route pattern', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'src/routes/index.ts'), 'utf-8')
      expect(content).toContain('GET')
      expect(content).toContain('RouteContext')
      expect(content).toContain('Response')
    })
  })

  describe('example model', () => {
    it('should demonstrate EdgeRecord pattern', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'src/models/example.ts'), 'utf-8')
      expect(content).toContain('class Example')
      expect(content).toContain('tableName')
      expect(content).toContain('create')
      expect(content).toContain('find')
    })
  })

  describe('example test', () => {
    it('should demonstrate testing pattern', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'tests/example.test.ts'), 'utf-8')
      expect(content).toContain('describe')
      expect(content).toContain('it')
      expect(content).toContain('expect')
      expect(content).toContain('vitest')
    })
  })

  describe('template variable replacement', () => {
    it('should use {{projectName}} in package.json', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'package.json'), 'utf-8')
      expect(content).toContain('{{projectName}}')
    })

    it('should use {{projectNamePascal}} in entry files', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'src/index.ts'), 'utf-8')
      expect(content).toContain('{{projectNamePascal}}')
    })

    it('should use template variables in route handler', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'src/routes/index.ts'), 'utf-8')
      expect(content).toContain('{{projectName}}')
    })
  })
})
