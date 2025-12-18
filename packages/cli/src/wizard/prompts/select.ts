/**
 * Select prompt wrapper
 */

import prompts from 'prompts'
import picocolors from 'picocolors'
import { WizardCancelledError } from '@/wizard/types'
import type { Choice } from '@/wizard/types'

const { yellow } = picocolors

export interface SelectPromptOptions<T> {
  /** Prompt message */
  message: string
  /** Available choices */
  choices: Choice<T>[]
  /** Initial value (will find matching index) */
  initial?: T
}

/**
 * Show select prompt
 * Returns null if cancelled or in non-interactive mode
 */
export async function selectPrompt<T>(
  options: SelectPromptOptions<T>,
  isInteractive: boolean
): Promise<T | null> {
  if (!isInteractive) {
    return null
  }

  // Find initial index if initial value provided
  let initialIndex = 0
  if (options.initial !== undefined) {
    const foundIndex = options.choices.findIndex((c) => c.value === options.initial)
    if (foundIndex >= 0) {
      initialIndex = foundIndex
    }
  }

  const response = await prompts(
    {
      type: 'select',
      name: 'value',
      message: options.message,
      choices: options.choices,
      initial: initialIndex,
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

  return response.value as T
}
