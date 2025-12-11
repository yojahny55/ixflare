/**
 * @module tests/ssr/islands
 * @description Tests for islands architecture
 */

import { describe, it, expect, vi } from 'vitest'
import {
  isIslandComponent,
  serializeIslandProps,
  deserializeIslandProps,
  createIsland,
  IslandRegistry,
} from '@/ssr/islands'
import { ValidationError, InfraError } from '@/errors'

describe('Islands Architecture', () => {
  describe('isIslandComponent', () => {
    it('should detect island export marker (island = true)', () => {
      const component = {
        island: true,
        default: () => null,
      }

      expect(isIslandComponent(component)).toBe(true)
    })

    it('should detect island export marker (island = { load: "idle" })', () => {
      const component = {
        island: { load: 'idle' },
        default: () => null,
      }

      expect(isIslandComponent(component)).toBe(true)
    })

    it('should return false for components without island marker', () => {
      const component = {
        default: () => null,
      }

      expect(isIslandComponent(component)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isIslandComponent(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isIslandComponent(undefined)).toBe(false)
    })

    it('should return false for primitives', () => {
      expect(isIslandComponent('string')).toBe(false)
      expect(isIslandComponent(123)).toBe(false)
      expect(isIslandComponent(true)).toBe(false)
    })

    it('should detect island marker on functional components', () => {
      // Functional component with island marker attached
      function Counter() {
        return null
      }
      ;(Counter as unknown as { island: boolean }).island = true

      expect(isIslandComponent(Counter)).toBe(true)
    })

    it('should detect island marker on arrow function components', () => {
      const Counter = () => null
      ;(Counter as unknown as { island: boolean }).island = true

      expect(isIslandComponent(Counter)).toBe(true)
    })

    it('should return false for function without island marker', () => {
      const Counter = () => null

      expect(isIslandComponent(Counter)).toBe(false)
    })
  })

  describe('Props Serialization', () => {
    describe('serializeIslandProps', () => {
      it('should serialize primitive props to JSON', () => {
        const props = {
          count: 5,
          label: 'Clicks',
          enabled: true,
        }

        const json = serializeIslandProps(props, 'test-island')

        // Verify it's valid JSON
        const parsed = JSON.parse(json)
        expect(parsed).toEqual(props)
      })

      it('should escape XSS-dangerous characters in props', () => {
        const props = {
          name: '<script>alert("xss")</script>',
          html: '<div>test</div>',
          amp: 'foo & bar',
        }

        const json = serializeIslandProps(props, 'test-island')

        // Should escape dangerous characters
        expect(json).toContain('\\u003c') // <
        expect(json).toContain('\\u003e') // >
        expect(json).toContain('\\u0026') // &

        // Should not contain raw dangerous characters
        expect(json).not.toContain('<script>')
        expect(json).not.toContain('</div>')

        // Should still deserialize correctly
        const parsed = JSON.parse(json)
        expect(parsed).toEqual(props)
      })

      it('should escape single quotes for attribute safety', () => {
        const props = {
          singleQuote: "it's a test",
          both: `it's "quoted"`,
        }

        const json = serializeIslandProps(props, 'test-island')

        // Should escape single quotes (prevents breakout from data-props='...')
        expect(json).toContain('\\u0027') // ' (single quote)

        // Should not contain raw single quotes
        expect(json).not.toContain("'")

        // Double quotes are handled by JSON.stringify with backslash escape
        // which is safe for double-quoted HTML attributes

        // Should still deserialize correctly
        const parsed = JSON.parse(json)
        expect(parsed).toEqual(props)
      })

      it('should handle nested objects', () => {
        const props = {
          user: {
            name: 'John',
            profile: {
              age: 30,
              email: 'john@example.com',
            },
          },
        }

        const json = serializeIslandProps(props, 'test-island')
        const parsed = JSON.parse(json)
        expect(parsed).toEqual(props)
      })

      it('should handle arrays', () => {
        const props = {
          items: ['apple', 'banana', 'cherry'],
          numbers: [1, 2, 3],
        }

        const json = serializeIslandProps(props, 'test-island')
        const parsed = JSON.parse(json)
        expect(parsed).toEqual(props)
      })

      it('should reject function props with ValidationError', () => {
        const props = {
          onClick: () => console.log('clicked'),
        }

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(ValidationError)

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(/Functions cannot be passed to islands/)
      })

      it('should reject symbol props with ValidationError', () => {
        const props = {
          key: Symbol('test'),
        }

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(ValidationError)

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(/Symbols cannot be passed to islands/)
      })

      it('should reject Date instances with ValidationError', () => {
        const props = {
          createdAt: new Date(),
        }

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(ValidationError)

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(/Date instances cannot be passed to islands/)
      })

      it('should reject RegExp instances with ValidationError', () => {
        const props = {
          pattern: /test/,
        }

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(ValidationError)

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(/RegExp instances cannot be passed to islands/)
      })

      it('should reject Map instances with ValidationError', () => {
        const props = {
          data: new Map([['key', 'value']]),
        }

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(ValidationError)

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(/Map instances cannot be passed to islands/)
      })

      it('should reject Set instances with ValidationError', () => {
        const props = {
          items: new Set([1, 2, 3]),
        }

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(ValidationError)

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(/Set instances cannot be passed to islands/)
      })

      it('should reject BigInt values with ValidationError', () => {
        const props = {
          bigNumber: BigInt(9007199254740991),
        }

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(ValidationError)

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(/BigInt cannot be passed to islands/)
      })

      it('should reject nested BigInt values with ValidationError', () => {
        const props = {
          nested: {
            value: BigInt(12345),
          },
        }

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(ValidationError)

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(/BigInt cannot be passed to islands/)
      })

      it('should detect circular references', () => {
        const props: Record<string, unknown> = {
          name: 'test',
        }
        // Create circular reference
        props.self = props

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(ValidationError)

        expect(() => {
          serializeIslandProps(props, 'test-island')
        }).toThrow(/circular reference/)
      })

      it('should warn when props exceed 10KB', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        // Create large props object
        const largeString = 'x'.repeat(11 * 1024)
        const props = { data: largeString }

        serializeIslandProps(props, 'test-island')

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('large props'))
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-island'))

        consoleSpy.mockRestore()
      })

      it('should handle empty props', () => {
        const props = {}

        const json = serializeIslandProps(props, 'test-island')
        const parsed = JSON.parse(json)
        expect(parsed).toEqual({})
      })

      it('should handle null and undefined values in props', () => {
        const props = {
          nullValue: null,
          undefinedValue: undefined,
        }

        const json = serializeIslandProps(props, 'test-island')
        const parsed = JSON.parse(json)

        // JSON.stringify removes undefined
        expect(parsed).toEqual({ nullValue: null })
      })
    })

    describe('deserializeIslandProps', () => {
      it('should parse valid JSON props', () => {
        const json = '{"count":5,"label":"Clicks"}'
        const props = deserializeIslandProps(json)

        expect(props).toEqual({
          count: 5,
          label: 'Clicks',
        })
      })

      it('should handle empty object JSON', () => {
        const json = '{}'
        const props = deserializeIslandProps(json)

        expect(props).toEqual({})
      })

      it('should throw InfraError for invalid JSON', () => {
        const invalidJson = '{ invalid json }'

        expect(() => {
          deserializeIslandProps(invalidJson)
        }).toThrow(InfraError)

        expect(() => {
          deserializeIslandProps(invalidJson)
        }).toThrow(/Failed to parse island props/)
      })

      it('should handle escaped characters correctly', () => {
        // Simulating serialized props with escaped chars
        const json = '{"html":"\\u003cscript\\u003ealert(\\"xss\\")\\u003c/script\\u003e"}'
        const props = deserializeIslandProps(json)

        expect(props).toEqual({
          html: '<script>alert("xss")</script>',
        })
      })
    })
  })

  describe('Island Rendering', () => {
    describe('createIsland', () => {
      it('should create island marker with data-island attribute', () => {
        const marker = createIsland({
          id: 'counter-1',
          component: () => null,
          props: { count: 5 },
        })

        expect(marker['data-island']).toBe('counter-1')
      })

      it('should include serialized props in data-props attribute', () => {
        const marker = createIsland({
          id: 'counter-1',
          component: () => null,
          props: { count: 5, label: 'Clicks' },
        })

        const props = JSON.parse(marker['data-props'])
        expect(props).toEqual({ count: 5, label: 'Clicks' })
      })

      it('should set data-load="immediate" by default (implicit)', () => {
        const marker = createIsland({
          id: 'counter-1',
          component: () => null,
          props: {},
        })

        // immediate is default, so data-load should not be set
        expect(marker['data-load']).toBeUndefined()
      })

      it('should set data-load="idle" when configured', () => {
        const marker = createIsland({
          id: 'counter-1',
          component: () => null,
          props: {},
          load: 'idle',
        })

        expect(marker['data-load']).toBe('idle')
      })

      it('should set data-load="visible" when configured', () => {
        const marker = createIsland({
          id: 'counter-1',
          component: () => null,
          props: {},
          load: 'visible',
        })

        expect(marker['data-load']).toBe('visible')
      })

      it('should handle island with no props', () => {
        const marker = createIsland({
          id: 'counter-1',
          component: () => null,
        })

        const props = JSON.parse(marker['data-props'])
        expect(props).toEqual({})
      })

      it('should escape XSS in props', () => {
        const marker = createIsland({
          id: 'counter-1',
          component: () => null,
          props: { name: '<script>alert("xss")</script>' },
        })

        // data-props should have escaped characters
        expect(marker['data-props']).toContain('\\u003c')
        expect(marker['data-props']).not.toContain('<script>')
      })
    })
  })

  describe('IslandRegistry', () => {
    it('should register an island', () => {
      const registry = new IslandRegistry()

      registry.register({
        id: 'counter-1',
        componentPath: 'components/Counter.client.tsx',
        props: { count: 5 },
        load: 'immediate',
      })

      expect(registry.has('counter-1')).toBe(true)
    })

    it('should retrieve a registered island', () => {
      const registry = new IslandRegistry()

      const entry = {
        id: 'counter-1',
        componentPath: 'components/Counter.client.tsx',
        props: { count: 5 },
        load: 'immediate' as const,
      }

      registry.register(entry)

      const retrieved = registry.get('counter-1')
      expect(retrieved).toEqual(entry)
    })

    it('should return undefined for unregistered island', () => {
      const registry = new IslandRegistry()

      expect(registry.get('nonexistent')).toBeUndefined()
    })

    it('should return all registered islands', () => {
      const registry = new IslandRegistry()

      registry.register({
        id: 'counter-1',
        componentPath: 'components/Counter.client.tsx',
        props: { count: 5 },
        load: 'immediate',
      })

      registry.register({
        id: 'counter-2',
        componentPath: 'components/Counter.client.tsx',
        props: { count: 10 },
        load: 'idle',
      })

      const all = registry.getAll()
      expect(all).toHaveLength(2)
      expect(all.map((e) => e.id)).toEqual(['counter-1', 'counter-2'])
    })

    it('should clear all islands', () => {
      const registry = new IslandRegistry()

      registry.register({
        id: 'counter-1',
        componentPath: 'components/Counter.client.tsx',
        props: {},
        load: 'immediate',
      })

      expect(registry.has('counter-1')).toBe(true)

      registry.clear()

      expect(registry.has('counter-1')).toBe(false)
      expect(registry.getAll()).toHaveLength(0)
    })

    it('should handle multiple islands with different strategies', () => {
      const registry = new IslandRegistry()

      registry.register({
        id: 'counter-1',
        componentPath: 'components/Counter.client.tsx',
        props: {},
        load: 'immediate',
      })

      registry.register({
        id: 'search-1',
        componentPath: 'components/Search.client.tsx',
        props: {},
        load: 'idle',
      })

      registry.register({
        id: 'ads-1',
        componentPath: 'components/Ads.client.tsx',
        props: {},
        load: 'visible',
      })

      const all = registry.getAll()
      expect(all).toHaveLength(3)

      const strategies = all.map((e) => e.load)
      expect(strategies).toContain('immediate')
      expect(strategies).toContain('idle')
      expect(strategies).toContain('visible')
    })
  })

  describe('Hydration Loading Strategies', () => {
    it('should default to immediate loading strategy', () => {
      const marker = createIsland({
        id: 'counter-1',
        component: () => null,
        props: {},
      })

      // immediate is default, so data-load attribute should not be set
      expect(marker['data-load']).toBeUndefined()
    })

    it('should support idle loading strategy', () => {
      const marker = createIsland({
        id: 'counter-1',
        component: () => null,
        props: {},
        load: 'idle',
      })

      expect(marker['data-load']).toBe('idle')
    })

    it('should support visible loading strategy', () => {
      const marker = createIsland({
        id: 'counter-1',
        component: () => null,
        props: {},
        load: 'visible',
      })

      expect(marker['data-load']).toBe('visible')
    })
  })

  describe('Nested Islands (Island inside Island)', () => {
    it('should handle nested islands independently', () => {
      const parentMarker = createIsland({
        id: 'parent-1',
        component: () => null,
        props: { title: 'Parent' },
        load: 'immediate',
      })

      const childMarker = createIsland({
        id: 'child-1',
        component: () => null,
        props: { count: 5 },
        load: 'idle',
      })

      // Both should have their own markers
      expect(parentMarker['data-island']).toBe('parent-1')
      expect(childMarker['data-island']).toBe('child-1')

      // Both should have independent props
      const parentProps = JSON.parse(parentMarker['data-props'])
      const childProps = JSON.parse(childMarker['data-props'])

      expect(parentProps).toEqual({ title: 'Parent' })
      expect(childProps).toEqual({ count: 5 })

      // Should have different loading strategies
      expect(parentMarker['data-load']).toBeUndefined() // immediate
      expect(childMarker['data-load']).toBe('idle')
    })
  })

  describe('Multiple Islands on Same Page', () => {
    it('should handle multiple islands with unique IDs', () => {
      const marker1 = createIsland({
        id: 'counter-1',
        component: () => null,
        props: { count: 1 },
      })

      const marker2 = createIsland({
        id: 'counter-2',
        component: () => null,
        props: { count: 2 },
      })

      const marker3 = createIsland({
        id: 'search-1',
        component: () => null,
        props: { query: '' },
      })

      // All should have unique IDs
      expect(marker1['data-island']).toBe('counter-1')
      expect(marker2['data-island']).toBe('counter-2')
      expect(marker3['data-island']).toBe('search-1')

      // All should have independent props
      const props1 = JSON.parse(marker1['data-props'])
      const props2 = JSON.parse(marker2['data-props'])
      const props3 = JSON.parse(marker3['data-props'])

      expect(props1).toEqual({ count: 1 })
      expect(props2).toEqual({ count: 2 })
      expect(props3).toEqual({ query: '' })
    })
  })
})
