/**
 * Wizard infrastructure for interactive CLI prompts
 * Provides wizard context, detection utilities, preference management, and flows
 */

// Core infrastructure
export { WizardContext } from './context'
export { detectInteractiveMode } from './detection'
export { UserPreferences } from './preferences'

// Types
export type {
  InteractiveMode,
  PreferencesData,
  WizardState,
  PromptConfig,
  Choice,
  CredentialStatus,
  UserPreferencesInterface,
} from './types'
export { WizardCancelledError } from './types'

// Typed prompt wrappers
export * from './prompts'

// Wizard flows
export * from './flows'
