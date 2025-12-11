/**
 * @module bundle-size.test
 * @description Unit tests for bundle size validation and reporting
 */

import { describe, it, expect } from 'vitest'
import type { OutputBundle, OutputChunk } from 'rollup'
import { validateChunkSizes } from '../src/build'

/**
 * Helper to create a mock chunk
 */
function createMockChunk(fileName: string, codeSize: number): [string, OutputChunk] {
  return [
    fileName,
    {
      type: 'chunk',
      code: 'x'.repeat(codeSize), // Generate code of specified size
      fileName,
      name: fileName.replace(/\.\w+$/, ''),
      facadeModuleId: null,
      isDynamicEntry: false,
      isEntry: false,
      isImplicitEntry: false,
      moduleIds: [],
      exports: [],
      imports: [],
      dynamicImports: [],
      modules: {},
      map: null,
      sourcemapFileName: null,
      preliminaryFileName: fileName,
      referencedFiles: [],
      implicitlyLoadedBefore: [],
      importedBindings: {},
    },
  ]
}

describe('validateChunkSizes', () => {
  it('should validate route chunks within budget', () => {
    const bundle: OutputBundle = Object.fromEntries([
      createMockChunk('chunks/route-index-abc123.js', 8 * 1024), // 8KB - under budget
      createMockChunk('chunks/route-about-def456.js', 5 * 1024), // 5KB - under budget
    ])

    const report = validateChunkSizes(bundle)

    expect(report.chunks.length).toBe(2)
    expect(report.budgetExceeded).toBe(false)
    expect(report.warningCount).toBe(0)
    expect(report.breakdown.routeChunks).toBe(2)
  })

  it('should warn when route chunk exceeds 10KB budget', () => {
    const bundle: OutputBundle = Object.fromEntries([
      createMockChunk('chunks/route-index-abc123.js', 8 * 1024), // 8KB - OK
      createMockChunk('chunks/route-large-def456.js', 15 * 1024), // 15KB - exceeds budget!
    ])

    const report = validateChunkSizes(bundle)

    expect(report.budgetExceeded).toBe(true)
    expect(report.warningCount).toBe(1)

    const largeChunk = report.chunks.find((c) => c.name.includes('route-large'))
    expect(largeChunk).toBeDefined()
    expect(largeChunk!.warning).toBe(true)
    expect(largeChunk!.type).toBe('route')
  })

  it('should validate vendor chunks within budget', () => {
    const bundle: OutputBundle = Object.fromEntries([
      createMockChunk('chunks/vendor-abc123.js', 25 * 1024), // 25KB - under 30KB budget
      createMockChunk('chunks/react-vendor-def456.js', 28 * 1024), // 28KB - under budget
    ])

    const report = validateChunkSizes(bundle)

    expect(report.budgetExceeded).toBe(false)
    expect(report.breakdown.vendorChunks).toBe(2)
  })

  it('should warn when vendor chunk exceeds 30KB budget', () => {
    const bundle: OutputBundle = Object.fromEntries([
      createMockChunk('chunks/vendor-abc123.js', 35 * 1024), // 35KB - exceeds budget!
    ])

    const report = validateChunkSizes(bundle)

    expect(report.budgetExceeded).toBe(true)
    expect(report.warningCount).toBe(1)

    const vendorChunk = report.chunks.find((c) => c.name.includes('vendor'))
    expect(vendorChunk).toBeDefined()
    expect(vendorChunk!.warning).toBe(true)
    expect(vendorChunk!.type).toBe('vendor')
  })

  it('should not warn for other chunks (no budget)', () => {
    const bundle: OutputBundle = Object.fromEntries([
      createMockChunk('entries/main-abc123.js', 20 * 1024), // 20KB - no budget
      createMockChunk('chunks/framework-def456.js', 50 * 1024), // 50KB - no budget
    ])

    const report = validateChunkSizes(bundle)

    expect(report.budgetExceeded).toBe(false)
    expect(report.warningCount).toBe(0)
    expect(report.breakdown.otherChunks).toBe(2)

    for (const chunk of report.chunks) {
      expect(chunk.warning).toBe(false)
      expect(chunk.type).toBe('other')
    }
  })

  it('should calculate total bundle size correctly', () => {
    const bundle: OutputBundle = Object.fromEntries([
      createMockChunk('chunks/route-index-abc123.js', 8 * 1024), // 8KB
      createMockChunk('chunks/vendor-def456.js', 25 * 1024), // 25KB
      createMockChunk('entries/main-ghi789.js', 10 * 1024), // 10KB
    ])

    const report = validateChunkSizes(bundle)

    // Total should be 8 + 25 + 10 = 43KB
    expect(report.totalSize).toBe(43 * 1024)
    expect(report.totalSizeKB).toBe('43.00 KB')
  })

  it('should format size in KB with 2 decimals', () => {
    const bundle: OutputBundle = Object.fromEntries([
      createMockChunk('chunks/route-index-abc123.js', 1536), // 1.5KB
    ])

    const report = validateChunkSizes(bundle)

    expect(report.chunks[0].sizeKB).toBe('1.50 KB')
  })

  it('should categorize chunks correctly', () => {
    const bundle: OutputBundle = Object.fromEntries([
      createMockChunk('chunks/route-index-abc123.js', 5 * 1024),
      createMockChunk('chunks/route-about-def456.js', 6 * 1024),
      createMockChunk('chunks/vendor-ghi789.js', 20 * 1024),
      createMockChunk('chunks/react-vendor-jkl012.js', 25 * 1024),
      createMockChunk('entries/main-mno345.js', 10 * 1024),
      createMockChunk('chunks/framework-pqr678.js', 15 * 1024),
    ])

    const report = validateChunkSizes(bundle)

    expect(report.breakdown.routeChunks).toBe(2)
    expect(report.breakdown.vendorChunks).toBe(2)
    expect(report.breakdown.otherChunks).toBe(2)
    expect(report.chunks.length).toBe(6)
  })

  it('should handle empty bundle', () => {
    const bundle: OutputBundle = {}

    const report = validateChunkSizes(bundle)

    expect(report.chunks.length).toBe(0)
    expect(report.totalSize).toBe(0)
    expect(report.budgetExceeded).toBe(false)
    expect(report.warningCount).toBe(0)
  })

  it('should ignore non-chunk assets', () => {
    const bundle: OutputBundle = {
      'assets/style.css': {
        type: 'asset',
        fileName: 'assets/style.css',
        name: 'style.css',
        source: 'body { margin: 0; }',
        needsCodeReference: false,
      },
      ...Object.fromEntries([createMockChunk('chunks/route-index-abc123.js', 5 * 1024)]),
    }

    const report = validateChunkSizes(bundle)

    // Should only analyze the chunk, not the asset
    expect(report.chunks.length).toBe(1)
    expect(report.chunks[0].type).toBe('route')
  })

  it('should count multiple budget violations', () => {
    const bundle: OutputBundle = Object.fromEntries([
      createMockChunk('chunks/route-large1-abc123.js', 15 * 1024), // Exceeds 10KB
      createMockChunk('chunks/route-large2-def456.js', 20 * 1024), // Exceeds 10KB
      createMockChunk('chunks/vendor-large-ghi789.js', 35 * 1024), // Exceeds 30KB
    ])

    const report = validateChunkSizes(bundle)

    expect(report.budgetExceeded).toBe(true)
    expect(report.warningCount).toBe(3)

    const warningChunks = report.chunks.filter((c) => c.warning)
    expect(warningChunks.length).toBe(3)
  })

  it('should handle mixed scenario: some pass, some fail', () => {
    const bundle: OutputBundle = Object.fromEntries([
      createMockChunk('chunks/route-small-abc123.js', 5 * 1024), // OK
      createMockChunk('chunks/route-large-def456.js', 15 * 1024), // FAIL
      createMockChunk('chunks/vendor-ok-ghi789.js', 25 * 1024), // OK
      createMockChunk('chunks/vendor-large-jkl012.js', 35 * 1024), // FAIL
      createMockChunk('entries/main-mno345.js', 50 * 1024), // OK (no budget)
    ])

    const report = validateChunkSizes(bundle)

    expect(report.budgetExceeded).toBe(true)
    expect(report.warningCount).toBe(2)

    const passedChunks = report.chunks.filter((c) => !c.warning)
    const failedChunks = report.chunks.filter((c) => c.warning)

    expect(passedChunks.length).toBe(3)
    expect(failedChunks.length).toBe(2)
  })
})
