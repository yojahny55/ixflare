/**
 * @module server-only-removal.test
 * @description Unit tests for server-only code removal functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {  transformServerExports, createServerOnlyRemovalPlugin } from '../src/server-only-removal'
import type { Plugin } from 'vite'

describe('transformServerExports', () => {
  const routesDir = 'src/routes'

  it('should replace async function loader export with empty stub', () => {
    const code = `
export async function loader({ params }) {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [params.id])
  return { user }
}

export default function UserPage({ data }) {
  return <div>{data.user.name}</div>
}
`

    const result = transformServerExports(
      code,
      '/project/src/routes/users/[id].tsx',
      routesDir,
      false // client build
    )

    expect(result).toBeTruthy()
    expect(result?.code).toContain('export async function loader() { /* server-only: removed in client build */ }')
    // Server code should be removed
    expect(result?.code).not.toContain('db.query')
    expect(result?.code).not.toContain('SELECT * FROM users')
  })

  it('should replace sync function loader export with empty stub', () => {
    const code = `
export function loader() {
  return { data: 'test' }
}
`

    const result = transformServerExports(
      code,
      '/project/src/routes/test.tsx',
      routesDir,
      false
    )

    expect(result).toBeTruthy()
    expect(result?.code).toContain('export function loader() { /* server-only: removed in client build */ }')
  })

  it('should replace const loader export with empty stub', () => {
    const code = `
export const loader = async ({ params }) => {
  return { data: await fetchData(params.id) }
}
`

    const result = transformServerExports(
      code,
      '/project/src/routes/test.tsx',
      routesDir,
      false
    )

    expect(result).toBeTruthy()
    expect(result?.code).toContain('export const loader = () => { /* server-only: removed in client build */ }')
  })

  it('should replace action export with empty stub', () => {
    const code = `
export async function action({ request }) {
  const formData = await request.formData()
  await db.insert('users', formData)
  return { success: true }
}
`

    const result = transformServerExports(
      code,
      '/project/src/routes/users/new.tsx',
      routesDir,
      false
    )

    expect(result).toBeTruthy()
    expect(result?.code).toContain('export async function action() { /* server-only: removed in client build */ }')
    // Server code should be removed
    expect(result?.code).not.toContain('db.insert')
  })

  it('should replace headers export with empty stub', () => {
    const code = `
export function headers() {
  return {
    'Cache-Control': 'public, max-age=3600',
  }
}
`

    const result = transformServerExports(
      code,
      '/project/src/routes/test.tsx',
      routesDir,
      false
    )

    expect(result).toBeTruthy()
    expect(result?.code).toContain('export function headers() { /* server-only: removed in client build */ }')
  })

  it('should handle multiple server exports in same file', () => {
    const code = `
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
`

    const result = transformServerExports(
      code,
      '/project/src/routes/users.tsx',
      routesDir,
      false
    )

    expect(result).toBeTruthy()
    expect(result?.code).toContain('export async function loader() { /* server-only: removed in client build */ }')
    expect(result?.code).toContain('export async function action() { /* server-only: removed in client build */ }')
    expect(result?.code).toContain('export function headers() { /* server-only: removed in client build */ }')
  })

  it('should NOT transform non-route files', () => {
    const code = `
export async function loader() {
  return { data: 'test' }
}
`

    const result = transformServerExports(
      code,
      '/project/src/utils/helper.ts', // Not in routes dir
      routesDir,
      false
    )

    expect(result).toBeNull()
  })

  it('should NOT transform during SSR build', () => {
    const code = `
export async function loader() {
  return { data: 'test' }
}
`

    const result = transformServerExports(
      code,
      '/project/src/routes/test.tsx',
      routesDir,
      true // SSR build
    )

    expect(result).toBeNull()
  })

  it('should preserve component exports unchanged', () => {
    const code = `
export async function loader() {
  return { user: await db.getUser('123') }
}

export default function UserPage({ data }) {
  return <div>{data.user.name}</div>
}

export function UserCard({ user }) {
  return <div>{user.email}</div>
}
`

    const result = transformServerExports(
      code,
      '/project/src/routes/users.tsx',
      routesDir,
      false
    )

    expect(result).toBeTruthy()
    // Loader should be replaced with stub
    expect(result?.code).toContain('export async function loader() { /* server-only: removed in client build */ }')
    // Component exports should remain unchanged
    expect(result?.code).toContain('export default function UserPage')
    expect(result?.code).toContain('export function UserCard')
    expect(result?.code).toContain('<div>{data.user.name}</div>')
  })

  it('should handle TypeScript type annotations', () => {
    const code = `
import type { LoaderFunction } from 'ixflare'

export const loader: LoaderFunction = async ({ params }) => {
  return { data: params }
}
`

    const result = transformServerExports(
      code,
      '/project/src/routes/test.tsx',
      routesDir,
      false
    )

    expect(result).toBeTruthy()
    expect(result?.code).toContain('export const loader = () => { /* server-only: removed in client build */ }')
  })

  it('should handle complex generic type annotations', () => {
    const code = `
import type { LoaderFunction } from 'ixflare'

export const loader: LoaderFunction<{ user: User }, { id: string }> = async ({ params }) => {
  return { user: await getUser(params.id) }
}
`

    const result = transformServerExports(
      code,
      '/project/src/routes/test.tsx',
      routesDir,
      false
    )

    expect(result).toBeTruthy()
    expect(result?.code).toContain('export const loader = () => { /* server-only: removed in client build */ }')
    // Server code should be removed
    expect(result?.code).not.toContain('getUser')
  })

  it('should return null when no server exports found', () => {
    const code = `
export default function Page() {
  return <div>Hello</div>
}

export function helper() {
  return 'test'
}
`

    const result = transformServerExports(
      code,
      '/project/src/routes/test.tsx',
      routesDir,
      false
    )

    // No transformations needed
    expect(result).toBeNull()
  })

  // CRITICAL: Tests for deeply nested code blocks (security vulnerability fix)
  describe('deeply nested code handling (security critical)', () => {
    it('should strip loader with nested if/else blocks', () => {
      const code = `
export async function loader({ params }) {
  if (params.id) {
    if (params.type === 'admin') {
      const secret = process.env.ADMIN_SECRET
      return { data: await db.getAdminData(secret) }
    } else {
      return { data: await db.getUserData(params.id) }
    }
  }
  return { error: 'Not found' }
}

export default function Page({ data }) {
  return <div>{data}</div>
}
`

      const result = transformServerExports(
        code,
        '/project/src/routes/users.tsx',
        routesDir,
        false
      )

      expect(result).toBeTruthy()
      expect(result?.code).toContain('export async function loader() { /* server-only: removed in client build */ }')
      // CRITICAL: Verify secrets are removed
      expect(result?.code).not.toContain('ADMIN_SECRET')
      expect(result?.code).not.toContain('db.getAdminData')
      expect(result?.code).not.toContain('db.getUserData')
    })

    it('should strip loader with try/catch/finally blocks', () => {
      const code = `
export async function loader({ params }) {
  try {
    const connection = await db.connect(process.env.DATABASE_URL)
    try {
      const result = await connection.query('SELECT * FROM secrets')
      return { data: result }
    } finally {
      connection.close()
    }
  } catch (error) {
    if (error.code === 'AUTH_FAILED') {
      throw new Error('Invalid credentials')
    }
    throw error
  }
}
`

      const result = transformServerExports(
        code,
        '/project/src/routes/data.tsx',
        routesDir,
        false
      )

      expect(result).toBeTruthy()
      expect(result?.code).toContain('export async function loader() { /* server-only: removed in client build */ }')
      expect(result?.code).not.toContain('DATABASE_URL')
      expect(result?.code).not.toContain('SELECT * FROM secrets')
    })

    it('should strip loader with nested loops', () => {
      const code = `
export async function loader() {
  const results = []
  for (const table of ['users', 'orders', 'secrets']) {
    for (let i = 0; i < 10; i++) {
      const row = await db.query(\`SELECT * FROM \${table} LIMIT 1 OFFSET \${i}\`)
      if (row) {
        results.push({ table, row, apiKey: process.env.API_KEY })
      }
    }
  }
  return { results }
}
`

      const result = transformServerExports(
        code,
        '/project/src/routes/admin.tsx',
        routesDir,
        false
      )

      expect(result).toBeTruthy()
      expect(result?.code).toContain('export async function loader() { /* server-only: removed in client build */ }')
      expect(result?.code).not.toContain('API_KEY')
      expect(result?.code).not.toContain('db.query')
    })

    it('should strip action with deeply nested switch/case', () => {
      const code = `
export async function action({ request }) {
  const form = await request.formData()
  const action = form.get('action')

  switch (action) {
    case 'create': {
      const user = await db.createUser({
        password: await bcrypt.hash(form.get('password'), process.env.SALT_ROUNDS)
      })
      return { user }
    }
    case 'delete': {
      if (form.get('confirm') === 'yes') {
        await db.deleteUser(form.get('id'), { secret: process.env.DELETE_SECRET })
      }
      return { deleted: true }
    }
    default: {
      return { error: 'Unknown action' }
    }
  }
}
`

      const result = transformServerExports(
        code,
        '/project/src/routes/users.tsx',
        routesDir,
        false
      )

      expect(result).toBeTruthy()
      expect(result?.code).toContain('export async function action() { /* server-only: removed in client build */ }')
      expect(result?.code).not.toContain('SALT_ROUNDS')
      expect(result?.code).not.toContain('DELETE_SECRET')
      expect(result?.code).not.toContain('bcrypt.hash')
    })

    it('should handle braces inside strings without breaking', () => {
      const code = `
export async function loader() {
  const query = "SELECT * FROM users WHERE data = '{nested: {json: true}}'"
  const template = \`Hello {name}, your data is: \${JSON.stringify({ key: 'value' })}\`
  return { data: await db.query(query), secret: process.env.SECRET }
}
`

      const result = transformServerExports(
        code,
        '/project/src/routes/test.tsx',
        routesDir,
        false
      )

      expect(result).toBeTruthy()
      expect(result?.code).toContain('export async function loader() { /* server-only: removed in client build */ }')
      expect(result?.code).not.toContain('SECRET')
    })

    it('should handle braces inside comments without breaking', () => {
      const code = `
export async function loader() {
  // This comment has braces { like this }
  /* And this block comment {
     has multiple lines with braces { }
  } */
  const secret = process.env.API_SECRET
  return { data: secret }
}
`

      const result = transformServerExports(
        code,
        '/project/src/routes/test.tsx',
        routesDir,
        false
      )

      expect(result).toBeTruthy()
      expect(result?.code).toContain('export async function loader() { /* server-only: removed in client build */ }')
      expect(result?.code).not.toContain('API_SECRET')
    })
  })
})

