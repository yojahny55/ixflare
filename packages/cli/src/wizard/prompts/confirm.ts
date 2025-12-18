/**
 * Confirm prompt wrapper
 */

import prompts from 'prompts'
import picocolors from 'picocolors'
import { WizardCancelledError } from '@/wizard/types'

const { yellow } = picocolors

export interface ConfirmPromptOptions {
  /** Prompt message */
  message: string
  /** Initial/default value */
  initial?: boolean
}

/**
 * Show confirmation prompt
 * Returns default value in non-interactive mode
 */
export async function confirmPrompt(
  options: ConfirmPromptOptions,
  isInteractive: boolean
): Promise<boolean> {
  if (!isInteractive) {
    return options.initial ?? false
  }

  const response = await prompts(
    {
      type: 'confirm',
      name: 'value',
      message: options.message,
      initial: options.initial ?? false,
    },
    {
      onCancel: () => {
        console.log(yellow('\nOperation cancelled'))
        throw new WizardCancelledError()
      },
    }
  )

  if (!('value' in response)) {
    throw new WizardCancelledError()
  }

  return response.value
}
