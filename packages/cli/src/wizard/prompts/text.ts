/**
 * Text input prompt wrapper
 */

import prompts from 'prompts'
import picocolors from 'picocolors'
import { WizardCancelledError } from '@/wizard/types'

const { yellow } = picocolors

export interface TextPromptOptions {
  /** Prompt message */
  message: string
  /** Initial value */
  initial?: string
  /** Validation function */
  validate?: (value: string) => boolean | string
}

/**
 * Show text input prompt
 * Returns null if cancelled or in non-interactive mode
 */
export async function textPrompt(
  options: TextPromptOptions,
  isInteractive: boolean
): Promise<string | null> {
  if (!isInteractive) {
    return null
  }

  const response = await prompts(
    {
      type: 'text',
      name: 'value',
      message: options.message,
      initial: options.initial,
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
