/**
 * @module scaffold.test
 * @description Tests for scaffold utilities
 */

import { describe, it, expect } from 'vitest'
import {
  replaceTemplateVars,
  getOutputFilename,
  isBinaryFile,
  getTemplateVars,
} from '../src/scaffold'

describe('replaceTemplateVars', () => {
  it('should replace single variable', () => {
    const content = 'Hello {{projectName}}!'
    const vars = { projectName: 'my-app' }

    const result = replaceTemplateVars(content, vars)
    expect(result).toBe('Hello my-app!')
  })

  it('should replace multiple occurrences of same variable', () => {
    const content = '{{projectName}} is called {{projectName}}'
    const vars = { projectName: 'test-app' }

    const result = replaceTemplateVars(content, vars)
    expect(result).toBe('test-app is called test-app')
  })

  it('should replace multiple different variables', () => {
    const content = '{{projectName}} - {{projectNamePascal}}'
    const vars = { projectName: 'my-app', projectNamePascal: 'MyApp' }

    const result = replaceTemplateVars(content, vars)
    expect(result).toBe('my-app - MyApp')
  })

  it('should leave unmatched variables unchanged', () => {
    const content = '{{projectName}} and {{unknownVar}}'
    const vars = { projectName: 'my-app' }

    const result = replaceTemplateVars(content, vars)
    expect(result).toBe('my-app and {{unknownVar}}')
  })

  it('should handle content with no variables', () => {
    const content = 'No variables here'
    const vars = { projectName: 'my-app' }

    const result = replaceTemplateVars(content, vars)
    expect(result).toBe('No variables here')
  })

  it('should handle empty content', () => {
    const content = ''
    const vars = { projectName: 'my-app' }

    const result = replaceTemplateVars(content, vars)
    expect(result).toBe('')
  })

  it('should handle empty vars object', () => {
    const content = '{{projectName}}'
    const vars = {}

    const result = replaceTemplateVars(content, vars)
    expect(result).toBe('{{projectName}}')
  })
})

describe('getOutputFilename', () => {
  it('should rename _gitignore to .gitignore', () => {
    expect(getOutputFilename('_gitignore')).toBe('.gitignore')
  })

  it('should rename _env.example to .env.example', () => {
    expect(getOutputFilename('_env.example')).toBe('.env.example')
  })

  it('should rename _eslintrc.js to .eslintrc.js', () => {
    expect(getOutputFilename('_eslintrc.js')).toBe('.eslintrc.js')
  })

  it('should rename _prettierrc to .prettierrc', () => {
    expect(getOutputFilename('_prettierrc')).toBe('.prettierrc')
  })

  it('should rename generic _ prefixed files', () => {
    expect(getOutputFilename('_config')).toBe('.config')
    expect(getOutputFilename('_npmrc')).toBe('.npmrc')
  })

  it('should not modify normal filenames', () => {
    expect(getOutputFilename('package.json')).toBe('package.json')
    expect(getOutputFilename('README.md')).toBe('README.md')
    expect(getOutputFilename('src/index.ts')).toBe('src/index.ts')
  })
})

describe('isBinaryFile', () => {
  it('should identify image files as binary', () => {
    expect(isBinaryFile('logo.png')).toBe(true)
    expect(isBinaryFile('photo.jpg')).toBe(true)
    expect(isBinaryFile('image.jpeg')).toBe(true)
    expect(isBinaryFile('icon.gif')).toBe(true)
    expect(isBinaryFile('favicon.ico')).toBe(true)
    expect(isBinaryFile('photo.webp')).toBe(true)
  })

  it('should identify font files as binary', () => {
    expect(isBinaryFile('font.woff')).toBe(true)
    expect(isBinaryFile('font.woff2')).toBe(true)
    expect(isBinaryFile('font.ttf')).toBe(true)
    expect(isBinaryFile('font.eot')).toBe(true)
    expect(isBinaryFile('font.otf')).toBe(true)
  })

  it('should identify media files as binary', () => {
    expect(isBinaryFile('audio.mp3')).toBe(true)
    expect(isBinaryFile('video.mp4')).toBe(true)
    expect(isBinaryFile('video.webm')).toBe(true)
  })

  it('should identify archive files as binary', () => {
    expect(isBinaryFile('archive.zip')).toBe(true)
    expect(isBinaryFile('archive.tar')).toBe(true)
    expect(isBinaryFile('archive.gz')).toBe(true)
  })

  it('should identify text files as non-binary', () => {
    expect(isBinaryFile('index.ts')).toBe(false)
    expect(isBinaryFile('styles.css')).toBe(false)
    expect(isBinaryFile('index.html')).toBe(false)
    expect(isBinaryFile('README.md')).toBe(false)
    expect(isBinaryFile('package.json')).toBe(false)
    expect(isBinaryFile('config.yaml')).toBe(false)
  })

  it('should handle uppercase extensions', () => {
    expect(isBinaryFile('LOGO.PNG')).toBe(true)
    expect(isBinaryFile('font.WOFF2')).toBe(true)
  })

  it('should identify SVG as text (XML format supports template variables)', () => {
    expect(isBinaryFile('icon.svg')).toBe(false)
  })
})

describe('getTemplateVars', () => {
  it('should generate all template variables', () => {
    const vars = getTemplateVars('my-cool-app')

    expect(vars.projectName).toBe('my-cool-app')
    expect(vars.projectNameKebab).toBe('my-cool-app')
    expect(vars.projectNamePascal).toBe('MyCoolApp')
  })

  it('should handle simple project names', () => {
    const vars = getTemplateVars('myapp')

    expect(vars.projectName).toBe('myapp')
    expect(vars.projectNameKebab).toBe('myapp')
    expect(vars.projectNamePascal).toBe('Myapp')
  })

  it('should convert kebab-case to PascalCase correctly', () => {
    const vars = getTemplateVars('my-api-backend')

    expect(vars.projectNamePascal).toBe('MyApiBackend')
  })
})
