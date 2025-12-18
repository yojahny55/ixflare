/**
 * Errors command - error code reference and troubleshooting
 * @packageDocumentation
 */

import { showErrorsHelp } from './help'
import { lookupErrorCode, listErrorCodes } from './lookup'

/**
 * Main handler for the `ix errors` command
 */
export async function handleErrorsCommand(): Promise<void> {
  const args = process.argv.slice(3)

  // Check for help flag
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    showErrorsHelp()
    return
  }

  // Check for list flag
  if (args.includes('--list')) {
    const categoryArg = args.find((arg) => arg.startsWith('--category='))
    const category = categoryArg?.split('=')[1]
    listErrorCodes(category)
    return
  }

  // First non-flag argument is the error code to look up
  const errorCode = args.find((arg) => !arg.startsWith('-'))

  if (errorCode) {
    lookupErrorCode(errorCode)
  } else {
    showErrorsHelp()
  }
}
