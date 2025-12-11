/**
 * @module ssr/streaming-error-handler
 * @description Streaming error classification and recovery for SSR
 * @packageDocumentation
 */

import { AppError, InfraError } from '@/errors'
import { escapeHtml } from './html-utils'

/**
 * SSR error types for classification
 */
export type SSRErrorType =
  | 'shell' // Critical - entire page failed to render
  | 'boundary' // Recoverable - Suspense boundary failed during streaming
  | 'app' // User code error
  | 'infra' // Framework/runtime error

/**
 * SSR error information with request context
 */
export interface SSRErrorInfo {
  /** Error type classification */
  type: SSRErrorType
  /** The error that occurred */
  error: Error
  /** React component stack trace */
  componentStack?: string
  /** Ray ID for distributed tracing */
  rayId?: string
  /** Request path */
  path?: string
  /** Timestamp when error occurred */
  timestamp: number
}

/**
 * Classifies an SSR error based on its type and context.
 *
 * Error classification determines how the framework handles the error:
 * - Shell errors: Reject Promise, return fallback HTML (critical failure)
 * - Infrastructure errors: Framework/runtime issues (InfraError instances)
 * - App errors: User code errors (AppError and subclasses)
 * - Boundary errors: Continue streaming with fallback (recoverable, generic errors)
 *
 * @param error - The error to classify
 * @param isShell - Whether this error occurred during shell rendering
 * @returns The error type classification
 *
 * @example
 * ```typescript
 * // Shell error - critical failure
 * const errorType = classifySSRError(error, true)
 * // Returns: 'shell'
 *
 * // Infrastructure error
 * const infraError = new InfraError('SSR_FAILED', 'Render failed')
 * const errorType = classifySSRError(infraError, false)
 * // Returns: 'infra'
 *
 * // App error - user code error
 * const appError = new ValidationError('INVALID_INPUT', 'Bad data')
 * const errorType = classifySSRError(appError, false)
 * // Returns: 'app'
 *
 * // Boundary error - recoverable generic error
 * const errorType = classifySSRError(new Error('Component failed'), false)
 * // Returns: 'boundary'
 * ```
 */
export function classifySSRError(error: Error, isShell: boolean): SSRErrorType {
  if (isShell) {
    return 'shell'
  }

  if (error instanceof InfraError) {
    return 'infra'
  }

  // AppError and subclasses (ValidationError, AuthError, etc.) are user code errors
  // Check AppError after InfraError since InfraError extends AppError
  if (error instanceof AppError) {
    return 'app'
  }

  // Generic errors during streaming are boundary errors
  // These can be recovered by showing fallback content
  return 'boundary'
}

/**
 * Generates a client notification script for boundary errors.
 *
 * When a Suspense boundary error occurs after streaming has started,
 * this script notifies the client so it can handle the error appropriately
 * (e.g., show error UI, retry loading, log to analytics).
 *
 * The script is safe to inject into HTML - all values are properly escaped
 * to prevent XSS attacks.
 *
 * @param error - The error that occurred
 * @param boundaryId - Unique ID for the boundary that failed
 * @returns HTML script tag with error notification
 *
 * @example
 * ```typescript
 * const script = generateErrorNotificationScript(
 *   new Error('Failed to load data'),
 *   'suspense-boundary-1'
 * )
 * // Returns: <script>window.__SSR_BOUNDARY_ERRORS__=...</script>
 * ```
 */
export function generateErrorNotificationScript(error: Error, boundaryId: string): string {
  const safeMessage = escapeHtml(error.message)
  const safeBoundaryId = escapeHtml(boundaryId)

  // Initialize global error array if not exists, then push error info
  return `<script>window.__SSR_BOUNDARY_ERRORS__=window.__SSR_BOUNDARY_ERRORS__||[];window.__SSR_BOUNDARY_ERRORS__.push({id:"${safeBoundaryId}",message:"${safeMessage}",timestamp:${Date.now()}});</script>`
}

/**
 * Creates an SSRErrorInfo object with request context.
 *
 * Enriches error information with metadata needed for logging,
 * debugging, and distributed tracing.
 *
 * @param error - The error that occurred
 * @param type - Error type classification
 * @param context - Optional request context
 * @returns Enriched error information object
 *
 * @example
 * ```typescript
 * const errorInfo = createSSRErrorInfo(
 *   new Error('Render failed'),
 *   'boundary',
 *   { rayId: 'abc123', path: '/dashboard', componentStack: '...' }
 * )
 * // Returns: { type: 'boundary', error, rayId, path, timestamp, ... }
 * ```
 */
export function createSSRErrorInfo(
  error: Error,
  type: SSRErrorType,
  context?: {
    rayId?: string
    path?: string
    componentStack?: string
  }
): SSRErrorInfo {
  return {
    type,
    error,
    componentStack: context?.componentStack,
    rayId: context?.rayId,
    path: context?.path,
    timestamp: Date.now(),
  }
}

/**
 * Logs an SSR error with request context.
 *
 * Formats and logs error information for debugging and monitoring.
 * Uses structured logging format for easy parsing in log aggregation tools.
 *
 * @param errorInfo - Enriched error information
 *
 * @example
 * ```typescript
 * logSSRError({
 *   type: 'boundary',
 *   error: new Error('Component failed'),
 *   rayId: 'abc123',
 *   path: '/dashboard',
 *   timestamp: Date.now()
 * })
 * // Logs: [SSR Error] boundary | /dashboard | rayId=abc123 | Component failed
 * ```
 */
export function logSSRError(errorInfo: SSRErrorInfo): void {
  const { type, error, rayId, path, componentStack } = errorInfo

  const logData = {
    type,
    message: error.message,
    rayId,
    path,
    timestamp: errorInfo.timestamp,
    ...(componentStack && { componentStack }),
  }

  console.error(`[SSR Error] ${type}`, logData)
}
