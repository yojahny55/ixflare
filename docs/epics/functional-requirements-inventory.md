# Functional Requirements Inventory

## MVP Functional Requirements (168 Total)

### Core Features (82 FRs)

**1. Routing & Request Handling (11 FRs)**
- FR8: File-based route conventions
- FR9: Nested route layouts with parent-child relationships
- FR10: Type-safe route parameters with validation
- FR11: API routes with HTTP method handlers (GET, POST, PUT, DELETE, PATCH)
- FR12: Route loaders for data fetching
- FR13: Automatic route discovery from file structure
- FR14: Route conflict handling with clear errors
- FR116: Request body parsing with content-type detection
- FR117: Typed responses (JSON, HTML, binary, stream)
- FR118: HTTP header reading/setting
- FR119: Type-safe query parameter parsing

**2. EdgeRecord ORM (17 FRs)**
- FR15: Type-safe model schemas
- FR16: CRUD operations with consistent API across tiers
- FR17: Automatic storage tier selection (KV/D1/DO)
- FR18: Automatic caching of frequently accessed data
- FR19: Automatic cache invalidation
- FR20: Database migrations for schema changes
- FR21: Type-safe query builders
- FR22: Model relationships (one-to-many, many-to-many)
- FR23: Multi-tier data consistency handling
- FR101: Consistency requirements per model
- FR125: Transactions with automatic rollback
- FR126: Database seeding for dev/testing
- FR127: Soft deletes with automatic filtering
- FR148: Pagination helpers (offset, cursor-based)
- FR150: Sensible tier selection defaults
- FR151: Override automatic tier selection
- FR152: Data migration between tiers based on access patterns
- FR166: D1 connection pooling
- FR176: TTL configuration for caching

**3. Server-Side Rendering (9 FRs)**
- FR24: React component rendering at edge
- FR25: Progressive HTML streaming
- FR26: Selective component hydration
- FR27: Per-route rendering strategy optimization
- FR28: SSR error boundaries with graceful degradation
- FR29: Rendered HTML caching at edge
- FR153: Streaming error boundaries with fallback HTML
- FR154: `<head>` before `<body>` enforcement
- FR155: Hydration manifest generation

**4. Middleware & Request Processing (10 FRs)**
- FR30: Type-safe middleware functions
- FR31: Middleware composition chains
- FR32: Global and route-group middleware
- FR33: Typed context through middleware chain
- FR34: Request/response transformation patterns
- FR35: Middleware error boundaries
- FR128: Built-in edge-native rate limiting
- FR160: Configurable rate limiting strategies
- FR161: Configurable rate limiting windows/thresholds
- FR162: Rate limit exceeded responses (429 + Retry-After)
- FR171: Individual route middleware

**5. CLI Commands (17 FRs)**
- FR42: Local dev server with HMR
- FR43: Production bundle optimization
- FR44: Deploy to Cloudflare Workers
- FR45: Local production preview
- FR46: Dependency management with type safety
- FR47: Database migrations from CLI
- FR102: TypeScript type generation
- FR103: Deployment history for rollback
- FR104: Rescue checkpoints
- FR105: HMR state preservation
- FR106: Tree-shaking, code splitting, minification
- FR107: Environment variable loading with precedence
- FR147: Type checking via CLI
- FR163: Migration rollback
- FR164: Live log streaming
- FR167: Eject to custom configuration
- FR158: Automatic route-based code splitting
- FR159: Server-only code removal from client bundles

**6. Testing Framework (9 FRs)**
- FR36: Unit tests with simulated Workers environment
- FR37: Integration tests for multi-tier storage
- FR38: Type-safe test utilities
- FR39: Local tests simulating edge execution
- FR40: CI/CD integration
- FR41: Route handler testing with mocks
- FR130: Fixture management
- FR131: Coverage reports with thresholds
- FR132: Snapshot testing for SSR

