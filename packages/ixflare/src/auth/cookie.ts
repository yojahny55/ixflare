/**
 * Cookie Utilities - Backward Compatibility Layer
 * Story 5-7: Secure Cookie Handling
 *
 * This file maintains backward compatibility with Story 5-2
 * All cookie functionality has been moved to @/auth/cookie module
 *
 * @deprecated Import from 'ixflare/auth' instead
 */

// Re-export everything from the cookie module for backward compatibility
export * from './cookie/index'
