/**
 * @module fullstack-react.test
 * @description Tests for fullstack-react template structure completeness
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Template path relative to monorepo root
const TEMPLATE_DIR = resolve(__dirname, '../../../../templates/fullstack-react')

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

describe('fullstack-react template', () => {
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

    it('should NOT have tailwind.config.js (v4.1 uses CSS-first config)', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'tailwind.config.js'))).toBe(false)
    })

    it('should have src/routes/ directory with index.tsx', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/routes/index.tsx'))).toBe(true)
    })

    it('should have API route structure', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/routes/api/v1/users.ts'))).toBe(true)
    })

    it('should have components directory with UI components', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/components/ui/button.tsx'))).toBe(true)
    })

    it('should have models directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/models/user.ts'))).toBe(true)
    })

    it('should have schemas directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/schemas/user.ts'))).toBe(true)
    })

    it('should have types directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/types/index.ts'))).toBe(true)
    })

    it('should have public directory', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'public'))).toBe(true)
    })

    it('should have tests directory with mirrored structure', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'tests/routes/api/v1/users.test.ts'))).toBe(true)
    })

    it('should have React entry files', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'src/main.tsx'))).toBe(true)
      expect(existsSync(join(TEMPLATE_DIR, 'src/App.tsx'))).toBe(true)
      expect(existsSync(join(TEMPLATE_DIR, 'src/index.css'))).toBe(true)
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

    it('should have React dependencies', () => {
      const deps = pkg.dependencies as Record<string, string>
      expect(deps.react).toBeDefined()
      expect(deps['react-dom']).toBeDefined()
    })

    it('should have ixflare workspace dependency', () => {
      const deps = pkg.dependencies as Record<string, string>
      expect(deps.ixflare).toBe('workspace:*')
    })

    it('should have Zod for validation', () => {
      const deps = pkg.dependencies as Record<string, string>
      expect(deps.zod).toBeDefined()
    })

    it('should have Tailwind CSS', () => {
      const devDeps = pkg.devDependencies as Record<string, string>
      expect(devDeps.tailwindcss).toBeDefined()
    })

    it('should have TypeScript', () => {
      const devDeps = pkg.devDependencies as Record<string, string>
      expect(devDeps.typescript).toBeDefined()
    })

    it('should have Vitest', () => {
      const devDeps = pkg.devDependencies as Record<string, string>
      expect(devDeps.vitest).toBeDefined()
    })

    it('should have React types', () => {
      const devDeps = pkg.devDependencies as Record<string, string>
      expect(devDeps['@types/react']).toBeDefined()
      expect(devDeps['@types/react-dom']).toBeDefined()
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

    it('should use template variables in README', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'README.md'), 'utf-8')
      expect(content).toContain('{{projectName}}')
    })
  })

  describe('file naming conventions', () => {
    it('should use kebab-case for source files', () => {
      const srcFiles = templateFiles.filter((f) => f.startsWith('src/') && f.endsWith('.ts'))
      for (const file of srcFiles) {
        const fileName = file
          .split('/')
          .pop()!
          .replace(/\.tsx?$/, '')
        // Allow index as a special case
        if (fileName === 'index') continue
        // Check for kebab-case (lowercase with hyphens) or single word
        expect(
          fileName.match(/^[a-z]+(-[a-z]+)*$/),
          `File ${file} should be kebab-case`
        ).toBeTruthy()
      }
    })

    it('should use .tsx extension for React components', () => {
      expect(templateFiles.some((f) => f.endsWith('.tsx'))).toBe(true)
    })

    it('should use .test.ts extension for test files', () => {
      const testFiles = templateFiles.filter((f) => f.includes('tests/'))
      for (const file of testFiles) {
        if (!file.includes('.gitkeep')) {
          expect(file.endsWith('.test.ts'), `Test file ${file} should end with .test.ts`).toBe(true)
        }
      }
    })
  })

  describe('Tailwind CSS v4.1 integration', () => {
    it('should have @tailwindcss/vite in devDependencies', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'package.json'), 'utf-8')
      const pkg = JSON.parse(content)
      const devDeps = pkg.devDependencies as Record<string, string>
      expect(devDeps['@tailwindcss/vite']).toBeDefined()
      expect(devDeps['@tailwindcss/vite']).toMatch(/^\^4\./)
    })

    it('should have tailwindcss v4.1+ in devDependencies', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'package.json'), 'utf-8')
      const pkg = JSON.parse(content)
      const devDeps = pkg.devDependencies as Record<string, string>
      expect(devDeps.tailwindcss).toBeDefined()
      expect(devDeps.tailwindcss).toMatch(/^\^4\.1/)
    })

    it('should NOT have tailwind.config.js (v4.1 CSS-first pattern)', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'tailwind.config.js'))).toBe(false)
    })

    it('should NOT have postcss.config.js (v4.1 uses Vite plugin)', () => {
      expect(existsSync(join(TEMPLATE_DIR, 'postcss.config.js'))).toBe(false)
    })

    it('should have vite.config.ts with tailwindcss() plugin', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'vite.config.ts'), 'utf-8')
      expect(content).toContain("import tailwindcss from '@tailwindcss/vite'")
      expect(content).toContain('tailwindcss()')
    })

    it('should use @import "tailwindcss" syntax in index.css', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'src/index.css'), 'utf-8')
      expect(content).toContain('@import "tailwindcss"')
      // Should NOT use v3.x syntax
      expect(content).not.toContain('@tailwind base')
      expect(content).not.toContain('@tailwind components')
      expect(content).not.toContain('@tailwind utilities')
    })

    it('should have @theme directive with custom design tokens', () => {
      const content = readFileSync(join(TEMPLATE_DIR, 'src/index.css'), 'utf-8')
      expect(content).toContain('@theme')
      expect(content).toContain('--color-brand')
    })

    it('should have dark mode variant support in components', () => {
      const cardContent = readFileSync(join(TEMPLATE_DIR, 'src/components/ui/card.tsx'), 'utf-8')
      expect(cardContent).toContain('dark:')
    })

    it('should use Tailwind utility classes in components', () => {
      const buttonContent = readFileSync(
        join(TEMPLATE_DIR, 'src/components/ui/button.tsx'),
        'utf-8'
      )
      expect(buttonContent).toContain('className')
      expect(buttonContent).toMatch(/bg-\w+/)
      expect(buttonContent).toMatch(/text-\w+/)
    })
  })
})
