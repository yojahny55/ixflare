/**
 * Tests for code snippet formatting
 */

import { describe, it, expect } from 'vitest'
import { formatCodeSnippet, extractCodeSnippet, formatSourceLocation } from '@/errors/code-snippet'
import type { FormatOptions } from '@/errors/types'

describe('formatCodeSnippet', () => {
  const defaultOptions: FormatOptions = {
    color: false,
    verbose: false,
    interactive: false,
  }

  const sampleCode = `const config = {
  algorithm: "RS256",
  expiry: 900,
}`

  it('should format code with line numbers', () => {
    const output = formatCodeSnippet(sampleCode, 2, undefined, undefined, defaultOptions)

    expect(output).toContain('1 │')
    expect(output).toContain('2 │')
    expect(output).toContain('3 │')
    expect(output).toContain('const config')
    expect(output).toContain('algorithm')
  })

  it('should highlight error line with arrow', () => {
    const output = formatCodeSnippet(sampleCode, 2, undefined, undefined, defaultOptions)

    // Error line should have a '>' marker
    expect(output).toMatch(/>\s*2\s*│/)
  })

  it('should show error pointer at correct column', () => {
    const output = formatCodeSnippet(sampleCode, 2, 14, 6, defaultOptions)

    // Should show pointer (^) at the error location
    expect(output).toContain('^'.repeat(6))
  })

  it('should limit context to 2 lines before and after', () => {
    const longCode = Array(20)
      .fill(0)
      .map((_, i) => `line ${i + 1}`)
      .join('\n')

    const output = formatCodeSnippet(longCode, 10, undefined, undefined, defaultOptions)

    // Should show lines 8-12 (2 before, error line, 2 after)
    expect(output).toContain('line 8')
    expect(output).toContain('line 10')
    expect(output).toContain('line 12')
    expect(output).not.toContain('line 6')
    expect(output).not.toContain('line 14')
  })

  it('should handle first line error', () => {
    const output = formatCodeSnippet(sampleCode, 1, undefined, undefined, defaultOptions)

    expect(output).toContain('> 1 │')
    expect(output).not.toContain('-1 │') // Shouldn't show negative line numbers
  })

  it('should handle last line error', () => {
    const output = formatCodeSnippet(sampleCode, 4, undefined, undefined, defaultOptions)

    expect(output).toContain('> 4 │')
    // Shouldn't error or show beyond file length
  })

  it('should pad line numbers consistently', () => {
    const longCode = Array(100)
      .fill(0)
      .map((_, i) => `line ${i + 1}`)
      .join('\n')

    const output = formatCodeSnippet(longCode, 50, undefined, undefined, defaultOptions)

    // Line numbers should be padded to same width
    expect(output).toMatch(/\s+48\s*│/)
    expect(output).toMatch(/\s+50\s*│/)
    expect(output).toMatch(/\s+52\s*│/)
  })
})

describe('extractCodeSnippet', () => {
  const fileContent = `line 1
line 2
line 3
line 4
line 5
line 6
line 7`

  it('should extract snippet with context', () => {
    const snippet = extractCodeSnippet(fileContent, 4, 2)

    expect(snippet).toContain('line 2')
    expect(snippet).toContain('line 4')
    expect(snippet).toContain('line 6')
    expect(snippet).not.toContain('line 1')
    expect(snippet).not.toContain('line 7')
  })

  it('should handle start of file', () => {
    const snippet = extractCodeSnippet(fileContent, 1, 2)

    expect(snippet).toContain('line 1')
    expect(snippet).toContain('line 3')
    expect(snippet).not.toContain('line 4')
  })

  it('should handle end of file', () => {
    const snippet = extractCodeSnippet(fileContent, 7, 2)

    expect(snippet).toContain('line 5')
    expect(snippet).toContain('line 7')
    expect(snippet).not.toContain('line 4')
  })
})

describe('formatSourceLocation', () => {
  const defaultOptions: FormatOptions = {
    color: false,
    verbose: false,
    interactive: false,
  }

  it('should format location with file and line', () => {
    const output = formatSourceLocation(
      {
        file: 'edge.config.ts',
        line: 10,
      },
      defaultOptions
    )

    expect(output).toContain('edge.config.ts:10')
  })

  it('should format location with column', () => {
    const output = formatSourceLocation(
      {
        file: 'edge.config.ts',
        line: 10,
        column: 5,
      },
      defaultOptions
    )

    expect(output).toContain('edge.config.ts:10:5')
  })

  it('should include code snippet when provided', () => {
    const output = formatSourceLocation(
      {
        file: 'edge.config.ts',
        line: 2,
        snippet: `const config = {
  algorithm: "RS256",
}`,
      },
      defaultOptions
    )

    expect(output).toContain('edge.config.ts:2')
    expect(output).toContain('algorithm')
    expect(output).toContain('RS256')
  })

  it('should show error pointer when column and length provided', () => {
    const output = formatSourceLocation(
      {
        file: 'edge.config.ts',
        line: 2,
        column: 14,
        length: 6,
        snippet: `const config = {
  algorithm: "RS256",
}`,
      },
      defaultOptions
    )

    expect(output).toContain('^'.repeat(6))
  })
})
