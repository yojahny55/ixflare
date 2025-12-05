# 3. Deploy (2 minutes)

\`\`\`bash
ix deploy
\`\`\`

That's it! Your app is live globally. 🎉
```
**Then** I have a working app deployed

**Given** I want to try without installing
**When** I use the browser playground (FR136):
**Then** I can experiment with Ixflare in a sandboxed environment

**Given** I encounter an issue
**When** I check the Quick Start troubleshooting:
**Then** common issues have inline solutions

**Technical Notes:**
- Minimal steps to deployment
- No unnecessary configuration
- Link to deeper docs for customization
- Browser-based playground for zero-install trial

**Prerequisites:** All framework features complete

---

## Story 9.2: Core Concepts Documentation

As a **developer**,
I want clear documentation of core concepts,
So that I understand how Ixflare works.

**Acceptance Criteria:**

**Given** I want to learn the fundamentals (FR56)
**When** I read Core Concepts:
```
Core Concepts

1. File-Based Routing
   How routes map from file structure to URLs

2. EdgeRecord ORM
   Type-safe data modeling and multi-tier storage

3. Server-Side Rendering
   React rendering at the edge with streaming

4. Islands Architecture
   Selective hydration for minimal JavaScript

5. Middleware
   Request/response processing pipeline

6. Edge Configuration
   Unified configuration with edge.config.ts
```
**Then** I understand the key concepts

**Given** each concept section
**When** I read through it:
**Then** it includes:
- Clear explanation
- Code examples
- Visual diagrams where helpful
- Links to related deep dives

**Technical Notes:**
- Progressive complexity (simple → advanced)
- Cross-linking between related concepts
- Code examples that actually work
- Diagrams for architectural concepts

**Prerequisites:** Story 9.1

---

## Story 9.3: Auto-Generated API Reference

As a **developer**,
I want auto-generated API documentation,
So that I can quickly look up function signatures.

**Acceptance Criteria:**

**Given** I need API details (FR58)
**When** I browse the API Reference:
```
API Reference

ixflare
├── defineConfig()
├── defineModel()
├── defineMiddleware()
└── ...

ixflare/orm
├── field
│   ├── id()
│   ├── string()
│   ├── integer()
│   └── ...
├── query builders
└── ...

ixflare/auth
├── jwt
├── session
├── oauth
└── ...
```
**Then** all public APIs are documented

**Given** I view a function
**When** I read its documentation:
```typescript
/**
 * Creates a new model definition for EdgeRecord
 *
 * @param tableName - Database table name (snake_case)
 * @param fields - Field definitions using field.* helpers
 * @param options - Optional model configuration
 * @returns Model class with CRUD methods
 *
 * @example
 * const User = defineModel('users', {
 *   id: field.id(),
 *   email: field.string().unique(),
 * })
 */
function defineModel<T>(
  tableName: string,
  fields: FieldDefinitions,
  options?: ModelOptions
): Model<T>
```
**Then** I see types, parameters, returns, and examples

**Technical Notes:**
- Generate from TypeScript source with TSDoc
- Include type signatures
- Runnable examples where possible
- Version-specific documentation

**Prerequisites:** All framework features complete

---

## Story 9.4: Deep Dive Guides

As an **experienced developer**,
I want in-depth guides for advanced topics,
So that I can master complex features.

**Acceptance Criteria:**

**Given** I want to learn advanced topics (FR57)
**When** I browse Deep Dives:
```
Deep Dive Guides

Authentication & Security
├── Custom JWT Strategies
├── OAuth Provider Integration
├── Role-Based Access Control
└── Security Best Practices

Performance Optimization
├── Bundle Size Optimization
├── Database Query Optimization
├── Caching Strategies
└── Cold Start Mitigation

Advanced Patterns
├── Multi-Tenant Applications
├── Feature Flags
├── A/B Testing
└── Rate Limiting Strategies
```
**Then** I find comprehensive guides on advanced topics

**Given** I read a deep dive
**When** I follow along:
**Then** it includes:
- Detailed explanations with rationale
- Step-by-step implementation
- Production-ready code examples
- Performance considerations
- Common pitfalls and solutions

**Technical Notes:**
- Written for experienced developers
- Assumes knowledge of core concepts
- Real-world use cases
- Performance benchmarks where relevant

**Prerequisites:** Story 9.2

---

## Story 9.5: Troubleshooting Hub

As a **developer hitting an error**,
I want a troubleshooting hub with solutions,
So that I can fix issues without searching.

**Acceptance Criteria:**

**Given** I encounter a common error (FR59)
**When** I visit the Troubleshooting Hub:
```
Troubleshooting Hub

Top 10 Errors:

1. "Module not found: @/models/..."
   Solution: Check tsconfig paths configuration

2. "D1 database binding not found"
   Solution: Configure D1 in wrangler.toml

3. "Bundle size exceeds 1MB limit"
   Solution: Optimize imports and use code splitting

4. "CORS error: Access-Control-Allow-Origin"
   Solution: Configure CORS middleware

...
```
**Then** I find solutions to common problems

**Given** I search for an error (FR109)
**When** I type in the search box:
**Then** relevant troubleshooting articles appear instantly

**Given** my error isn't listed
**When** I check the error code:
**Then** I can look it up by code (e.g., IX_E001)
**And** find documentation for that specific error

**Technical Notes:**
- Track most common errors from telemetry
- Update based on support queries
- Error codes link to specific articles
- Include "Still stuck?" with support links

**Prerequisites:** Story 9.3

---

## Story 9.6: Role-Based Documentation Navigation

As a **developer with specific needs**,
I want documentation organized by my role,
So that I find relevant content quickly.

**Acceptance Criteria:**

**Given** I select my role (FR60)
**When** I choose from:
- Frontend Developer
- Backend Developer
- Fullstack Developer
- DevOps/Infrastructure

**Then** documentation is filtered/organized for my focus:

**Frontend Developer Path:**
```
Recommended Reading:
1. React Components at the Edge
2. Islands Architecture
3. Styling with Tailwind
4. Client-Side State Management
```

**Backend Developer Path:**
```
Recommended Reading:
1. API Route Design
2. EdgeRecord ORM
3. Authentication & Authorization
4. Database Patterns
```

**Given** I'm a beginner (Alex persona)
**When** I select "Show simpler docs":
**Then** I see:
- Basic patterns first
- Hide advanced configurations
- More step-by-step guidance
- Fewer edge cases

**Technical Notes:**
- Role selection stored in preferences
- Content tagged by role relevance
- Skill level affects content complexity
- Can always access all docs

**Prerequisites:** Story 9.1

---

## Story 9.7: Copy-Paste Recipe Library

As a **developer implementing common features**,
I want a recipe library with working code snippets,
So that I can implement features quickly.

**Acceptance Criteria:**

**Given** I need to implement a common pattern (FR174)
**When** I browse Recipes:
```
Recipe Library

Authentication
├── Email/Password Login
├── OAuth with GitHub
├── Magic Link Authentication
├── JWT Refresh Tokens

Data Patterns
├── Pagination with Cursors
├── Full-Text Search
├── Soft Deletes
├── Audit Logging

API Patterns
├── Rate Limiting
├── API Versioning
├── Webhook Handlers
├── File Uploads

UI Patterns
├── Infinite Scroll
├── Optimistic Updates
├── Form Validation
├── Toast Notifications
```
**Then** I find ready-to-use implementations

**Given** I view a recipe
**When** I read it:
```markdown