/**
 * @module utils.test
 * @description Tests for utility functions
 */

import { describe, it, expect } from 'vitest'
import { toKebabCase, toPascalCase, isValidProjectName, getProjectNameError } from '../src/utils'

describe('toKebabCase', () => {
  it('should convert camelCase to kebab-case', () => {
    expect(toKebabCase('myApp')).toBe('my-app')
    expect(toKebabCase('myAwesomeApp')).toBe('my-awesome-app')
  })

  it('should convert PascalCase to kebab-case', () => {
    expect(toKebabCase('MyApp')).toBe('my-app')
    expect(toKebabCase('MyAwesomeApp')).toBe('my-awesome-app')
  })

  it('should convert spaces to hyphens', () => {
    expect(toKebabCase('my app')).toBe('my-app')
    expect(toKebabCase('my awesome app')).toBe('my-awesome-app')
  })

  it('should convert underscores to hyphens', () => {
    expect(toKebabCase('my_app')).toBe('my-app')
    expect(toKebabCase('my_awesome_app')).toBe('my-awesome-app')
  })

  it('should handle already kebab-case strings', () => {
    expect(toKebabCase('my-app')).toBe('my-app')
    expect(toKebabCase('my-awesome-app')).toBe('my-awesome-app')
  })

  it('should lowercase everything', () => {
    expect(toKebabCase('MYAPP')).toBe('myapp')
    expect(toKebabCase('MY-APP')).toBe('my-app')
  })
})

describe('toPascalCase', () => {
  it('should convert kebab-case to PascalCase', () => {
    expect(toPascalCase('my-app')).toBe('MyApp')
    expect(toPascalCase('my-awesome-app')).toBe('MyAwesomeApp')
  })

  it('should convert snake_case to PascalCase', () => {
    expect(toPascalCase('my_app')).toBe('MyApp')
    expect(toPascalCase('my_awesome_app')).toBe('MyAwesomeApp')
  })

  it('should convert spaces to PascalCase', () => {
    expect(toPascalCase('my app')).toBe('MyApp')
    expect(toPascalCase('my awesome app')).toBe('MyAwesomeApp')
  })

  it('should handle already PascalCase strings', () => {
    expect(toPascalCase('MyApp')).toBe('MyApp')
  })

  it('should handle lowercase strings', () => {
    expect(toPascalCase('myapp')).toBe('Myapp')
  })
})

describe('isValidProjectName', () => {
  it('should accept valid kebab-case names', () => {
    expect(isValidProjectName('my-app')).toBe(true)
    expect(isValidProjectName('my-cool-app')).toBe(true)
    expect(isValidProjectName('app123')).toBe(true)
    expect(isValidProjectName('my-app-2')).toBe(true)
  })

  it('should accept simple lowercase names', () => {
    expect(isValidProjectName('myapp')).toBe(true)
    expect(isValidProjectName('app')).toBe(true)
    expect(isValidProjectName('a')).toBe(true)
  })

  it('should reject names starting with number', () => {
    expect(isValidProjectName('123app')).toBe(false)
    expect(isValidProjectName('1-app')).toBe(false)
  })

  it('should reject names with uppercase letters', () => {
    expect(isValidProjectName('MyApp')).toBe(false)
    expect(isValidProjectName('myAPP')).toBe(false)
  })

  it('should reject names with underscores', () => {
    expect(isValidProjectName('my_app')).toBe(false)
  })

  it('should reject names with spaces', () => {
    expect(isValidProjectName('my app')).toBe(false)
  })

  it('should reject names starting or ending with hyphen', () => {
    expect(isValidProjectName('-myapp')).toBe(false)
    expect(isValidProjectName('myapp-')).toBe(false)
  })

  it('should reject names with consecutive hyphens', () => {
    expect(isValidProjectName('my--app')).toBe(false)
  })

  it('should reject empty names', () => {
    expect(isValidProjectName('')).toBe(false)
  })
})

describe('getProjectNameError', () => {
  it('should return null for valid names', () => {
    expect(getProjectNameError('my-app')).toBeNull()
    expect(getProjectNameError('myapp')).toBeNull()
    expect(getProjectNameError('app123')).toBeNull()
  })

  it('should return error for empty name', () => {
    expect(getProjectNameError('')).toBe('Project name is required')
  })

  it('should return error for names starting with uppercase', () => {
    const error = getProjectNameError('MyApp')
    expect(error).toContain('lowercase')
  })

  it('should return error for names with invalid characters', () => {
    const error = getProjectNameError('my_app')
    expect(error).toContain('only contain')
  })

  it('should return error for names starting with hyphen', () => {
    const error = getProjectNameError('-myapp')
    // Names starting with hyphen fail the "must start with lowercase letter" check first
    expect(error).toContain('lowercase')
  })

  it('should return error for names ending with hyphen', () => {
    const error = getProjectNameError('myapp-')
    expect(error).toContain('hyphen')
  })

  it('should return error for consecutive hyphens', () => {
    const error = getProjectNameError('my--app')
    expect(error).toContain('consecutive')
  })
})
