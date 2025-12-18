/**
 * Code snippet formatting with line numbers and syntax highlighting
 * @packageDocumentation
 */

import pc from 'picocolors'
import type { SourceLocation, FormatOptions } from './types'

/**
 * Format a code snippet with line numbers, highlighting the error line
 *
 * @param code - The code to format
 * @param errorLine - The line number where the error occurred (1-based)
 * @param errorColumn - The column where the error occurred (optional, 0-based)
 * @param errorLength - The length of the error span (optional, defaults to 1)
 * @param options - Formatting options
 * @returns Formatted code snippet with line numbers
 */
export function formatCodeSnippet(
  code: string,
  errorLine: number,
  errorColumn?: number,
  errorLength?: number,
  options: FormatOptions = { color: true, verbose: false, interactive: true }
): string {
  const lines = code.split('\n')
  const contextLines = 2 // Show 2 lines before and after error

  const startLine = Math.max(1, errorLine - contextLines)
  const endLine = Math.min(lines.length, errorLine + contextLines)
  const maxDigits = endLine.toString().length

  const output: string[] = []

  for (let i = startLine; i <= endLine; i++) {
    const lineNum = i.toString().padStart(maxDigits)
    const lineContent = lines[i - 1] || ''
    const isErrorLine = i === errorLine

    if (isErrorLine) {
      // Error line with red arrow
      const arrow = options.color ? pc.red('>') : '>'
      const num = options.color ? pc.dim(lineNum) : lineNum
      const content = highlightLine(lineContent, options)
      output.push(`${arrow} ${num} │ ${content}`)

      // Add error pointer if column is specified
      if (errorColumn !== undefined) {
        const spaces = ' '.repeat(maxDigits + 4 + errorColumn)
        const pointerLength = errorLength || 1
        const pointer = '^'.repeat(pointerLength)
        const styledPointer = options.color ? pc.red(pointer) : pointer
        output.push(`${spaces}${styledPointer}`)
      }
    } else {
      // Context lines
      const num = options.color ? pc.dim(lineNum) : lineNum
      const content = options.color ? pc.dim(lineContent) : lineContent
      output.push(`  ${num} │ ${content}`)
    }
  }

  return output.join('\n')
}

/**
 * Format source location with file path and line number
 */
export function formatSourceLocation(
  location: SourceLocation,
  options: FormatOptions = { color: true, verbose: false, interactive: true }
): string {
  const { file, line, column } = location
  const lines: string[] = []

  // Format file:line:column
  const locationStr = column !== undefined ? `${file}:${line}:${column}` : `${file}:${line}`
  const styledLocation = options.color ? pc.cyan(locationStr) : locationStr

  lines.push(styledLocation)

  // Show code snippet if available
  if (location.snippet) {
    lines.push('')
    const snippet = formatCodeSnippet(location.snippet, line, column, location.length, options)
    lines.push(snippet)
  }

  return lines.join('\n')
}

/**
 * Apply basic syntax highlighting to a line of code
 * Highlights common TypeScript/JavaScript tokens
 */
function highlightLine(line: string, options: FormatOptions): string {
  if (!options.color) return line

  // Simple token-based highlighting
  return line
    .replace(
      /\b(const|let|var|function|async|await|return|import|export|from|type|interface|class|extends|implements)\b/g,
      (match) => pc.magenta(match)
    )
    .replace(/\b(true|false|null|undefined)\b/g, (match) => pc.yellow(match))
    .replace(/\b(\d+)\b/g, (match) => pc.green(match))
    .replace(/(["'`])(.*?)\1/g, (match) => pc.green(match))
    .replace(/\/\/.*/g, (match) => pc.dim(match))
}

/**
 * Extract a code snippet from a file at a specific line
 * Useful for reading source files and extracting error context
 */
export function extractCodeSnippet(
  fileContent: string,
  errorLine: number,
  contextLines: number = 2
): string {
  const lines = fileContent.split('\n')
  const startLine = Math.max(0, errorLine - contextLines - 1)
  const endLine = Math.min(lines.length, errorLine + contextLines)

  return lines.slice(startLine, endLine).join('\n')
}
