/**
 * @module server-only-bundle.test
 * @description Integration tests for server-only code removal in actual bundles
 */

import { describe, it, expect } from 'vitest'
import { analyzeServerCodeRemoval } from '../../src/build'
import type { OutputBundle, OutputChunk } from 'rollup'

describe('Server-Only Bundle Integration', () => {
  describe('analyzeServerCodeRemoval', () => {
    it('should detect NO server code in clean client bundle', () => {
      const bundle: OutputBundle = {
        'index.js': {
          type: 'chunk',
          code: `
export default function UserPage({ data }) {
  return <div>{data.user.name}</div>
}

function formatDate(date) {
  return new Date(date).toLocaleDateString()
}
`,
          fileName: 'index.js',
          name: 'index',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: true,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['default'],
          modules: {},
        } as OutputChunk,
      }

      const report = analyzeServerCodeRemoval(bundle)

      expect(report.hasServerCode).toBe(false)
      expect(report.leakedExports).toEqual([])
    })

    it('should detect loader export in client bundle (BAD)', () => {
      const bundle: OutputBundle = {
        'index.js': {
          type: 'chunk',
          code: `
export async function loader({ params }) {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [params.id])
  return { user }
}

export default function UserPage({ data }) {
  return <div>{data.user.name}</div>
}
`,
          fileName: 'index.js',
          name: 'index',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: true,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['loader', 'default'],
          modules: {},
        } as OutputChunk,
      }

      const report = analyzeServerCodeRemoval(bundle)

      expect(report.hasServerCode).toBe(true)
      expect(report.leakedExports).toContain('loader')
    })

    it('should detect const loader export in client bundle (BAD)', () => {
      const bundle: OutputBundle = {
        'route.js': {
          type: 'chunk',
          code: `
export const loader = async ({ params }) => {
  return { data: await db.getUser(params.id) }
}
`,
          fileName: 'route.js',
          name: 'route',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: false,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['loader'],
          modules: {},
        } as OutputChunk,
      }

      const report = analyzeServerCodeRemoval(bundle)

      expect(report.hasServerCode).toBe(true)
      expect(report.leakedExports).toContain('loader')
    })

    it('should detect action export in client bundle (BAD)', () => {
      const bundle: OutputBundle = {
        'form.js': {
          type: 'chunk',
          code: `
export async function action({ request }) {
  const formData = await request.formData()
  await db.insert('users', formData)
  return { success: true }
}
`,
          fileName: 'form.js',
          name: 'form',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: false,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['action'],
          modules: {},
        } as OutputChunk,
      }

      const report = analyzeServerCodeRemoval(bundle)

      expect(report.hasServerCode).toBe(true)
      expect(report.leakedExports).toContain('action')
    })

    it('should detect headers export in client bundle (BAD)', () => {
      const bundle: OutputBundle = {
        'api.js': {
          type: 'chunk',
          code: `
export function headers() {
  return { 'Cache-Control': 'no-cache' }
}
`,
          fileName: 'api.js',
          name: 'api',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: false,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['headers'],
          modules: {},
        } as OutputChunk,
      }

      const report = analyzeServerCodeRemoval(bundle)

      expect(report.hasServerCode).toBe(true)
      expect(report.leakedExports).toContain('headers')
    })

    it('should detect multiple server exports in client bundle (BAD)', () => {
      const bundle: OutputBundle = {
        'route.js': {
          type: 'chunk',
          code: `
export async function loader() {
  return { data: await db.query('SELECT * FROM users') }
}

export async function action() {
  return { success: true }
}

export function headers() {
  return { 'Cache-Control': 'no-cache' }
}

export default function Page({ data }) {
  return <div>{data}</div>
}
`,
          fileName: 'route.js',
          name: 'route',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: false,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['loader', 'action', 'headers', 'default'],
          modules: {},
        } as OutputChunk,
      }

      const report = analyzeServerCodeRemoval(bundle)

      expect(report.hasServerCode).toBe(true)
      expect(report.leakedExports).toContain('loader')
      expect(report.leakedExports).toContain('action')
      expect(report.leakedExports).toContain('headers')
      expect(report.leakedExports).toHaveLength(3)
    })

    it('should handle bundles with multiple chunks', () => {
      const bundle: OutputBundle = {
        'index.js': {
          type: 'chunk',
          code: `export default function Home() { return <div>Home</div> }`,
          fileName: 'index.js',
          name: 'index',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: true,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['default'],
          modules: {},
        } as OutputChunk,
        'about.js': {
          type: 'chunk',
          code: `export default function About() { return <div>About</div> }`,
          fileName: 'about.js',
          name: 'about',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: false,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['default'],
          modules: {},
        } as OutputChunk,
        'vendor.js': {
          type: 'chunk',
          code: `export { createElement } from 'react'`,
          fileName: 'vendor.js',
          name: 'vendor',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: false,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['createElement'],
          modules: {},
        } as OutputChunk,
      }

      const report = analyzeServerCodeRemoval(bundle)

      expect(report.hasServerCode).toBe(false)
      expect(report.leakedExports).toEqual([])
    })

    it('should ignore asset files (CSS, images)', () => {
      const bundle: OutputBundle = {
        'index.js': {
          type: 'chunk',
          code: `export default function Page() { return <div>Test</div> }`,
          fileName: 'index.js',
          name: 'index',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: true,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['default'],
          modules: {},
        } as OutputChunk,
        'styles.css': {
          type: 'asset',
          fileName: 'styles.css',
          source: '.button { color: blue; }',
        },
        'logo.png': {
          type: 'asset',
          fileName: 'logo.png',
          source: Buffer.from('fake-image-data'),
        },
      }

      const report = analyzeServerCodeRemoval(bundle)

      // Should only analyze JS chunks, not assets
      expect(report.hasServerCode).toBe(false)
    })

    it('should handle real-world component with server imports removed', () => {
      // Simulates what the bundle SHOULD look like after tree-shaking
      const bundle: OutputBundle = {
        'users-[id].js': {
          type: 'chunk',
          code: `
// Server imports were tree-shaken out (no db, no SECRET_KEY)

export default function UserPage({ data }) {
  return <div className="user-profile">
    <h1>{data.user.name}</h1>
    <p>{data.user.email}</p>
  </div>
}

export function UserCard({ user }) {
  return <div className="card">{user.name}</div>
}
`,
          fileName: 'users-[id].js',
          name: 'users-[id]',
          facadeModuleId: null,
          isDynamicEntry: false,
          isEntry: false,
          isImplicitEntry: false,
          moduleIds: [],
          imports: [],
          dynamicImports: [],
          exports: ['default', 'UserCard'],
          modules: {},
        } as OutputChunk,
      }

      const report = analyzeServerCodeRemoval(bundle)

      expect(report.hasServerCode).toBe(false)
      expect(report.leakedExports).toEqual([])
    })
  })
})

