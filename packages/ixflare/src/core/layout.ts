/**
 * @module core/layout
 * @description Layout context and data sharing utilities
 * @worker-only
 */

import { createContext, useContext } from 'react'

/**
 * Context for sharing layout data with child components
 * Layout data accumulates as you go deeper in the layout hierarchy
 */
const LayoutContext = createContext<Record<string, unknown>>({})

/**
 * Hook to access layout data from parent layouts
 *
 * @template T - Type of the layout data object
 * @param requiredKeys - Optional array of keys that must be present in the data
 * @returns The accumulated layout data from all parent layouts
 * @throws Error if requiredKeys are specified and any key is missing (dev mode only)
 *
 * @example
 * ```typescript
 * // Basic usage - type-safe access
 * function SettingsPage() {
 *   const { theme, user, dashboard } = useLayoutData<{
 *     theme: Theme
 *     user: User
 *     dashboard: Dashboard
 *   }>()
 *
 *   return <div>User: {user.name}</div>
 * }
 *
 * // With runtime validation (development)
 * function ProfilePage() {
 *   const data = useLayoutData<{ user: User }>(['user'])
 *   // Throws in dev if 'user' key is missing from parent layouts
 *   return <div>User: {data.user.name}</div>
 * }
 * ```
 */
export function useLayoutData<T = Record<string, unknown>>(requiredKeys?: (keyof T)[]): T {
  const data = useContext(LayoutContext) as T

  // Runtime validation in development mode
  if (requiredKeys && requiredKeys.length > 0 && process.env.NODE_ENV !== 'production') {
    const missingKeys = requiredKeys.filter((key) => !(key in (data as Record<string, unknown>)))
    if (missingKeys.length > 0) {
      console.warn(
        `[useLayoutData] Missing expected keys from layout context: ${missingKeys.join(', ')}. ` +
          `Ensure parent layouts provide these values via their loaders.`
      )
    }
  }

  return data
}

/**
 * Provider component for layout context
 * Used internally by the layout renderer to provide accumulated layout data.
 *
 * @internal - Not intended for direct use by application code
 */
export const LayoutContextProvider = LayoutContext.Provider
