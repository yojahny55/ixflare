/**
 * @module ssr/islands
 * @description Islands architecture for selective hydration
 *
 * This module implements the islands architecture pattern where only interactive
 * components ("islands") are hydrated on the client, while the rest of the page
 * remains static HTML. This minimizes JavaScript payload and improves performance.
 *
 * @example
 * ```typescript
 * // Server component
 * import Counter from '@/components/Counter.client'
 *
 * // Islands are automatically detected and wrapped
 * <Counter initialCount={5} /> // Only this hydrates on client
 * ```
 */

import type { IslandConfig, IslandRegistryEntry, IslandMarkerProps } from '@/ssr/types'
import { ValidationError, InfraError } from '@/errors'

/** Maximum size for serialized props (10KB) */
const MAX_PROPS_SIZE = 10 * 1024

/**
 * Check if a component is an island (has 'island' export marker)
 *
 * @param component - Component to check
 * @returns True if component has island marker
 *
 * @example
 * ```typescript
 * // Component with island marker
 * export const island = true
 * export default function Counter() { ... }
 *
 * isIslandComponent(Counter) // true
 * ```
 */
export function isIslandComponent(component: unknown): boolean {
  if (!component) {
    return false
  }

  // Check for island export marker
  // Components can be objects (class components, forwardRef, etc.) or functions (functional components)
  // with an attached 'island' property
  const type = typeof component
  if (type !== 'object' && type !== 'function') {
    return false
  }

  // TypeScript needs explicit object cast for 'in' operator
  const comp = component as Record<string, unknown>
  return 'island' in comp && comp.island !== undefined
}

/**
 * Validate that props are serializable (no functions, symbols, etc.)
 *
 * @param props - Props to validate
 * @param islandId - Island identifier for error messages
 * @throws {ValidationError} If props contain non-serializable values
 */
function validateSerializableProps(props: Record<string, unknown>, islandId: string): void {
  function checkValue(value: unknown, path: string): void {
    if (value === null || value === undefined) {
      return
    }

    const type = typeof value

    // Functions are not serializable
    if (type === 'function') {
      throw new ValidationError(
        `Island "${islandId}" received non-serializable prop "${path}". Functions cannot be passed to islands.`
      )
    }

    // Symbols are not serializable
    if (type === 'symbol') {
      throw new ValidationError(
        `Island "${islandId}" received non-serializable prop "${path}". Symbols cannot be passed to islands.`
      )
    }

    // BigInt is not serializable (JSON.stringify throws TypeError)
    if (type === 'bigint') {
      throw new ValidationError(
        `Island "${islandId}" received non-serializable prop "${path}". BigInt cannot be passed to islands. Convert to number or string.`
      )
    }

    // Check arrays recursively
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        checkValue(item, `${path}[${index}]`)
      })
      return
    }

    // Check objects recursively
    if (type === 'object') {
      // Check for special non-serializable objects
      if (
        value instanceof Date ||
        value instanceof RegExp ||
        value instanceof Map ||
        value instanceof Set
      ) {
        throw new ValidationError(
          `Island "${islandId}" received non-serializable prop "${path}". ${value.constructor.name} instances cannot be passed to islands. Convert to plain objects or primitives.`
        )
      }

      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        checkValue(val, path ? `${path}.${key}` : key)
      }
    }
  }

  for (const [key, value] of Object.entries(props)) {
    checkValue(value, key)
  }
}

/**
 * Detect circular references in object
 *
 * @param obj - Object to check
 * @param islandId - Island identifier for error messages
 * @throws {ValidationError} If circular references detected
 */
function detectCircularReferences(obj: Record<string, unknown>, islandId: string): void {
  const seen = new Set<unknown>()

  function check(value: unknown, path: string): void {
    if (value === null || value === undefined) {
      return
    }

    // Only track objects and arrays
    if (typeof value === 'object') {
      if (seen.has(value)) {
        throw new ValidationError(
          `Island "${islandId}" has circular reference at "${path}". Circular references cannot be serialized.`
        )
      }

      seen.add(value)

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          check(item, `${path}[${index}]`)
        })
      } else {
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
          check(val, path ? `${path}.${key}` : key)
        }
      }

      seen.delete(value)
    }
  }

  check(obj, 'props')
}

/**
 * Serialize island props to XSS-safe JSON string
 *
 * Escapes HTML-dangerous characters to prevent XSS attacks when embedding
 * props in HTML attributes.
 *
 * @param props - Props to serialize
 * @param islandId - Island identifier for validation
 * @returns XSS-safe JSON string
 * @throws {ValidationError} If props are not serializable
 *
 * @example
 * ```typescript
 * serializeIslandProps({ name: '<script>alert("xss")</script>' })
 * // Returns: '{"name":"\\u003cscript\\u003ealert(\\"xss\\")\\u003c/script\\u003e"}'
 * ```
 */
