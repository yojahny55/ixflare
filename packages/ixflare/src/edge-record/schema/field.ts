/**
 * @module edge-record/schema/field
 * @description Field type builders for EdgeRecord schema definition
 */

/**
 * Field configuration interface that stores all field metadata
 */
export interface FieldConfig<T = unknown> {
  type: 'id' | 'string' | 'text' | 'integer' | 'decimal' | 'boolean' | 'datetime' | 'json' | 'enum'
  primaryKey?: boolean
  autoIncrement?: boolean
  nullable: boolean
  unique?: boolean
  default?: T | (() => T)
  min?: number
  max?: number
  positive?: boolean
  precision?: number
  scale?: number
  values?: readonly string[]
  references?: {
    model: unknown
    column?: string
  }
}

/**
 * Field builder with chainable modifiers
 * Uses TypeScript generics to preserve type information through the chain
 */
export class FieldBuilder<T = unknown> {
  public config: FieldConfig<T>

  constructor(type: FieldConfig<T>['type']) {
    this.config = {
      type,
      nullable: false,
    }
  }

  /**
   * Mark field as unique
   */
  unique(): this {
    this.config.unique = true
    return this
  }

  /**
   * Mark field as nullable
   * Changes type from T to T | null
   */
  nullable(): FieldBuilder<T | null> {
    this.config.nullable = true
    return this as unknown as FieldBuilder<T | null>
  }

  /**
   * Set default value (value or function)
   */
  default(value: T | (() => T)): this {
    this.config.default = value
    return this
  }

  /**
   * Mark as primary key
   */
  primaryKey(): this {
    this.config.primaryKey = true
    return this
  }

  /**
   * Set minimum value/length
   */
  min(value: number): this {
    this.config.min = value
    return this
  }

  /**
   * Set maximum value/length
   */
  max(value: number): this {
    this.config.max = value
    return this
  }

  /**
   * Mark as positive numbers only
   */
  positive(): this {
    this.config.positive = true
    return this
  }

  /**
   * Set foreign key reference to another model
   * @param model The referenced model
   * @param column The referenced column (defaults to 'id')
   */
  references(model: unknown, column: string = 'id'): this {
    this.config.references = {
      model,
      column,
    }
    return this
  }
}

/**
 * Field type builders
 * Provides fluent API for defining model fields
 */
export const field = {
  /**
   * Auto-incrementing primary key (INTEGER PRIMARY KEY AUTOINCREMENT)
   */
  id(): FieldBuilder<number> {
    const builder = new FieldBuilder<number>('id')
    builder.config.primaryKey = true
    builder.config.autoIncrement = true
    return builder
  },

  /**
   * String field (TEXT in SQLite)
   * Supports .min(), .max() modifiers
   */
  string(): FieldBuilder<string> {
    return new FieldBuilder<string>('string')
  },

  /**
   * Text field for long text (TEXT in SQLite, no length limit)
   */
  text(): FieldBuilder<string> {
    return new FieldBuilder<string>('text')
  },

  /**
   * Integer field (INTEGER in SQLite)
   * Supports .min(), .max(), .positive() modifiers
   */
  integer(): FieldBuilder<number> {
    return new FieldBuilder<number>('integer')
  },

  /**
   * Decimal/float field (REAL in SQLite)
   * @param options Precision and scale configuration
   */
  decimal(options: { precision: number; scale: number }): FieldBuilder<number> {
    const builder = new FieldBuilder<number>('decimal')
    builder.config.precision = options.precision
    builder.config.scale = options.scale
    return builder
  },

  /**
   * Boolean field (INTEGER in SQLite, stored as 0/1)
   */
  boolean(): FieldBuilder<boolean> {
    return new FieldBuilder<boolean>('boolean')
  },

  /**
   * Datetime field (INTEGER in SQLite, stored as Unix timestamp ms)
   */
  datetime(): FieldBuilder<Date> {
    return new FieldBuilder<Date>('datetime')
  },

  /**
   * JSON field (TEXT in SQLite, stored as JSON string)
   * @template T The TypeScript type of the JSON data
   */
  json<T = unknown>(): FieldBuilder<T> {
    return new FieldBuilder<T>('json')
  },

  /**
   * Enum field with type-safe literal values (TEXT in SQLite)
   * @param values Array of allowed values (use 'as const' for literal types)
   * @example
   * field.enum(['user', 'admin', 'moderator'] as const)
   */
  enum<const T extends readonly string[]>(values: T): FieldBuilder<T[number]> {
    const builder = new FieldBuilder<T[number]>('enum')
    builder.config.values = values
    return builder
  },
}