describe('Transitive Import Handling', () => {
  it('should verify that server-only imports are NOT in client bundle', () => {
    // Good bundle: db import was tree-shaken because loader was removed
    const goodBundle: OutputBundle = {
      'route.js': {
        type: 'chunk',
        code: `
import { formatDate } from '@/utils'    // KEPT - used by component

export default function Page({ data }) {
  return <div>Updated: {formatDate(data.date)}</div>
}
`,
        fileName: 'route.js',
        name: 'route',
        facadeModuleId: null,
        isDynamicEntry: false,
        isEntry: false,
        isImplicitEntry: false,
        moduleIds: [],
        imports: [],
        dynamicImports: [],
        exports: ['default'],
        modules: {},
      } as OutputChunk,
    }

    const report = analyzeServerCodeRemoval(goodBundle)

    expect(report.hasServerCode).toBe(false)
    // Verify db import is NOT present (should be tree-shaken out)
    expect(goodBundle['route.js'].code).not.toContain('@/lib/database')
    expect(goodBundle['route.js'].code).not.toContain(' db ')
    // Verify shared utility IS present
    expect(goodBundle['route.js'].code).toContain('from \'@/utils\'')
  })

  it('should detect if secret imports leaked to client bundle (BAD)', () => {
    // Bad bundle: SECRET_KEY leaked because loader wasn't properly removed
    const badBundle: OutputBundle = {
      'route.js': {
        type: 'chunk',
        code: `
import { SECRET_KEY } from '@/config'  // 🚨 SHOULD NOT BE HERE!

export async function loader() {
  return { secret: SECRET_KEY }
}
`,
        fileName: 'route.js',
        name: 'route',
        facadeModuleId: null,
        isDynamicEntry: false,
        isEntry: false,
        isImplicitEntry: false,
        moduleIds: [],
        imports: [],
        dynamicImports: [],
        exports: ['loader'],
        modules: {},
      } as OutputChunk,
    }

    const report = analyzeServerCodeRemoval(badBundle)

    expect(report.hasServerCode).toBe(true)
    // Secret import is present - SECURITY ISSUE
    expect(badBundle['route.js'].code).toContain('SECRET_KEY')
  })
})
