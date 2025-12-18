/**
 * Password prompt wrapper (masked input)
 */

import prompts from 'prompts'
import picocolors from 'picocolors'
import { WizardCancelledError } from '@/wizard/types'

const { yellow } = picocolors

export interface PasswordPromptOptions {
  /** Prompt message */
  message: string
  /** Validation function */
  validate?: (value: string) => boolean | string
}

/**
 * Show password prompt with masked input
 * Returns null if cancelled or in non-interactive mode
 */
export async function passwordPrompt(
  options: PasswordPromptOptions,
  isInteractive: boolean
): Promise<string | null> {
  if (!isInteractive) {
    return null
  }

  const response = await prompts(
    {
      type: 'password',
      name: 'value',
      message: options.message,
      validate: options.validate,
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
