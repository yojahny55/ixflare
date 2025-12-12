/**
 * Session Management Type Definitions
 * Story 5-2: Session Management
 */

/**
 * Session configuration options
 */
export interface SessionConfig {
  /** Session strategy: jwt (stateless), database (stateful), or hybrid (JWT + KV revocation) */
  strategy: 'jwt' | 'database' | 'hybrid'

  /** Cookie configuration */
  cookie: CookieConfig

  /** KV namespace for revocation list (required for hybrid strategy) */
  kv?: KVNamespace

  /** D1 database for session storage (required for database strategy) */
  db?: D1Database

  /** Session refresh settings */
  refresh?: {
    /** Threshold before expiry to trigger refresh (in seconds) */
    threshold: number
    /** Grace period where old token remains valid (in seconds) */
    gracePeriod: number
  }
}

/**
 * Cookie configuration
 */
export interface CookieConfig {
  /** Cookie name (default: __session) */
  name: string

  /** HTTP only flag (prevents JS access) */
  httpOnly: boolean

  /** Secure flag (HTTPS only) */
  secure: boolean

  /** SameSite attribute for CSRF protection */
  sameSite: 'lax' | 'strict' | 'none'

  /** Max age in seconds (7 days default) */
  maxAge: number

  /** Cookie path (default: /) */
  path?: string

  /** Cookie domain (omit for strictest scope) */
  domain?: string
}

/**
 * Session data stored in JWT or database
 */
export interface SessionData {
  /** Unique session ID (crypto.randomUUID for entropy) */
  sessionId: string

  /** User ID */
  userId: string

  /** User role for authorization */
  role: string

  /** Device information (user-agent) */
  device?: string

  /** Issued at timestamp (Unix seconds) */
  iat: number

  /** Expiration timestamp (Unix seconds) */
  exp: number

  /** Last active timestamp (Unix milliseconds) - database strategy only */
  lastActive?: number
}

/**
 * Session strategy interface
 * All strategies must implement this interface
 */
export interface SessionStrategy {
  /**
   * Create a new session
   * @returns Session token and session ID
   */
  create(data: Omit<SessionData, 'sessionId' | 'iat' | 'exp'>): Promise<{
    token: string
    sessionId: string
  }>

  /**
   * Get session data from request
   * @returns Session data or null if invalid/expired
   */
  get(request: Request): Promise<SessionData | null>

  /**
   * Destroy session (clear cookie)
   */
  destroy(response: Response): Response

  /**
   * Regenerate session ID (session fixation prevention)
   * MUST be called after authentication
   */
  regenerate(data: Omit<SessionData, 'sessionId' | 'iat' | 'exp'>): Promise<{
    token: string
    sessionId: string
  }>

  /**
   * Check if session is valid (for hybrid strategy with revocation)
   * Optional method for strategies that support revocation
   */
  isValid?(request: Request): Promise<boolean>

  /**
   * Revoke specific session (for hybrid/database strategies)
   */
  revoke?(sessionId: string): Promise<void>

  /**
   * Revoke all sessions for a user (for hybrid/database strategies)
   */
  revokeAll?(userId: string): Promise<void>
}

/**
 * Database session record structure
 */
export interface SessionRecord {
  /** Session ID (primary key) */
  id: string

  /** User ID (foreign key) */
  userId: string

  /** Session data (JSON) */
  data: string

  /** Device information */
  device: string | null

  /** Last active timestamp */
  lastActive: number

  /** Created timestamp */
  createdAt: number

  /** Expiration timestamp */
  expiresAt: number
}
