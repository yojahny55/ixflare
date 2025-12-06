/**
 * @module integration.test
 * @description Integration tests for full scaffold flow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  scaffold,
  copyTemplateDir,
  copyTemplateFile,
  getTemplatesDir,
  templateExists,
  getTemplateVars,
  replaceTemplateVars,
} from '../src/scaffold'
import { ScaffoldError } from '../src/types'

describe('Integration: scaffold flow', () => {
  let tempDir: string
  let templatesDir: string

  beforeEach(() => {
    // Create temp directories for testing
    tempDir = mkdtempSync(join(tmpdir(), 'create-ixflare-test-'))
    templatesDir = join(tempDir, 'templates')

    // Create mock templates structure
    mkdirSync(join(templatesDir, 'minimal', 'src'), { recursive: true })
    writeFileSync(
      join(templatesDir, 'minimal', 'package.json'),
      '{"name": "{{projectName}}", "version": "0.0.1"}'
    )
    writeFileSync(
      join(templatesDir, 'minimal', 'README.md'),
      '# {{projectNamePascal}}\n\nWelcome to {{projectName}}'
    )
    writeFileSync(
      join(templatesDir, 'minimal', 'src', 'index.ts'),
      'export const APP_NAME = "{{projectNamePascal}}"'
    )
    writeFileSync(join(templatesDir, 'minimal', '_gitignore'), 'node_modules/\ndist/')

    // Set env var for templates dir
    process.env.IXFLARE_TEMPLATES_DIR = templatesDir
  })

  afterEach(() => {
    // Clean up
    delete process.env.IXFLARE_TEMPLATES_DIR
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('copyTemplateFile', () => {
    it('should copy a text file with variable replacement', () => {
      const srcPath = join(templatesDir, 'minimal', 'package.json')
      const destPath = join(tempDir, 'output', 'package.json')
      const vars = { projectName: 'my-app' }

      copyTemplateFile(srcPath, destPath, vars)

      expect(existsSync(destPath)).toBe(true)
      const content = readFileSync(destPath, 'utf-8')
      expect(content).toBe('{"name": "my-app", "version": "0.0.1"}')
    })

    it('should replace multiple variables in a file', () => {
      const srcPath = join(templatesDir, 'minimal', 'README.md')
      const destPath = join(tempDir, 'output', 'README.md')
      const vars = {
        projectName: 'my-app',
        projectNamePascal: 'MyApp',
      }

      copyTemplateFile(srcPath, destPath, vars)

      const content = readFileSync(destPath, 'utf-8')
      expect(content).toBe('# MyApp\n\nWelcome to my-app')
    })

    it('should create nested destination directories', () => {
      const srcPath = join(templatesDir, 'minimal', 'src', 'index.ts')
      const destPath = join(tempDir, 'output', 'deep', 'nested', 'src', 'index.ts')

      copyTemplateFile(srcPath, destPath, { projectNamePascal: 'TestApp' })

      expect(existsSync(destPath)).toBe(true)
      const content = readFileSync(destPath, 'utf-8')
      expect(content).toBe('export const APP_NAME = "TestApp"')
    })
  })

  describe('copyTemplateDir', () => {
    it('should copy entire directory recursively with variable replacement', () => {
      const outputDir = join(tempDir, 'my-cool-app')
      const vars = getTemplateVars('my-cool-app')

      copyTemplateDir(join(templatesDir, 'minimal'), outputDir, vars)

      expect(existsSync(join(outputDir, 'package.json'))).toBe(true)
      expect(existsSync(join(outputDir, 'README.md'))).toBe(true)
      expect(existsSync(join(outputDir, 'src', 'index.ts'))).toBe(true)

      const pkg = readFileSync(join(outputDir, 'package.json'), 'utf-8')
      expect(pkg).toContain('"name": "my-cool-app"')

      const readme = readFileSync(join(outputDir, 'README.md'), 'utf-8')
      expect(readme).toContain('# MyCoolApp')
    })

    it('should rename _ prefixed files to . prefixed', () => {
      const outputDir = join(tempDir, 'output-rename')

      copyTemplateDir(join(templatesDir, 'minimal'), outputDir, { projectName: 'test' })

      expect(existsSync(join(outputDir, '.gitignore'))).toBe(true)
      expect(existsSync(join(outputDir, '_gitignore'))).toBe(false)
    })

    it('should skip node_modules and dist directories', () => {
      // Add node_modules and dist to template
      mkdirSync(join(templatesDir, 'minimal', 'node_modules', 'dep'), { recursive: true })
      mkdirSync(join(templatesDir, 'minimal', 'dist'), { recursive: true })
      writeFileSync(join(templatesDir, 'minimal', 'node_modules', 'dep', 'index.js'), 'test')
      writeFileSync(join(templatesDir, 'minimal', 'dist', 'bundle.js'), 'bundled')

      const outputDir = join(tempDir, 'output-skip')
      copyTemplateDir(join(templatesDir, 'minimal'), outputDir, {})

      expect(existsSync(join(outputDir, 'package.json'))).toBe(true)
      expect(existsSync(join(outputDir, 'node_modules'))).toBe(false)
      expect(existsSync(join(outputDir, 'dist'))).toBe(false)
    })
  })

  describe('scaffold function', () => {
    it('should throw ScaffoldError if target directory exists and is not empty', async () => {
      const targetDir = join(tempDir, 'existing-project')
      mkdirSync(targetDir, { recursive: true })
      writeFileSync(join(targetDir, 'existing.txt'), 'content')

      await expect(
        scaffold({
          projectName: 'existing-project',
          template: 'minimal',
          packageManager: 'npm',
          targetDir,
        })
      ).rejects.toThrow(ScaffoldError)
    })

    it('should successfully scaffold a new project', async () => {
      const targetDir = join(tempDir, 'new-project')

      const result = await scaffold({
        projectName: 'new-project',
        template: 'minimal',
        packageManager: 'pnpm',
        targetDir,
      })

      expect(result.success).toBe(true)
      expect(result.template).toBe('minimal')
      expect(result.packageManager).toBe('pnpm')
      expect(existsSync(join(targetDir, 'package.json'))).toBe(true)

      const pkg = readFileSync(join(targetDir, 'package.json'), 'utf-8')
      expect(pkg).toContain('"name": "new-project"')
    })

    it('should allow scaffolding into empty existing directory', async () => {
      const targetDir = join(tempDir, 'empty-project')
      mkdirSync(targetDir, { recursive: true })

      const result = await scaffold({
        projectName: 'empty-project',
        template: 'minimal',
        packageManager: 'npm',
        targetDir,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should throw ScaffoldError with code DIR_EXISTS for non-empty directory', async () => {
      const targetDir = join(tempDir, 'dir-exists')
      mkdirSync(targetDir, { recursive: true })
      writeFileSync(join(targetDir, 'file.txt'), 'content')

      try {
        await scaffold({
          projectName: 'dir-exists',
          template: 'minimal',
          packageManager: 'npm',
          targetDir,
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ScaffoldError)
        expect((error as ScaffoldError).code).toBe('DIR_EXISTS')
        expect((error as ScaffoldError).suggestion).toBeDefined()
      }
    })

    it('should throw ScaffoldError with code TEMPLATE_NOT_FOUND for invalid template', async () => {
      const targetDir = join(tempDir, 'invalid-template')

      try {
        await scaffold({
          projectName: 'test',
          template: 'nonexistent' as any,
          packageManager: 'npm',
          targetDir,
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ScaffoldError)
        expect((error as ScaffoldError).code).toBe('TEMPLATE_NOT_FOUND')
      }
    })
  })

  describe('getTemplateVars', () => {
    it('should generate all required template variables', () => {
      const vars = getTemplateVars('my-cool-project')

      expect(vars.projectName).toBe('my-cool-project')
      expect(vars.projectNameKebab).toBe('my-cool-project')
      expect(vars.projectNamePascal).toBe('MyCoolProject')
    })
  })

  describe('templateExists', () => {
    it('should return true for existing template', () => {
      expect(templateExists('minimal')).toBe(true)
    })

    it('should return false for non-existing template', () => {
      expect(templateExists('nonexistent' as any)).toBe(false)
    })
  })
})
