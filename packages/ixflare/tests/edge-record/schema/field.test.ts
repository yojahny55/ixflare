/**
 * @module tests/edge-record/schema/field
 * @description Tests for field type builders
 */

import { describe, it, expect } from 'vitest'
import { field } from '@/edge-record/schema/field'

describe('field.id()', () => {
  it('should create auto-incrementing primary key field', () => {
    const idField = field.id()

    expect(idField.config).toMatchObject({
      type: 'id',
      primaryKey: true,
      autoIncrement: true,
      nullable: false,
    })
  })
})

describe('field.string()', () => {
  it('should create string field', () => {
    const stringField = field.string()

    expect(stringField.config).toMatchObject({
      type: 'string',
      nullable: false,
    })
  })

  it('should chain .min() modifier', () => {
    const stringField = field.string().min(2)

    expect(stringField.config.min).toBe(2)
  })

  it('should chain .max() modifier', () => {
    const stringField = field.string().max(100)

    expect(stringField.config.max).toBe(100)
  })

  it('should chain multiple modifiers', () => {
    const stringField = field.string().min(2).max(100).unique()

    expect(stringField.config).toMatchObject({
      type: 'string',
      min: 2,
      max: 100,
      unique: true,
    })
  })
})

describe('field.text()', () => {
  it('should create text field for long text', () => {
    const textField = field.text()

    expect(textField.config).toMatchObject({
      type: 'text',
      nullable: false,
    })
  })

  it('should not have length constraints', () => {
    const textField = field.text()

    expect(textField.config.min).toBeUndefined()
    expect(textField.config.max).toBeUndefined()
  })
})

describe('field.integer()', () => {
  it('should create integer field', () => {
    const intField = field.integer()

    expect(intField.config).toMatchObject({
      type: 'integer',
      nullable: false,
    })
  })

  it('should chain .min() modifier', () => {
    const intField = field.integer().min(0)

    expect(intField.config.min).toBe(0)
  })

  it('should chain .max() modifier', () => {
    const intField = field.integer().max(999)

    expect(intField.config.max).toBe(999)
  })

  it('should chain .positive() modifier', () => {
    const intField = field.integer().positive()

    expect(intField.config.positive).toBe(true)
  })
})

describe('field.decimal()', () => {
  it('should create decimal field with precision and scale', () => {
    const decimalField = field.decimal({ precision: 10, scale: 2 })

    expect(decimalField.config).toMatchObject({
      type: 'decimal',
      precision: 10,
      scale: 2,
      nullable: false,
    })
  })

  it('should chain .positive() modifier', () => {
    const decimalField = field.decimal({ precision: 10, scale: 2 }).positive()

    expect(decimalField.config.positive).toBe(true)
  })
})

describe('field.boolean()', () => {
  it('should create boolean field', () => {
    const boolField = field.boolean()

    expect(boolField.config).toMatchObject({
      type: 'boolean',
      nullable: false,
    })
  })
})

describe('field.datetime()', () => {
  it('should create datetime field', () => {
    const dateField = field.datetime()

    expect(dateField.config).toMatchObject({
      type: 'datetime',
      nullable: false,
    })
  })
})

describe('field.json()', () => {
  it('should create json field', () => {
    const jsonField = field.json<{ foo: string }>()

    expect(jsonField.config).toMatchObject({
      type: 'json',
      nullable: false,
    })
  })
})

describe('field.enum()', () => {
  it('should create enum field with literal types', () => {
    const enumField = field.enum(['user', 'admin', 'moderator'] as const)

    expect(enumField.config).toMatchObject({
      type: 'enum',
      values: ['user', 'admin', 'moderator'],
      nullable: false,
    })
  })
})

describe('Field modifiers', () => {
  it('should mark field as unique', () => {
    const uniqueField = field.string().unique()

    expect(uniqueField.config.unique).toBe(true)
  })

  it('should mark field as nullable', () => {
    const nullableField = field.string().nullable()

    expect(nullableField.config.nullable).toBe(true)
  })

  it('should set default value', () => {
    const defaultField = field.string().default('guest')

    expect(defaultField.config.default).toBe('guest')
  })

  it('should set default function', () => {
    const defaultFn = () => new Date()
    const defaultField = field.datetime().default(defaultFn)

    expect(defaultField.config.default).toBe(defaultFn)
  })

  it('should mark as primary key', () => {
    const pkField = field.integer().primaryKey()

    expect(pkField.config.primaryKey).toBe(true)
  })
})

describe('Chainable field builders', () => {
  it('should return this for non-nullable modifiers', () => {
    const field1 = field.string()
    const field2 = field1.unique()

    expect(field2).toBe(field1)
  })

  it('should preserve type through modifier chain', () => {
    const emailField = field.string().unique().min(5).max(255)

    expect(emailField.config).toMatchObject({
      type: 'string',
      unique: true,
      min: 5,
      max: 255,
      nullable: false,
    })
  })
})