**7. Developer Experience Polish (9 FRs)**
- FR50: Progressive help
- FR51: Rescue checkpoint creation
- FR52: Rescue checkpoint restoration
- FR96: Operation duration tracking
- FR108: Actionable error messages with docs links
- FR110: Progress indicators for >5s operations
- FR111: Color-coded CLI output with --no-color
- FR113: Wizard and quickstart modes
- FR133: Framework version notifications
- FR134: WebSocket connections via Durable Objects
- FR136: Interactive Quick Start playground
- FR137: Error messages with syntax highlighting
- FR156: WebSocket routing helpers
- FR157: WebSocket auto-reconnection

### Infrastructure & Foundation (86 FRs)

**8. Project Lifecycle (48 FRs)**

*Initialization & Setup (12 FRs):*
- FR1: Single command project creation
- FR2: Project type selection
- FR3: Starter template selection
- FR4: Package manager preference
- FR5: Auto-detect package manager
- FR6: Project structure generation
- FR7: TypeScript configuration scaffolding
- FR122: Minimal template with example patterns
- FR123: Automatic dependency installation
- FR124: First-time deployment guidance
- FR143: Deployed URL display
- FR145: .gitignore generation

*Templates (6 FRs):*
- FR62: Template browsing
- FR63: Core template initialization
- FR64: Template metadata display
- FR65: Template health indicators
- FR97: Template health dashboard
- FR100: Template CI validation

*Documentation (7 FRs):*
- FR55: Quick Start guide (<5 min)
- FR56: Core Concepts documentation
- FR57: Deep Dive guides
- FR58: Auto-generated API reference
- FR59: Troubleshooting hub (top 10 errors)
- FR60: Role-based documentation navigation
- FR174: Copy-paste recipe library

*Deployment (8 FRs):*
- FR69: Single command deployment
- FR70: Edge-optimized bundles
- FR71: Multi-environment deployment
- FR72: Per-environment settings
- FR73: Deployment configuration validation
- FR74: Deployment rollback
- FR165: Environment variable display before deploy
- FR168: Post-deployment smoke test

*Configuration & Environment (7 FRs):*
- Environment variable management
- Secrets management
- Configuration validation
- Edge location testing
- Framework version compatibility
- FR169: Environment-specific secrets
- FR170: Request size limit validation

*Migration (4 FRs):*
- FR75: Project type migration
- FR76: Add frontend to api-backend
- FR77: Remove frontend from fullstack
- FR78: Migration plan generation

*Productivity Tools (4 FRs):*
- Database GUI (`ix db:studio`)
- Performance budgets
- FR144: Static asset serving
- FR173: Local D1 database for offline dev

**9. Cross-Cutting Concerns (38 FRs)**

*Security (8 FRs):*
- FR79: CSRF protection
- FR80: Secure cookie handling
- FR129: XSS prevention (auto-sanitization)
- FR138: Dependency vulnerability scanning
- FR139: Secret encryption and log redaction
- FR140: HTTP to HTTPS redirect

*Error Handling (4 FRs):*
- Client-side error boundaries
- Custom error pages (404, 500)
- Error logging
- Graceful degradation

*HTTP Standards (6 FRs):*
- Health check endpoints
- Request ID tracking
- Response compression
- Redirect management
- CORS preflight optimization
- Graceful Worker shutdown

*Edge-Native Constraints (5 FRs):*
- Bundle size validation (1MB limit)
- CPU time limit warnings
- Memory usage warnings
- FR120: Global state persistence warnings
- FR121: Edge location metadata access

*Performance & Caching (1 FR):*
- Cache-Control header management

*Extensibility (2 FRs):*
- FR141: Lifecycle hooks for plugins
- FR142: Custom CLI commands

*UX Enhancements - Tier 2 (4 FRs):*
- FR109: Troubleshooting search (beta)
- FR112: Template preview screenshots (beta)
- FR114: Detailed health indicators (beta)
- FR115: Checkpoint visual confirmation (beta)

---