export function serializeIslandProps(props: Record<string, unknown>, islandId: string): string {
  // Detect circular references first (before JSON.stringify which will throw anyway)
  detectCircularReferences(props, islandId)

  // Validate props are serializable
  validateSerializableProps(props, islandId)

  // Serialize to JSON
  const json = JSON.stringify(props)

  // Check size limit
  const size = new TextEncoder().encode(json).length
  if (size > MAX_PROPS_SIZE) {
    console.warn(
      `[Island Props Warning] Island "${islandId}" has large props (${Math.round(size / 1024)}KB). ` +
        `Consider reducing prop size or using data loaders. Large props slow down initial page load.`
    )
  }

  // Escape HTML-dangerous characters for XSS safety
  // These characters are dangerous when embedded in HTML attributes
  //
  // Note: We escape single quotes but NOT double quotes because:
  // - JSON.stringify already escapes double quotes inside strings as \"
  // - The \" is safe in double-quoted HTML attributes: data-props="{\"key\":\"value\"}"
  // - But single quotes are NOT escaped by JSON, so data-props='{"key":"it's broken"}'
  //   would break if we don't escape them
  return json
    .replace(/</g, '\\u003c') // < becomes \u003c (prevents </script> breakout)
    .replace(/>/g, '\\u003e') // > becomes \u003e (prevents tag injection)
    .replace(/&/g, '\\u0026') // & becomes \u0026 (prevents entity injection)
    .replace(/'/g, '\\u0027') // ' becomes \u0027 (prevents single-quote attribute breakout)
}

/**
 * Deserialize island props from JSON string (client-side)
 *
 * @param propsJson - Serialized props JSON
 * @returns Deserialized props object
 * @throws {InfraError} If JSON parsing fails
 *
 * @example
 * ```typescript
 * const props = deserializeIslandProps('{"count":5}')
 * // Returns: { count: 5 }
 * ```
 */
export function deserializeIslandProps(propsJson: string): Record<string, unknown> {
  try {
    return JSON.parse(propsJson)
  } catch (error) {
    throw new InfraError('ISLAND_PROPS_PARSE_FAILED', `Failed to parse island props: ${error}`)
  }
}

/**
 * Island Registry for tracking discovered islands during SSR
 */
export class IslandRegistry {
  private islands: Map<string, IslandRegistryEntry> = new Map()

  /**
   * Register an island component
   *
   * @param entry - Island registry entry
   */
  register(entry: IslandRegistryEntry): void {
    this.islands.set(entry.id, entry)
  }

  /**
   * Get registered island by ID
   *
   * @param id - Island identifier
   * @returns Island entry or undefined
   */
  get(id: string): IslandRegistryEntry | undefined {
    return this.islands.get(id)
  }

  /**
   * Get all registered islands
   *
   * @returns Array of island entries
   */
  getAll(): IslandRegistryEntry[] {
    return Array.from(this.islands.values())
  }

  /**
   * Clear all registered islands
   */
  clear(): void {
    this.islands.clear()
  }

  /**
   * Check if island is registered
   *
   * @param id - Island identifier
   * @returns True if island is registered
   */
  has(id: string): boolean {
    return this.islands.has(id)
  }
}

/**
 * Create an island wrapper with marker attributes for SSR
 *
 * Returns an object with marker props that can be spread onto a div element
 * wrapping the island component during server-side rendering.
 *
 * @param config - Island configuration
 * @returns Island marker props for HTML attributes
 *
 * @example
 * ```typescript
 * const island = createIsland({
 *   id: 'counter-1',
 *   component: Counter,
 *   props: { initialCount: 5 },
 *   load: 'idle'
 * })
 *
 * // Returns marker props to wrap the component:
 * // <div data-island="counter-1" data-props='{"initialCount":5}' data-load="idle">
 * //   <Counter initialCount={5} />
 * // </div>
 * ```
 */
export function createIsland(config: IslandConfig): IslandMarkerProps {
  const { id, props = {}, load = 'immediate' } = config

  // Serialize props with XSS safety
  const serializedProps = serializeIslandProps(props, id)

  // Create marker props
  const markerProps: IslandMarkerProps = {
    'data-island': id,
    'data-props': serializedProps,
  }

  // Only add data-load if not immediate (default)
  if (load !== 'immediate') {
    markerProps['data-load'] = load
  }

  return markerProps
}
