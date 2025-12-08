/**
 * @fileoverview Tests for layout context and utilities
 */

import { describe, it, expect } from 'vitest'
import { useLayoutData, LayoutContextProvider } from '../../src/core/layout'
import type { LayoutProps, LayoutLoaderArgs } from '../../src/types/handlers'
import { renderToString } from 'react-dom/server'
import * as React from 'react'

describe('Layout Context', () => {
  describe('useLayoutData', () => {
    it('should return empty object when no context provided', () => {
      function TestComponent() {
        const data = useLayoutData()
        return React.createElement('div', {}, JSON.stringify(data))
      }

      const html = renderToString(React.createElement(TestComponent))

      expect(html).toContain('{}')
    })

    it('should return layout data from context', () => {
      const layoutData = { theme: 'dark', user: { id: 1, name: 'Alice' } }

      function TestComponent() {
        const data = useLayoutData<typeof layoutData>()
        return React.createElement('div', {}, data.user.name)
      }

      const html = renderToString(
        React.createElement(
          LayoutContextProvider,
          { value: layoutData },
          React.createElement(TestComponent)
        )
      )

      expect(html).toContain('Alice')
    })

    it('should accumulate data from nested layouts', () => {
      const rootData = { theme: 'dark' }
      const dashboardData = { ...rootData, dashboard: { name: 'Analytics' } }

      function NestedComponent() {
        const data = useLayoutData<typeof dashboardData>()
        return React.createElement('div', {}, `${data.theme} ${data.dashboard.name}`)
      }

      const html = renderToString(
        React.createElement(
          LayoutContextProvider,
          { value: rootData },
          React.createElement(
            LayoutContextProvider,
            { value: dashboardData },
            React.createElement(NestedComponent)
          )
        )
      )

      expect(html).toContain('dark Analytics')
    })
  })

  describe('LayoutProps type', () => {
    it('should accept children and data', () => {
      interface MyLayoutData {
        user: { name: string }
      }

      function MyLayout({ children, data }: LayoutProps<MyLayoutData>) {
        return React.createElement(
          'div',
          {},
          data ? React.createElement('h1', {}, data.user.name) : null,
          children
        )
      }

      const html = renderToString(
        React.createElement(
          MyLayout,
          { data: { user: { name: 'Bob' } } },
          React.createElement('p', {}, 'Content')
        )
      )

      expect(html).toContain('Bob')
      expect(html).toContain('Content')
    })

    it('should work without data prop', () => {
      function SimpleLayout({ children }: LayoutProps) {
        return React.createElement('div', { className: 'wrapper' }, children)
      }

      const html = renderToString(
        React.createElement(SimpleLayout, {}, React.createElement('p', {}, 'Child content'))
      )

      expect(html).toContain('wrapper')
      expect(html).toContain('Child content')
    })
  })

  describe('LayoutLoaderArgs type', () => {
    it('should be compatible with LoaderArgs structure', () => {
      // Type test - this should compile
      const mockArgs: LayoutLoaderArgs = {
        request: new Request('https://example.com/dashboard'),
        params: { id: '123' },
        env: { DATABASE: {} },
        ctx: {} as ExecutionContext,
        query: new URLSearchParams('?filter=active'),
        url: new URL('https://example.com/dashboard'),
        method: 'GET',
        headers: new Headers(),
      }

      expect(mockArgs.request).toBeInstanceOf(Request)
      expect(mockArgs.params.id).toBe('123')
      expect(mockArgs.query.get('filter')).toBe('active')
    })
  })
})
