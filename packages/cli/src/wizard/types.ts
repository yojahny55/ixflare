/**
 * Type definitions for wizard infrastructure
 * Interactive CLI wizard system for Ixflare commands
 */

/**
 * Interactive mode detection result
 */
export interface InteractiveMode {
  /** Can prompt user for input */
  isInteractive: boolean
  /** Has TTY attached to stdout/stdin */
  isTTY: boolean
  /** Running in CI environment */
  isCI: boolean
  /** Reason for non-interactive mode (if applicable) */
  reason?: string
}

/**
 * User preference data structure
 */
export interface PreferencesData {
  /** Preferred package manager */
  packageManager?: 'npm' | 'pnpm' | 'bun'
  /** Last used template */
  lastTemplate?: string
  /** Cloudflare account ID (optional, non-sensitive) */
  cloudflareAccountId?: string
  /** Last updated timestamp (Unix ms) */
  updatedAt: number
}

/**
 * Wizard state for context management
 * Note: preferences type will be resolved at runtime to avoid circular dependency
 */
export interface WizardState {
  /** Is interactive mode enabled */
  isInteractive: boolean
  /** Has TTY attached */
  isTTY: boolean
  /** Running in CI */
  isCI: boolean
  /** User preferences loaded from disk (UserPreferences instance) */
  preferences: unknown
}

/**
 * Prompt configuration for wizard
 */
export interface PromptConfig<T = string> {
  /** Prompt type */
  type: string
  /** Field name for response */
  name: string
  /** Prompt message */
  message: string
  /** Validation function */
  validate?: (value: T) => boolean | string
  /** Initial/default value */
  initial?: T
  /** Choices for select prompts */
  choices?: Array<{ title: string; value: T }>
}

/**
 * Choice option for select prompts
 */
export interface Choice<T = string> {
  /** Display title */
  title: string
  /** Returned value */
  value: T
  /** Optional description */
  description?: string
}

/**
 * Custom error for wizard cancellation
 */
export class WizardCancelledError extends Error {
  constructor(message = 'Operation cancelled by user') {
    super(message)
    this.name = 'WizardCancelledError'
  }
}

/**
 * Credential status for first-time deploy detection
 */
export interface CredentialStatus {
  /** Has Cloudflare credentials configured */
  hasCredentials: boolean
  /** Source of credentials */
  source?: 'env' | 'wrangler' | 'config'
  /** Cloudflare account ID if available */
  accountId?: string
}
