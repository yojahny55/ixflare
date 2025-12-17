/**
 * Security Headers Types
 * Story 5-8: Security Headers Auto-Injection
 *
 * TypeScript types for all security header configurations
 */

/**
 * Content-Security-Policy directive source values
 */
export type CSPSource =
  | "'self'"
  | "'none'"
  | "'unsafe-inline'"
  | "'unsafe-eval'"
  | "'strict-dynamic'"
  | string

/**
 * Content-Security-Policy configuration
 *
 * Configures CSP directives to prevent XSS and data injection attacks.
 * All directives accept an array of source values.
 *
 * @example
 * ```typescript
 * const cspConfig: ContentSecurityPolicyConfig = {
 *   defaultSrc: ["'self'"],
 *   scriptSrc: ["'self'", "'nonce-{NONCE}'"],
 *   styleSrc: ["'self'", "'unsafe-inline'"],
 *   imgSrc: ["'self'", 'data:', 'https:'],
 *   reportUri: '/csp-report',
 * }
 * ```
 */
export interface ContentSecurityPolicyConfig {
  /** default-src: Fallback for all directives */
  defaultSrc?: CSPSource[]
  /** script-src: Valid sources for JavaScript */
  scriptSrc?: CSPSource[]
  /** style-src: Valid sources for stylesheets */
  styleSrc?: CSPSource[]
  /** img-src: Valid sources for images */
  imgSrc?: CSPSource[]
  /** font-src: Valid sources for fonts */
  fontSrc?: CSPSource[]
  /** connect-src: Valid endpoints for fetch, XHR, WebSocket */
  connectSrc?: CSPSource[]
  /** media-src: Valid sources for audio/video */
  mediaSrc?: CSPSource[]
  /** object-src: Valid sources for <object>, <embed>, <applet> */
  objectSrc?: CSPSource[]
  /** frame-src: Valid sources for nested browsing contexts (iframes) */
  frameSrc?: CSPSource[]
  /** frame-ancestors: Valid parents that may embed this page */
  frameAncestors?: CSPSource[]
  /** form-action: Valid endpoints for form submissions */
  formAction?: CSPSource[]
  /** base-uri: Valid URLs for <base> element */
  baseUri?: CSPSource[]
  /** worker-src: Valid sources for Worker, SharedWorker, ServiceWorker */
  workerSrc?: CSPSource[]
  /** manifest-src: Valid sources for application manifests */
  manifestSrc?: CSPSource[]
  /** prefetch-src: Valid sources for prefetch/prerender */
  prefetchSrc?: CSPSource[]
  /** child-src: Valid sources for workers and nested browsing contexts (DEPRECATED, use worker-src and frame-src) */
  childSrc?: CSPSource[]

  /** report-uri: URL where violation reports are sent (DEPRECATED, use report-to) */
  reportUri?: string
  /** report-to: Reporting API endpoint name */
  reportTo?: string

  /** Use Content-Security-Policy-Report-Only header instead of enforcing */
  reportOnly?: boolean

  /** upgrade-insecure-requests: Upgrade HTTP to HTTPS */
  upgradeInsecureRequests?: boolean
  /** block-all-mixed-content: Block HTTP content on HTTPS pages (DEPRECATED) */
  blockAllMixedContent?: boolean
}

/**
 * Strict-Transport-Security (HSTS) configuration
 *
 * Instructs browsers to only connect via HTTPS, preventing SSL stripping attacks.
 *
 * @example
 * ```typescript
 * // Simple (uses defaults)
 * const hstsConfig = true
 *
 * // Full configuration
 * const hstsConfig: HSTSConfig = {
 *   maxAge: 63072000, // 2 years (required for preload)
 *   includeSubDomains: true,
 *   preload: true,
 * }
 * ```
 */
export interface HSTSConfig {
  /**
   * Time in seconds that browser should remember HTTPS-only rule
   * Minimum 31536000 (1 year) for preload list submission
   * Recommended 63072000 (2 years) for preload
   */
  maxAge?: number
  /**
   * Apply HSTS to all subdomains
   * REQUIRED if preload is true
   */
  includeSubDomains?: boolean
  /**
   * Include domain in browser HSTS preload list
   * Requires maxAge >= 31536000 and includeSubDomains = true
   * WARNING: Removal from preload list takes months
   */
  preload?: boolean
}

/**
 * Permissions-Policy feature allowlist
 *
 * Controls which browser features can be used in the document and iframes.
 * Empty array [] disables the feature entirely.
 * ['self'] allows on same origin only.
 * ['self', 'https://example.com'] allows on self and specific origin.
 * ['*'] allows on all origins (not recommended for sensitive features).
 *
 * @example
 * ```typescript
 * const permissionsPolicy: PermissionsPolicyConfig = {
 *   camera: [],                  // Disable camera
 *   microphone: [],              // Disable microphone
 *   geolocation: ['self'],       // Same origin only
 *   payment: ['self', 'https://stripe.com'],
 * }
 * ```
 */
