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
    // Create temporary test directory
    testDir = join(tmpdir(), `ixflare-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true, maxRetries: 3 })
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn(`Failed to clean up test directory: ${testDir}`, error)
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
})
