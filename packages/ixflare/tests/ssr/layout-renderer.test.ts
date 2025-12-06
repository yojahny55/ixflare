/**
 * @fileoverview Tests for layout rendering
 */

import { describe, it, expect } from 'vitest'
import { renderLayoutChain, renderWithoutLayouts } from '../../src/ssr/layout-renderer'
import { useLayoutData } from '../../src/core/layout'
import { renderToString } from 'react-dom/server'
import * as React from 'react'
import type { LayoutProps } from '../../src/types/handlers'

describe('Layout Renderer', () => {
  describe('renderLayoutChain', () => {
    it('should render page content without layouts', () => {
      const pageContent = React.createElement('div', {}, 'Page content')

      const element = renderLayoutChain([], [], pageContent)
      const html = renderToString(element)

      expect(html).toContain('Page content')
    })

    it('should wrap page content with single layout', () => {
      function RootLayout({ children }: LayoutProps) {
        return React.createElement('div', { className: 'root' }, children)
      }

      const pageContent = React.createElement('p', {}, 'Page content')
      const element = renderLayoutChain([RootLayout], [undefined], pageContent)
      const html = renderToString(element)

      expect(html).toContain('class="root"')
      expect(html).toContain('Page content')
    })

    it('should compose nested layouts from outermost to innermost', () => {
      function RootLayout({ children }: LayoutProps) {
        return React.createElement('div', { className: 'root' }, children)
      }

      function DashboardLayout({ children }: LayoutProps) {
        return React.createElement('div', { className: 'dashboard' }, children)
      }

      function SettingsLayout({ children }: LayoutProps) {
        return React.createElement('div', { className: 'settings' }, children)
      }

      const layouts = [RootLayout, DashboardLayout, SettingsLayout]
      const pageContent = React.createElement('p', {}, 'Settings page')

      const element = renderLayoutChain(layouts, [undefined, undefined, undefined], pageContent)
      const html = renderToString(element)

      // Check nesting order: root > dashboard > settings > page
      expect(html).toContain('class="root"')
      expect(html).toContain('class="dashboard"')
      expect(html).toContain('class="settings"')
      expect(html).toContain('Settings page')

      // Verify correct nesting order
      const rootIndex = html.indexOf('class="root"')
      const dashboardIndex = html.indexOf('class="dashboard"')
      const settingsIndex = html.indexOf('class="settings"')

      expect(rootIndex).toBeLessThan(dashboardIndex)
      expect(dashboardIndex).toBeLessThan(settingsIndex)
    })

    it('should pass layout data to layout components', () => {
      interface RootData {
        theme: string
      }

      interface DashboardData {
        title: string
      }

      function RootLayout({ children, data }: LayoutProps<RootData>) {
        return React.createElement(
          'div',
          { 'data-theme': data?.theme },
          children
        )
      }

      function DashboardLayout({ children, data }: LayoutProps<DashboardData>) {
        return React.createElement(
          'div',
          {},
          data?.title && React.createElement('h1', {}, data.title),
          children
        )
      }

      const layouts = [RootLayout, DashboardLayout]
      const layoutData = [{ theme: 'dark' }, { title: 'Dashboard' }]
      const pageContent = React.createElement('p', {}, 'Content')

      const element = renderLayoutChain(layouts, layoutData, pageContent)
      const html = renderToString(element)

      expect(html).toContain('data-theme="dark"')
      expect(html).toContain('<h1>Dashboard</h1>')
      expect(html).toContain('Content')
    })

    it('should pass params to all layouts', () => {
      function Layout({ children, params }: LayoutProps) {
        return React.createElement(
          'div',
          { 'data-user-id': params?.userId },
          children
        )
      }

      const layouts = [Layout]
      const params = { userId: '123' }
      const pageContent = React.createElement('p', {}, 'Profile')

      const element = renderLayoutChain(layouts, [undefined], pageContent, params)
      const html = renderToString(element)

      expect(html).toContain('data-user-id="123"')
    })

    it('should pass request to all layouts', () => {
      function Layout({ children, request }: LayoutProps) {
        return React.createElement(
          'div',
          { 'data-url': request?.url },
          children
        )
      }

      const layouts = [Layout]
      const request = new Request('https://example.com/dashboard')
      const pageContent = React.createElement('p', {}, 'Content')

      const element = renderLayoutChain(layouts, [undefined], pageContent, {}, request)
      const html = renderToString(element)

      expect(html).toContain('data-url="https://example.com/dashboard"')
    })

    it('should handle deeply nested layouts (5+ levels)', () => {
      const createLayout = (name: string) =>
        function Layout({ children }: LayoutProps) {
          return React.createElement('div', { className: name }, children)
        }

      const layouts = [
        createLayout('a'),
        createLayout('b'),
        createLayout('c'),
        createLayout('d'),
        createLayout('e'),
        createLayout('f'),
      ]

      const pageContent = React.createElement('p', {}, 'Deep content')

      const element = renderLayoutChain(layouts, new Array(6).fill(undefined), pageContent)
      const html = renderToString(element)

      // Verify all 6 layouts are present
      expect(html).toContain('class="a"')
      expect(html).toContain('class="b"')
      expect(html).toContain('class="c"')
      expect(html).toContain('class="d"')
      expect(html).toContain('class="e"')
      expect(html).toContain('class="f"')
      expect(html).toContain('Deep content')
    })

    it('should support layout state preservation pattern', () => {
      // This test verifies that renderLayoutChain creates the correct element structure
      // that would allow React to preserve layout state during client-side navigation
      // (actual state preservation happens in the React runtime, not in this function)

      function StatefulLayout({ children }: LayoutProps) {
        return React.createElement('div', { 'data-stateful': 'true' }, children)
      }

      const pageContent1 = React.createElement('p', {}, 'Page 1')
      const element1 = renderLayoutChain([StatefulLayout], [undefined], pageContent1)
      const html1 = renderToString(element1)

      expect(html1).toContain('data-stateful="true"')
      expect(html1).toContain('Page 1')

      // Verify we can render different page content with same layout structure
      const pageContent2 = React.createElement('p', {}, 'Page 2')
      const element2 = renderLayoutChain([StatefulLayout], [undefined], pageContent2)
      const html2 = renderToString(element2)

      expect(html2).toContain('data-stateful="true"')
      expect(html2).toContain('Page 2')
    })

    it('should handle edge case: empty layout data array', () => {
      function Layout({ children, data }: LayoutProps) {
        return React.createElement(
          'div',
          {},
          data ? 'Has data' : 'No data',
          children
        )
      }

      const layouts = [Layout]
      const pageContent = React.createElement('p', {}, 'Content')

      const element = renderLayoutChain(layouts, [], pageContent)
      const html = renderToString(element)

      expect(html).toContain('No data')
      expect(html).toContain('Content')
    })

    it('should accumulate context data correctly from parent to child', () => {
      // This test verifies the fix for Issue #1: context data accumulation
      // Each layout should see data from itself AND all parent layouts

      function RootLayout({ children }: LayoutProps) {
        const ctx = useLayoutData<{ root?: string }>()
        return React.createElement(
          'div',
          { 'data-root-ctx': ctx.root || 'missing' },
          children
        )
      }

      function DashboardLayout({ children }: LayoutProps) {
        const ctx = useLayoutData<{ root?: string; dashboard?: string }>()
        return React.createElement(
          'div',
          {
            'data-dash-root': ctx.root || 'missing',
            'data-dash-dashboard': ctx.dashboard || 'missing',
          },
          children
        )
      }

      function PageComponent() {
        const ctx = useLayoutData<{ root?: string; dashboard?: string }>()
        return React.createElement(
          'p',
          {},
          `Page sees root=${ctx.root}, dashboard=${ctx.dashboard}`
        )
      }

      const layouts = [RootLayout, DashboardLayout]
      const layoutData = [{ root: 'rootValue' }, { dashboard: 'dashValue' }]
      const pageContent = React.createElement(PageComponent)

      const element = renderLayoutChain(layouts, layoutData, pageContent)
      const html = renderToString(element)

      // Root layout should see its own data
      expect(html).toContain('data-root-ctx="rootValue"')

      // Dashboard layout should see root + dashboard data
      expect(html).toContain('data-dash-root="rootValue"')
      expect(html).toContain('data-dash-dashboard="dashValue"')

      // Page should see all accumulated data
      expect(html).toContain('Page sees root=rootValue, dashboard=dashValue')
    })
  })

  describe('renderWithoutLayouts', () => {
    it('should render page content directly', () => {
      const pageContent = React.createElement('div', {}, 'Page without layouts')

      const element = renderWithoutLayouts(pageContent)
      const html = renderToString(element)

      expect(html).toContain('Page without layouts')
    })

    it('should wrap content in fragment', () => {
      const pageContent = React.createElement('p', {}, 'Content')

      const element = renderWithoutLayouts(pageContent)

      // Fragment type check
      expect(element.type).toBe(React.Fragment)
    })
  })
})
