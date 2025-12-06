/**
 * @module api-backend.test
 * @description Tests for api-backend template structure (no frontend files)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Template path relative to monorepo root
const TEMPLATE_DIR = resolve(__dirname, '../../../../templates/api-backend')

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

describe('api-backend template', () => {
  let templateFiles: string[]

  beforeAll(() => {
    templateFiles = getAllFiles(TEMPLATE_DIR)
  })

  describe('structure completeness', () => {
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

    it('should have API route structure', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/routes/api/v1/health.ts'))).toBe(true)
      expect(existsSync(join(TEMPLATE_DIR, 'src/routes/api/v1/users.ts'))).toBe(true)
    })

    it('should have models directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/models/user.ts'))).toBe(true)
    })

    it('should have schemas directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/schemas/user.ts'))).toBe(true)
    })

    it('should have services directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/services/user-service.ts'))).toBe(true)
    })

    it('should have types directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/types/index.ts'))).toBe(true)
    })

    it('should have tests directory with API tests', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'tests/routes/api/v1/users.test.ts'))).toBe(true)
    })

    it('should have service tests', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'tests/services/user-service.test.ts'))).toBe(true)
    })
  })

  describe('no frontend files (AC: #2)', () => {
    it('should NOT have React files', () => {
      const reactFiles = templateFiles.filter((f) => f.endsWith('.tsx'))
      expect(reactFiles, 'Should not contain .tsx files').toEqual([])
    })

    it('should NOT have React dependencies in package.json', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'package.json'), 'utf-8')
      const pkg = JSON.parse(content)

      const deps = pkg.dependencies || {}
      const devDeps = pkg.devDependencies || {}

      expect(deps.react).toBeUndefined()
      expect(deps['react-dom']).toBeUndefined()
      expect(devDeps['@types/react']).toBeUndefined()
      expect(devDeps['@types/react-dom']).toBeUndefined()
    })

    it('should NOT have tailwind.config.js', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'tailwind.config.js'))).toBe(false)
    })

    it('should NOT have CSS files', () => {
      const cssFiles = templateFiles.filter((f) => f.endsWith('.css'))
      expect(cssFiles, 'Should not contain CSS files').toEqual([])
    })

    it('should NOT have public directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'public'))).toBe(false)
    })

    it('should NOT have App.tsx or main.tsx', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/App.tsx'))).toBe(false)
      expect(existsSync(join(TEMPLATE_DIR, 'src/main.tsx'))).toBe(false)
    })

    it('should NOT have components directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/components'))).toBe(false)
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

    it('should have Zod for validation', () => {
      const deps = pkg.dependencies as Record<string, string>
      expect(deps.zod).toBeDefined()
    })

    it('should have TypeScript', () => {
      const devDeps = pkg.devDependencies as Record<string, string>
      expect(devDeps.typescript).toBeDefined()
    })

    it('should have Vitest', () => {
      const devDeps = pkg.devDependencies as Record<string, string>
      expect(devDeps.vitest).toBeDefined()
    })
  })

  describe('API endpoints', () => {
    it('should have health check endpoint that returns status', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'src/routes/api/v1/health.ts'), 'utf-8')
      expect(content).toContain('GET')
      expect(content).toContain('status')
    })

    it('should have users endpoint with CRUD operations', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'src/routes/api/v1/users.ts'), 'utf-8')
      expect(content).toContain('GET')
      expect(content).toContain('POST')
      expect(content).toContain('PUT')
      expect(content).toContain('DELETE')
    })
  })

  describe('service layer', () => {
    it('should have UserService with business logic', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'src/services/user-service.ts'), 'utf-8')
      expect(content).toContain('class UserService')
      expect(content).toContain('findAll')
      expect(content).toContain('create')
      expect(content).toContain('update')
      expect(content).toContain('delete')
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
  })
})