describe('createServerOnlyRemovalPlugin', () => {
  it('should create a Vite plugin with correct name', () => {
    const plugin = createServerOnlyRemovalPlugin()

    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('ixflare-server-only-removal')
  })

  it('should only apply during build', () => {
    const plugin = createServerOnlyRemovalPlugin()

    expect(plugin.apply).toBe('build')
  })

  it('should have transform, resolveId, load, and buildEnd hooks', () => {
    const plugin = createServerOnlyRemovalPlugin()

    expect(plugin.transform).toBeDefined()
    expect(plugin.resolveId).toBeDefined()
    expect(plugin.load).toBeDefined()
    expect(plugin.buildEnd).toBeDefined()
  })
})

describe('server-only package integration', () => {
  it('should resolve server-only package to virtual module', () => {
    const plugin = createServerOnlyRemovalPlugin({ routesDir: 'src/routes' })
    const resolveId = plugin.resolveId as Function

    const result = resolveId.call({}, 'server-only', '/project/src/routes/test.tsx')

    expect(result).toBe('\0server-only')
  })

  it('should load empty export for server-only in SSR build', () => {
    const plugin = createServerOnlyRemovalPlugin()
    const load = plugin.load as Function

    const context = {
      environment: { name: 'ssr' },
    }

    const result = load.call(context, '\0server-only')

    expect(result).toBe('export {}')
  })
})

