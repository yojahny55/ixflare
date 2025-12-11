/**
 * @module tests/island-discovery
 * @description Tests for island file discovery and parsing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverIslands, parseIslandFile } from '../src/island-discovery'

describe('Island Discovery', () => {
  let testDir: string

  beforeEach(async () => {
    // Create temporary test directory with unique identifier to prevent collisions
    testDir = join(
      tmpdir(),
      `ixflare-island-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true, maxRetries: 3 })
    } catch {
      // Ignore cleanup errors in tests
    }
  })

  describe('discoverIslands', () => {
    it('should discover *.client.tsx files', async () => {
      // Create test island files
      await writeFile(
        join(testDir, 'Counter.client.tsx'),
        `
export const island = true
export default function Counter() {}
`
      )

      await writeFile(
        join(testDir, 'SearchBox.client.tsx'),
        `
export const island = true
export default function SearchBox() {}
`
      )

      const islands = await discoverIslands(testDir)

      expect(islands).toHaveLength(2)
      expect(islands.map((i) => i.componentName).sort()).toEqual(['Counter', 'SearchBox'])
    })

    it('should parse island = true export marker', async () => {
      await writeFile(
        join(testDir, 'Counter.client.tsx'),
        `
export const island = true
export default function Counter() {}
`
      )

      const islands = await discoverIslands(testDir)

      expect(islands).toHaveLength(1)
      expect(islands[0].id).toBe('counter')
      expect(islands[0].componentName).toBe('Counter')
    })

    it('should parse island = { load: "idle" } config', async () => {
      await writeFile(
        join(testDir, 'LazyWidget.client.tsx'),
        `
export const island = { load: 'idle' }
export default function LazyWidget() {}
`
      )

      const islands = await discoverIslands(testDir)

      expect(islands).toHaveLength(1)
      expect(islands[0].loadStrategy).toBe('idle')
    })

    it('should parse island = { load: "visible" } config', async () => {
      await writeFile(
        join(testDir, 'BelowFold.client.tsx'),
        `
export const island = { load: 'visible' }
export default function BelowFold() {}
`
      )

      const islands = await discoverIslands(testDir)

      expect(islands).toHaveLength(1)
      expect(islands[0].loadStrategy).toBe('visible')
    })

    it('should default to "immediate" when load strategy not specified', async () => {
      await writeFile(
        join(testDir, 'Counter.client.tsx'),
        `
export const island = true
export default function Counter() {}
`
      )

      const islands = await discoverIslands(testDir)

      expect(islands).toHaveLength(1)
      expect(islands[0].loadStrategy).toBe('immediate')
    })

    it('should ignore files without island export', async () => {
      await writeFile(
        join(testDir, 'RegularComponent.client.tsx'),
        `
export default function RegularComponent() {}
`
      )

      const islands = await discoverIslands(testDir)

      expect(islands).toHaveLength(0)
    })

    it('should handle nested component directories', async () => {
      // Create nested directory structure
      const featuresDir = join(testDir, 'features', 'auth')
      await mkdir(featuresDir, { recursive: true })

      await writeFile(
        join(featuresDir, 'LoginForm.client.tsx'),
        `
export const island = true
export default function LoginForm() {}
`
      )

      const islands = await discoverIslands(testDir)

      expect(islands).toHaveLength(1)
      expect(islands[0].componentName).toBe('LoginForm')
      expect(islands[0].filePath).toContain('features/auth')
    })

    it('should return empty array when no island files exist', async () => {
      const islands = await discoverIslands(testDir)
      expect(islands).toEqual([])
    })

    it('should handle directory without *.client.tsx files', async () => {
      // Create some non-island files
      await writeFile(join(testDir, 'Component.tsx'), 'export default function Component() {}')
      await writeFile(join(testDir, 'utils.ts'), 'export function helper() {}')

      const islands = await discoverIslands(testDir)
      expect(islands).toEqual([])
    })
  })

  describe('parseIslandFile', () => {
    it('should extract component name from PascalCase filename', async () => {
      await writeFile(
        join(testDir, 'UserProfile.client.tsx'),
        `
export const island = true
export default function UserProfile() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'UserProfile.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.componentName).toBe('UserProfile')
    })

    it('should convert filename to kebab-case id', async () => {
      await writeFile(
        join(testDir, 'SearchBox.client.tsx'),
        `
export const island = true
export default function SearchBox() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'SearchBox.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.id).toBe('search-box')
    })

    it('should return null for files without island export', async () => {
      await writeFile(
        join(testDir, 'Regular.client.tsx'),
        `
export default function Regular() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'Regular.client.tsx'))

      expect(result).toBeNull()
    })

    it('should handle island = { load: "idle" } object syntax', async () => {
      await writeFile(
        join(testDir, 'Lazy.client.tsx'),
        `
export const island = { load: 'idle' }
export default function Lazy() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'Lazy.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.loadStrategy).toBe('idle')
    })

    it('should handle multi-line island object', async () => {
      await writeFile(
        join(testDir, 'Complex.client.tsx'),
        `
export const island = {
  load: 'visible',
}
export default function Complex() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'Complex.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.loadStrategy).toBe('visible')
    })

    it('should handle file read errors gracefully', async () => {
      const nonExistentFile = join(testDir, 'DoesNotExist.client.tsx')

      await expect(parseIslandFile(nonExistentFile)).rejects.toThrow()
    })

    it('should handle empty island files', async () => {
      await writeFile(join(testDir, 'Empty.client.tsx'), '')

      const result = await parseIslandFile(join(testDir, 'Empty.client.tsx'))

      // Empty file has no island export, should return null
      expect(result).toBeNull()
    })

    it('should handle files with only comments', async () => {
      await writeFile(
        join(testDir, 'OnlyComments.client.tsx'),
        `
// This is a comment
/* Another comment */
`
      )

      const result = await parseIslandFile(join(testDir, 'OnlyComments.client.tsx'))

      expect(result).toBeNull()
    })

    it('should handle malformed island export (commented out)', async () => {
      await writeFile(
        join(testDir, 'CommentedIsland.client.tsx'),
        `
