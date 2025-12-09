import type { Model, SchemaDefinition } from '../schema/types'
import type { StorageTier, ExtendedModelOptions } from './types'

export interface TierAnalysisResult {
  tier: StorageTier
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  warnings: string[]
}

/**
 * Analyzes a model schema and determines optimal storage tier
 *
 * Algorithm:
 * 1. Explicit override takes precedence
 * 2. Strong consistency → Durable Objects
 * 3. Analyze schema for KV suitability
 * 4. Default to D1 (safest choice for relational data)
 */
export function analyzeTier<T extends SchemaDefinition>(
  model: Model<T>,
  options?: ExtendedModelOptions
): TierAnalysisResult {
  // 1. Explicit override takes precedence
  if (options?.storage) {
    const warnings = validateTierChoice(model, options.storage, options)
    return {
      tier: options.storage,
      confidence: 'high',
      reasons: ['Explicitly configured'],
      warnings,
    }
  }

  // 2. Strong consistency → Durable Objects
  if (options?.consistency === 'strong') {
    return {
      tier: 'do',
      confidence: 'high',
      reasons: ['Strong consistency required'],
      warnings: [],
    }
  }

  // 3. Analyze schema for KV suitability
  const kvSuitability = analyzeKVSuitability(model)
  if (kvSuitability.suitable) {
    return {
      tier: 'kv',
      confidence: kvSuitability.confidence,
      reasons: kvSuitability.reasons,
      warnings: [],
    }
  }

  // 4. Default to D1 (safest choice for relational data)
  return {
    tier: 'd1',
    confidence: 'high',
    reasons: ['Default: relational data storage'],
    warnings: [],
  }
}

interface KVSuitabilityResult {
  suitable: boolean
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
}

/**
 * Analyzes if a model is suitable for KV storage
 *
 * KV is suitable when:
 * - Model has string primary key (not auto-increment)
 * - No relations defined
 * - Simple schema (≤5 fields)
 */
function analyzeKVSuitability<T extends SchemaDefinition>(
  model: Model<T>
): KVSuitabilityResult {
  const schema = model.$schema
  const reasons: string[] = []

  // Check for string primary key (key-value pattern)
  const hasStringPK = Object.entries(schema).some(([, field]) => {
    const config = field.config
    return config?.primaryKey === true && config?.type === 'string'
  })

  // Check for no relations (simple key-value)
  const hasNoRelations = !model.$relations || Object.keys(model.$relations).length === 0

  // Check for simple schema (few fields, no complex types)
  const fieldCount = Object.keys(schema).length
  const isSimpleSchema = fieldCount <= 5

  if (hasStringPK && hasNoRelations && isSimpleSchema) {
    reasons.push('String primary key detected', 'No relationships defined', 'Simple schema structure')
    return { suitable: true, confidence: 'medium', reasons }
  }

  return { suitable: false, confidence: 'low', reasons: [] }
}

/**
 * Validates if the selected storage tier is appropriate for the model
 * Returns warnings if there are potential issues
 */
export function validateTierChoice<T extends SchemaDefinition>(
  model: Model<T>,
  selectedTier: StorageTier,
  options?: ExtendedModelOptions
): string[] {
  const warnings: string[] = []

  if (selectedTier === 'kv') {
    // Warn if model has relations (KV doesn't support joins)
    if (model.$relations && Object.keys(model.$relations).length > 0) {
      warnings.push('KV storage selected but model has relations - relations will not work with KV')
    }
    // Note: Index detection will be added when .index() method is implemented
  }

  if (selectedTier === 'd1' && options?.consistency === 'strong') {
    warnings.push('Strong consistency requested but D1 selected - consider using Durable Objects')
  }

  return warnings
}