describe('.server file convention', () => {
  it('should detect .server.ts files', () => {
    const plugin = createServerOnlyRemovalPlugin({ routesDir: 'src/routes' })
    const resolveId = plugin.resolveId as Function

    const mockError = vi.fn()
    const context = {
      error: mockError,
      environment: undefined, // Client build
      ssr: false,
    }

    // Client file trying to import .server file should error
    const result = resolveId.call(
      context,
      './db.server.ts',
      '/project/src/components/user-list.tsx'
    )

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Cannot import server-only module'),
      })
    )
  })

  it('should allow .server files to import other .server files', () => {
    const plugin = createServerOnlyRemovalPlugin({ routesDir: 'src/routes' })
    const resolveId = plugin.resolveId as Function

    const mockError = vi.fn()
    const context = {
      error: mockError,
      environment: undefined,
      ssr: false,
    }

    // .server file importing another .server file should be allowed
    const result = resolveId.call(
      context,
      './auth.server.ts',
      '/project/src/lib/db.server.ts' // Importer is also .server
    )

    // Should not throw error
    expect(mockError).not.toHaveBeenCalled()
  })

  it('should support .server/ directory convention', () => {
    const plugin = createServerOnlyRemovalPlugin({ routesDir: 'src/routes' })
    const resolveId = plugin.resolveId as Function

    const mockError = vi.fn()
    const context = {
      error: mockError,
      environment: undefined,
      ssr: false,
    }

    // Client file trying to import from .server/ directory should error
    const result = resolveId.call(
      context,
      './.server/utils.ts',
      '/project/src/components/button.tsx'
    )

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Cannot import server-only module'),
      })
    )
  })

  it('should NOT enforce .server boundary during SSR build', () => {
    const plugin = createServerOnlyRemovalPlugin({ routesDir: 'src/routes' })
    const resolveId = plugin.resolveId as Function

    const mockError = vi.fn()
    const context = {
      error: mockError,
      environment: { name: 'ssr' }, // SSR build
      ssr: true,
    }

    // SSR build can import .server files
    const result = resolveId.call(
      context,
      './db.server.ts',
      '/project/src/routes/users.tsx'
    )

    expect(mockError).not.toHaveBeenCalled()
  })
})
