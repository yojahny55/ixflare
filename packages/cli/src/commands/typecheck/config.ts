import * as ts from 'typescript'
import * as path from 'node:path'
import { CLIError } from '@/errors/cli-error.js'

/**
 * Find tsconfig.json starting from the given directory and searching upward.
 * Uses TypeScript's built-in config file search algorithm.
 *
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns Path to tsconfig.json if found
 * @throws CLIError if no tsconfig.json found
 */
export function findTsConfig(startDir: string = process.cwd()): string {
  const configPath = ts.findConfigFile(startDir, ts.sys.fileExists, 'tsconfig.json')

  if (!configPath) {
    throw new CLIError({
      code: 'CONFIG.NOT_FOUND',
      message: 'No tsconfig.json found. Run this command from a TypeScript project directory.',
      causes: ['Not in a TypeScript project directory', 'tsconfig.json is missing'],
      fixes: [
        'Ensure you are in the root of a TypeScript project',
        'Create a tsconfig.json file if missing',
      ],
    })
  }

  return configPath
}

/**
 * Load and parse tsconfig.json file.
 *
 * @param configPath - Path to tsconfig.json
 * @returns Parsed TypeScript configuration with file names and compiler options
 * @throws CLIError if config file cannot be read or parsed
 */
export function loadTsConfig(configPath: string): ts.ParsedCommandLine {
  // Read the config file
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

  if (configFile.error) {
    const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')
    throw new CLIError({
      code: 'CONFIG.INVALID',
      message: `Error reading tsconfig.json: ${message}`,
      causes: ['tsconfig.json file cannot be read', 'File may be corrupted or have invalid JSON'],
      fixes: ['Check tsconfig.json for syntax errors', 'Validate JSON syntax using a linter'],
    })
  }

  // Parse the JSON config file content
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath))

  if (parsed.errors.length > 0) {
    const message = ts.formatDiagnostics(parsed.errors, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (fileName) => fileName,
      getNewLine: () => '\n',
    })
    throw new CLIError({
      code: 'CONFIG.INVALID',
      message: `Invalid tsconfig.json:\n${message}`,
      causes: ['tsconfig.json has configuration errors', 'Invalid compiler options'],
      fixes: [
        'Fix the errors shown above in your tsconfig.json',
        'Refer to TypeScript documentation for valid options',
      ],
    })
  }

  return parsed
}
