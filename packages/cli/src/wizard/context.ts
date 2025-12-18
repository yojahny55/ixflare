/**
 * Wizard context for state management
 * Manages interactive/non-interactive mode and user preferences
 */

import prompts, { type PromptObject, type Answers } from 'prompts'
import type { WizardState, Choice, UserPreferencesInterface } from './types'
import { WizardCancelledError } from './types'
import { detectInteractiveMode } from './detection'
import { UserPreferences } from './preferences'
import picocolors from 'picocolors'

const { yellow } = picocolors

/**
 * Wizard context class
 * Encapsulates wizard state and provides prompt methods
 */
export class WizardContext {
  private state: WizardState

  private constructor(state: WizardState) {
    this.state = state
  }

  /**
   * Create a new wizard context
   * Detects interactive mode and loads user preferences
   *
   * @param args - Command line arguments
   * @returns WizardContext instance
   */
  static async create(args: string[]): Promise<WizardContext> {
    const mode = detectInteractiveMode(args)
    const preferences = await UserPreferences.load()

    const state: WizardState = {
      isInteractive: mode.isInteractive,
      isTTY: mode.isTTY,
      isCI: mode.isCI,
      preferences,
    }

    return new WizardContext(state)
  }

  /**
   * Is wizard running in interactive mode
   */
  get isInteractive(): boolean {
    return this.state.isInteractive
  }

  /**
   * Is TTY attached
   */
  get isTTY(): boolean {
    return this.state.isTTY
  }

  /**
   * Is running in CI environment
   */
  get isCI(): boolean {
    return this.state.isCI
  }

  /**
   * Get user preferences
   */
  get preferences(): UserPreferencesInterface | null {
    return this.state.preferences
  }

  /**
   * Generic prompt wrapper
   * Returns null in non-interactive mode
   *
   * @param config - Prompt configuration
   * @returns Prompt response or null
   */
  async prompt<T>(config: {
    type: string
    name: string
    message: string
    initial?: T | number
    validate?: (value: T) => boolean | string
    choices?: Array<{ title: string; value: T; description?: string }>
  }): Promise<T | null> {
    if (!this.isInteractive) {
      return null
    }

    // Build prompts-compatible configuration
    const promptConfig: PromptObject<string> = {
      type: config.type as PromptObject['type'],
      name: config.name,
      message: config.message,
      initial: config.initial as PromptObject['initial'],
      validate: config.validate as PromptObject['validate'],
      choices: config.choices as PromptObject['choices'],
    }

    const response: Answers<string> = await prompts(promptConfig, {
      onCancel: () => {
        console.log(yellow('\nOperation cancelled'))
        // Throw error to be caught by wizard flow
        throw new WizardCancelledError()
      },
    })

    // Check if response contains the expected field
    if (!(config.name in response)) {
      throw new WizardCancelledError()
    }

    return response[config.name] as T
  }

  /**
   * Show confirmation prompt
   *
   * @param message - Confirmation message
   * @param defaultValue - Default value in non-interactive mode
   * @returns User confirmation
   */
  async confirm(message: string, defaultValue = false): Promise<boolean> {
    if (!this.isInteractive) {
      return defaultValue
    }

    const result = await this.prompt<boolean>({
      type: 'confirm',
      name: 'confirmed',
      message,
      initial: defaultValue,
    })

    return result ?? false
  }

  /**
   * Show select prompt
   *
   * @param message - Prompt message
   * @param choices - Available choices
   * @param options - Additional options (initial value, etc.)
   * @returns Selected value or null
   */
  async select<T>(
    message: string,
    choices: Choice<T>[],
    options?: { initial?: T }
  ): Promise<T | null> {
    if (!this.isInteractive) {
      return null
    }

    // Find initial index if initial value provided
    let initialIndex = 0
    if (options?.initial !== undefined) {
      const foundIndex = choices.findIndex((c) => c.value === options.initial)
      if (foundIndex >= 0) {
        initialIndex = foundIndex
      }
    }

    const result = await this.prompt<T>({
      type: 'select',
      name: 'selected',
      message,
      choices,
      initial: initialIndex as T,
    })

    return result
  }

  /**
   * Prompt for text input
   *
   * @param message - Prompt message
   * @param options - Text input options
   * @returns User input or null
   */
  async text(
    message: string,
    options?: {
      initial?: string
      validate?: (value: string) => boolean | string
    }
  ): Promise<string | null> {
    if (!this.isInteractive) {
      return null
    }

    return this.prompt<string>({
      type: 'text',
      name: 'input',
      message,
      initial: options?.initial,
      validate: options?.validate,
    })
  }

  /**
   * Prompt for password (masked input)
   *
   * @param message - Prompt message
   * @param options - Password input options
   * @returns Password input or null
   */
  async password(
    message: string,
    options?: {
      validate?: (value: string) => boolean | string
    }
  ): Promise<string | null> {
    if (!this.isInteractive) {
      return null
    }

    return this.prompt<string>({
      type: 'password',
      name: 'password',
      message,
      validate: options?.validate,
    })
  }

  /**
   * Save a preference value
   *
   * @param key - Preference key
   * @param value - Preference value
   */
  async savePreference(
    key: 'packageManager' | 'lastTemplate' | 'cloudflareAccountId',
    value: string
  ): Promise<void> {
    const prefs = this.preferences
    if (!prefs) {
      return
    }

    if (key === 'packageManager' && (value === 'npm' || value === 'pnpm' || value === 'bun')) {
      prefs.setPackageManager(value)
    } else if (key === 'lastTemplate') {
      prefs.setLastTemplate(value)
    } else if (key === 'cloudflareAccountId') {
      prefs.setCloudflareAccountId(value)
    }

    await prefs.persist()
  }
}