// export const island = true
export default function CommentedIsland() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'CommentedIsland.client.tsx'))

      // Commented out export should not match
      expect(result).toBeNull()
    })

    it('should handle island export in string (false positive prevention)', async () => {
      await writeFile(
        join(testDir, 'StringIsland.client.tsx'),
        `
const code = "export const island = true"
export default function StringIsland() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'StringIsland.client.tsx'))

      // Current regex will match this - documenting existing behavior
      // In a stricter implementation, this could be handled with AST parsing
      expect(result).not.toBeNull()
    })
  })

  describe('Island ID generation', () => {
    it('should convert PascalCase to kebab-case', async () => {
      await writeFile(
        join(testDir, 'UserProfileCard.client.tsx'),
        `
export const island = true
export default function UserProfileCard() {}
`
      )

      const islands = await discoverIslands(testDir)

      expect(islands[0].id).toBe('user-profile-card')
    })

    it('should handle single word component names', async () => {
      await writeFile(
        join(testDir, 'Button.client.tsx'),
        `
export const island = true
export default function Button() {}
`
      )

      const islands = await discoverIslands(testDir)

      expect(islands[0].id).toBe('button')
    })

    it('should handle acronyms in component names', async () => {
      await writeFile(
        join(testDir, 'APIStatus.client.tsx'),
        `
export const island = true
export default function APIStatus() {}
`
      )

      const islands = await discoverIslands(testDir)

      expect(islands[0].id).toBe('api-status')
    })
  })

  describe('Props extraction', () => {
    it('should extract props from interface definition', async () => {
      await writeFile(
        join(testDir, 'Counter.client.tsx'),
        `
export const island = true

interface CounterProps {
  initialCount: number
  label?: string
  onIncrement: () => void
}

export default function Counter({ initialCount, label, onIncrement }: CounterProps) {
  return <button onClick={onIncrement}>{label}: {initialCount}</button>
}
`
      )

      const result = await parseIslandFile(join(testDir, 'Counter.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.props).toContain('initialCount')
      expect(result?.props).toContain('label')
      expect(result?.props).toContain('onIncrement')
    })

    it('should extract props from generic Props interface', async () => {
      await writeFile(
        join(testDir, 'Widget.client.tsx'),
        `
export const island = true

interface Props {
  title: string
  count: number
}

export default function Widget({ title, count }: Props) {
  return <div>{title}: {count}</div>
}
`
      )

      const result = await parseIslandFile(join(testDir, 'Widget.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.props).toContain('title')
      expect(result?.props).toContain('count')
    })

    it('should extract props from type definition', async () => {
      await writeFile(
        join(testDir, 'Card.client.tsx'),
        `
export const island = true

type CardProps = {
  heading: string
  body: string
}

export default function Card({ heading, body }: CardProps) {
  return <div><h2>{heading}</h2><p>{body}</p></div>
}
`
      )

      const result = await parseIslandFile(join(testDir, 'Card.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.props).toContain('heading')
      expect(result?.props).toContain('body')
    })

    it('should extract props from function parameter destructuring', async () => {
      await writeFile(
        join(testDir, 'Simple.client.tsx'),
        `
export const island = true

export default function Simple({ message, count }) {
  return <div>{message}: {count}</div>
}
`
      )

      const result = await parseIslandFile(join(testDir, 'Simple.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.props).toContain('message')
      expect(result?.props).toContain('count')
    })

    it('should extract props from inline type annotation', async () => {
      await writeFile(
        join(testDir, 'Inline.client.tsx'),
        `
export const island = true

export default function Inline({ value }: { value: number }) {
  return <span>{value}</span>
}
`
      )

      const result = await parseIslandFile(join(testDir, 'Inline.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.props).toContain('value')
    })

    it('should return empty props when none found', async () => {
      await writeFile(
        join(testDir, 'NoProps.client.tsx'),
        `
export const island = true

export default function NoProps() {
  return <div>Static content</div>
}
`
      )

      const result = await parseIslandFile(join(testDir, 'NoProps.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.props).toEqual([])
    })

    it('should sort props alphabetically', async () => {
      await writeFile(
        join(testDir, 'Sorted.client.tsx'),
        `
export const island = true

interface SortedProps {
  zebra: string
  alpha: string
  mike: string
}

export default function Sorted({ zebra, alpha, mike }: SortedProps) {
  return <div>{alpha}{mike}{zebra}</div>
}
`
      )

      const result = await parseIslandFile(join(testDir, 'Sorted.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.props).toEqual(['alpha', 'mike', 'zebra'])
    })
  })

  describe('Load strategy parsing (improved regex)', () => {
    it('should parse load strategy when not first property', async () => {
      await writeFile(
        join(testDir, 'LoadNotFirst.client.tsx'),
        `
export const island = { preload: true, load: 'idle' }
export default function LoadNotFirst() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'LoadNotFirst.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.loadStrategy).toBe('idle')
    })

    it('should parse load strategy with multiple properties before it', async () => {
      await writeFile(
        join(testDir, 'MultiProp.client.tsx'),
        `
export const island = { debug: true, priority: 5, load: 'visible' }
export default function MultiProp() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'MultiProp.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.loadStrategy).toBe('visible')
    })

    it('should parse load strategy with properties after it', async () => {
      await writeFile(
        join(testDir, 'LoadMiddle.client.tsx'),
        `
export const island = { name: 'test', load: 'idle', priority: 1 }
export default function LoadMiddle() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'LoadMiddle.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.loadStrategy).toBe('idle')
    })

    it('should handle multi-line config with load not first', async () => {
      await writeFile(
        join(testDir, 'MultiLineConfig.client.tsx'),
        `
export const island = {
  debug: true,
  preload: false,
  load: 'visible',
}
export default function MultiLineConfig() {}
`
      )

      const result = await parseIslandFile(join(testDir, 'MultiLineConfig.client.tsx'))

      expect(result).not.toBeNull()
      expect(result?.loadStrategy).toBe('visible')
    })
  })
})
