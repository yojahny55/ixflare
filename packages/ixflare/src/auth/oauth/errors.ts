/**
 * @module auth/oauth/errors
 * @description OAuth-specific error classes with secret redaction
 */

import { AuthError } from '@/errors'

export class OAuthError extends AuthError {
  readonly provider: string

  constructor(code: string, message: string, provider: string) {
    super(code, message)
    this.name = 'OAuthError'
    this.provider = provider
  }
}

export class OAuthStateError extends OAuthError {
  constructor(provider: string) {
    super('OAUTH_STATE_INVALID', 'Invalid or expired OAuth state', provider)
  }
}

export class OAuthTokenError extends OAuthError {
  constructor(provider: string, _errorCode?: string) {
    // DO NOT expose actual error from provider - may contain secrets (per Epic 5 requirements)
    super('OAUTH_TOKEN_ERROR', `Token exchange failed for ${provider}`, provider)
  }
}

export class OAuthCallbackError extends OAuthError {
  constructor(provider: string, error: string) {
    // Sanitize - only allow known OAuth error codes (security requirement)
    const safeError = [
      'access_denied',
      'invalid_request',
      'unauthorized_client',
      'unsupported_response_type',
      'invalid_scope',
      'server_error',
      'temporarily_unavailable',
    ].includes(error)
      ? error
      : 'unknown_error'
    super('OAUTH_CALLBACK_ERROR', `OAuth callback error: ${safeError}`, provider)
  }
}

export class OAuthRedirectError extends OAuthError {
  constructor(provider: string, message: string = 'Invalid redirect URI') {
    super('OAUTH_REDIRECT_INVALID', message, provider)
  }
}
