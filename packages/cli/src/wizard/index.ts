/**
 * Wizard infrastructure for interactive CLI prompts
 * Provides wizard context, detection utilities, and preference management
 */

export { WizardContext } from './context'
export { detectInteractiveMode } from './detection'
export { UserPreferences } from './preferences'
export type {
  InteractiveMode,
  PreferencesData,
  WizardState,
  PromptConfig,
  Choice,
  CredentialStatus,
} from './types'
export { WizardCancelledError } from './types'