export interface PermissionsPolicyConfig {
  /** Accelerometer sensor */
  accelerometer?: string[]
  /** Ambient light sensor */
  ambientLightSensor?: string[]
  /** Autoplay of media */
  autoplay?: string[]
  /** Battery status API */
  battery?: string[]
  /** Camera access */
  camera?: string[]
  /** Cross-origin isolated APIs (SharedArrayBuffer, etc.) */
  crossOriginIsolated?: string[]
  /** Display capture (screen sharing) */
  displayCapture?: string[]
  /** document.domain setter */
  documentDomain?: string[]
  /** Encrypted media extensions (EME) */
  encryptedMedia?: string[]
  /** Execution while not rendered (display: none, visibility: hidden) */
  executionWhileNotRendered?: string[]
  /** Execution while out of viewport */
  executionWhileOutOfViewport?: string[]
  /** Fullscreen API */
  fullscreen?: string[]
  /** Geolocation API */
  geolocation?: string[]
  /** Gyroscope sensor */
  gyroscope?: string[]
  /** Magnetometer sensor */
  magnetometer?: string[]
  /** Microphone access */
  microphone?: string[]
  /** MIDI access */
  midi?: string[]
  /** Navigation override (deprecated) */
  navigationOverride?: string[]
  /** Payment Request API */
  payment?: string[]
  /** Picture-in-picture */
  pictureInPicture?: string[]
  /** Publickey credentials (WebAuthn) */
  publickeyCredentialsGet?: string[]
  /** Screen wake lock */
  screenWakeLock?: string[]
  /** Synchronous XHR */
  syncXhr?: string[]
  /** USB access */
  usb?: string[]
  /** Web share API */
  webShare?: string[]
  /** XR (virtual/augmented reality) */
  xrSpatialTracking?: string[]
}

/**
 * Referrer-Policy values
 *
 * Controls how much referrer information is sent with requests.
 *
 * - no-referrer: Never send referrer
 * - no-referrer-when-downgrade: Send referrer for same security level (default)
 * - origin: Send origin only (no path)
 * - origin-when-cross-origin: Full URL for same-origin, origin for cross-origin
 * - same-origin: Send referrer for same-origin only
 * - strict-origin: Send origin for same security level
 * - strict-origin-when-cross-origin: Full URL for same-origin, origin for cross-origin same-security (RECOMMENDED)
 * - unsafe-url: Always send full URL (NOT RECOMMENDED)
 */
export type ReferrerPolicy =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url'

/**
 * X-Frame-Options values
 *
 * Controls whether page can be embedded in iframe (clickjacking protection).
 *
 * - DENY: Cannot be embedded anywhere
 * - SAMEORIGIN: Can only be embedded on same origin
 *
 * NOTE: Content-Security-Policy frame-ancestors directive is preferred over X-Frame-Options
 */
export type XFrameOptions = 'DENY' | 'SAMEORIGIN'

/**
 * Cross-Origin-Embedder-Policy values
 */
export type CrossOriginEmbedderPolicy = 'unsafe-none' | 'require-corp' | 'credentialless'

/**
 * Cross-Origin-Opener-Policy values
 */
export type CrossOriginOpenerPolicy = 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin'

/**
 * Cross-Origin-Resource-Policy values
 */
export type CrossOriginResourcePolicy = 'same-site' | 'same-origin' | 'cross-origin'

/**
 * Complete security headers configuration
 *
 * All headers are enabled by default with secure defaults.
 * Set to false to disable specific headers.
 * Set to object for custom configuration.
 *
 * @example
 * ```typescript
 * const securityHeaders: SecurityHeadersConfig = {
 *   contentSecurityPolicy: {
 *     defaultSrc: ["'self'"],
 *     scriptSrc: ["'self'"],
 *   },
 *   strictTransportSecurity: {
 *     maxAge: 63072000,
 *     includeSubDomains: true,
 *     preload: true,
 *   },
 *   xFrameOptions: 'DENY',
 *   referrerPolicy: 'strict-origin-when-cross-origin',
 * }
 *
 * // Disable all headers for specific route
 * const disabledHeaders: SecurityHeadersConfig = false
 * ```
 */
export interface SecurityHeadersConfig {
  /**
   * Content-Security-Policy
   * Prevents XSS and data injection attacks
   * Default: { defaultSrc: ["'self'"], scriptSrc: ["'self'"] }
   */
  contentSecurityPolicy?: ContentSecurityPolicyConfig | false

  /**
   * Strict-Transport-Security (HSTS)
   * Forces HTTPS connections, prevents downgrade attacks
   * Default: { maxAge: 31536000, includeSubDomains: true }
   */
  strictTransportSecurity?: HSTSConfig | boolean

  /**
   * X-Content-Type-Options
   * Prevents MIME type sniffing
   * Default: true (nosniff)
   */
  xContentTypeOptions?: boolean

  /**
   * X-Frame-Options
   * Prevents clickjacking attacks
   * Default: 'DENY'
   */
  xFrameOptions?: XFrameOptions | false

  /**
   * Referrer-Policy
   * Controls referrer information leakage
   * Default: 'strict-origin-when-cross-origin'
   */
  referrerPolicy?: ReferrerPolicy | false

  /**
   * X-XSS-Protection
   * DEPRECATED: Modern browsers use CSP instead
   * Always set to '0' to disable legacy XSS filter
   * Default: true (set to '0')
   */
  xXssProtection?: boolean

  /**
   * Permissions-Policy
   * Restricts browser feature usage
   * Default: undefined (not set)
   */
  permissionsPolicy?: PermissionsPolicyConfig

  /**
   * Cross-Origin-Embedder-Policy (COEP)
   * Controls cross-origin resource embedding (Spectre mitigation)
   * Default: undefined (not set)
   */
  crossOriginEmbedderPolicy?: CrossOriginEmbedderPolicy

  /**
   * Cross-Origin-Opener-Policy (COOP)
   * Controls cross-origin window references (Spectre mitigation)
   * Default: undefined (not set)
   */
  crossOriginOpenerPolicy?: CrossOriginOpenerPolicy

  /**
   * Cross-Origin-Resource-Policy (CORP)
   * Controls cross-origin resource access (Spectre mitigation)
   * Default: undefined (not set)
   */
  crossOriginResourcePolicy?: CrossOriginResourcePolicy

  /**
   * Enable HTTP to HTTPS redirect in production
   * Default: true
   */
  httpsRedirect?: boolean
}
