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
 * @returns The accumulated layout data from all parent layouts
 *
 * @example
 * ```typescript
 * function SettingsPage() {
 *   const { theme, user, dashboard } = useLayoutData<{
 *     theme: Theme
 *     user: User
 *     dashboard: Dashboard
 *   }>()
 *
 *   return <div>User: {user.name}</div>
 * }
 * ```
 */
export function useLayoutData<T = Record<string, unknown>>(): T {
  return useContext(LayoutContext) as T
}

/**
 * Provider component for layout context
 * Internal use only - used by layout renderer
 *
 * @internal
 */
export const LayoutContextProvider = LayoutContext.Provider
