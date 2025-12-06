/**
 * @fileoverview Enforce environment boundaries between @node-only and @worker-only code
 * @node-only
 */

import type { Rule } from 'eslint'
import type { Node, ImportDeclaration } from 'estree'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Read file content and extract environment tag from JSDoc comments
 */
function getFileEnvironmentTag(filename: string): string | null {
  try {
    const content = fs.readFileSync(filename, 'utf-8')

    // Match JSDoc comments at the top of the file
    const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\//)
    if (jsdocMatch) {
      const jsdoc = jsdocMatch[0]
      if (jsdoc.includes('@node-only')) return 'node-only'
      if (jsdoc.includes('@worker-only')) return 'worker-only'
      if (jsdoc.includes('@universal')) return 'universal'
    }

    // Also check single-line comments
    const lineCommentMatch = content.match(/\/\/.*@(node-only|worker-only|universal)/)
    if (lineCommentMatch) {
      return lineCommentMatch[1]
    }
  } catch {
    // File doesn't exist or can't be read
    return null
  }

  return null
}

/**
 * Resolve import path to absolute file path
 */
function resolveImportPath(importPath: string, currentFile: string): string | null {
  // Skip external packages (not relative imports)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null
  }

  try {
    const dir = path.dirname(currentFile)
    const resolved = path.resolve(dir, importPath)

    // Try common extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx']

    for (const ext of extensions) {
      const fullPath = resolved + ext
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }

    // Try index files
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const indexPath = path.join(resolved, `index${ext}`)
      if (fs.existsSync(indexPath)) {
        return indexPath
      }
    }
  } catch {
    return null
  }

  return null
}

export const environmentBoundaries: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce environment boundaries between @node-only and @worker-only code',
      category: 'Possible Errors',
      recommended: true,
    },
    messages: {
      nodeInWorker: 'Cannot import @node-only module "{{module}}" in @worker-only context. Node.js APIs are not available in Cloudflare Workers.',
      workerInNode: 'Cannot import @worker-only module "{{module}}" in @node-only context.',
    },
    schema: [],
  },

  create(context): Rule.RuleListener {
    const filename = context.getFilename()

    // Get the environment tag for the current file
    const currentEnv = getFileEnvironmentTag(filename)

    // Skip if current file is universal or has no tag
    if (!currentEnv || currentEnv === 'universal') {
      return {}
    }

    return {
      ImportDeclaration(node: Node) {
        const importNode = node as unknown as ImportDeclaration
        const importPath = importNode.source.value as string

        // Resolve the imported file path
        const resolvedPath = resolveImportPath(importPath, filename)
        if (!resolvedPath) {
          return // External package or couldn't resolve
        }

        // Get the environment tag of the imported file
        const importedEnv = getFileEnvironmentTag(resolvedPath)

        // Skip if imported file is universal or has no tag
        if (!importedEnv || importedEnv === 'universal') {
          return
        }

        // Check for violations
        if (currentEnv === 'worker-only' && importedEnv === 'node-only') {
          context.report({
            node: importNode.source,
            messageId: 'nodeInWorker',
            data: {
              module: importPath,
            },
          })
        } else if (currentEnv === 'node-only' && importedEnv === 'worker-only') {
          context.report({
            node: importNode.source,
            messageId: 'workerInNode',
            data: {
              module: importPath,
            },
          })
        }
      },
    }
  },
}
