# Implementation Patterns & Consistency Rules

## Pattern Categories Defined

**Critical Conflict Points Identified:** 14 areas where AI agents could make different choices - all now standardized.

## Naming Patterns

**Database Naming Conventions:**

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `users`, `order_items` |
| Columns | snake_case | `created_at`, `user_id` |
| Foreign keys | snake_case with `_id` suffix | `user_id`, `product_id` |
| Indexes | `idx_{table}_{column}` | `idx_users_email` |
| Primary keys | `id` (implicit) | `id` |

**API Naming Conventions:**

| Element | Convention | Example |
|---------|------------|---------|
| Routes | Plural nouns, kebab-case | `/api/v1/users`, `/api/v1/user-profiles` |
| Route params | camelCase | `/api/v1/users/:userId` |
| Query params | camelCase | `?sortBy=createdAt&limit=10` |
| Headers | PascalCase with hyphens | `X-Request-Id`, `Content-Type` |

**File Naming Conventions:**

| Element | Convention | Example |
|---------|------------|---------|
| Components | kebab-case | `user-card.tsx`, `nav-menu.tsx` |
| Utilities | kebab-case | `format-date.ts`, `parse-query.ts` |
| Routes | kebab-case | `user-profiles.tsx`, `order-details.tsx` |
| Tests | kebab-case + `.test` | `user-card.test.ts` |
| Types | kebab-case | `user-types.ts`, `api-types.ts` |

**Code Naming Conventions:**

| Element | Convention | Example |
|---------|------------|---------|
| Variables | camelCase | `userId`, `orderItems` |
| Functions | camelCase | `getUserById`, `formatDate` |
| Classes | PascalCase | `UserService`, `OrderController` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| Types/Interfaces | PascalCase | `User`, `OrderItem`, `ApiResponse` |
| Enums | PascalCase (values: PascalCase) | `Status.Pending`, `Role.Admin` |

## Structure Patterns

**Test File Location:**
- Mirrored `tests/` directory structure
- `src/services/user.ts` → `tests/services/user.test.ts`
- `src/components/user-card.tsx` → `tests/components/user-card.test.tsx`

**Component Organization (Hybrid):**

```
src/
├── components/          # Shared, reusable components
│   ├── ui/              # Primitive UI components
│   └── layout/          # Layout components
├── features/            # Domain-specific features
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   └── products/
├── hooks/               # Shared hooks
├── utils/               # Shared utilities
└── types/               # Shared types
```

**Import Path Aliases:**

| Alias | Path | Usage |
|-------|------|-------|
| `@/` | `src/` | `import { x } from '@/utils/format'` |
| `@/components` | `src/components/` | `import { Button } from '@/components/ui'` |
| `@/features` | `src/features/` | `import { useAuth } from '@/features/auth'` |
| `@/types` | `src/types/` | `import type { User } from '@/types'` |

## Format Patterns

**API Response Formats:**

```typescript
// Success (naked JSON)
{ "id": 1, "name": "Jordan", "createdAt": 1733311800000 }

// Error (structured envelope)
{
  "error": {
    "code": "AUTH.TOKEN_EXPIRED",
    "message": "Session has expired",
    "status": 401,
    "rayId": "abc123",
    "timestamp": 1733311800000
  }
}
```

**JSON Field Naming:**
- All API responses use camelCase
- EdgeRecord auto-transforms: DB `snake_case` → API `camelCase`

**Date/Time Format:**
- Unix timestamp in milliseconds: `1733311800000`
- Matches `Date.now()` and `new Date().getTime()`

## Communication Patterns

**Event Naming:**
- PascalCase: `UserCreated`, `OrderPaymentFailed`, `SessionExpired`
- Namespaced by domain when needed: `AuthUserCreated`, `BillingPaymentFailed`

**Event Payload Structure:**

```typescript
interface DomainEvent<T> {
  type: string           // 'UserCreated'
  payload: T             // Event-specific data
  timestamp: number      // Unix ms
  rayId: string          // Request correlation
}
```

**Logging:**
- Levels: `debug`, `info`, `warn`, `error` (Standard 4)
- Format: JSON in production, human-readable in development
- Auto-enriched: `rayId`, `colo`, `timestamp`, `path`

## Process Patterns

**Error Handling:**

```typescript
// Custom error classes with typed codes
class AuthError extends AppError {
  constructor(code: AuthErrorCode, message: string) {
    super(`AUTH.${code}`, message, 401)
  }
}

// Usage
throw new AuthError('TOKEN_EXPIRED', 'Session has expired')

// Caught by global error handler → formatted response
```

**Error Class Hierarchy:**

```
AppError (base)
├── AuthError (401)
├── ValidationError (422)
├── NotFoundError (404)
├── ForbiddenError (403)
├── ConflictError (409)
└── InfraError (500)
```

**AsyncState Pattern (Discriminated Union):**

```typescript
// Use discriminated union to prevent impossible states
type AsyncState<T, E = AppError> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E }

// Usage - TypeScript enforces correct access
function render(state: AsyncState<User>) {
  switch (state.status) {
    case 'idle': return <Placeholder />
    case 'loading': return <Spinner />
    case 'success': return <UserCard user={state.data} /> // data guaranteed
    case 'error': return <ErrorMessage error={state.error} /> // error guaranteed
  }
}
```

**Validation:**
- Schema-shared: Same Zod schema on client + server
- Single source of truth for validation rules
- TypeScript types inferred from schemas

```typescript
// schemas/user.ts
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
})

// Used in API route (server)
const data = createUserSchema.parse(await request.json())

// Used in form (client)
const { register, handleSubmit } = useForm({
  resolver: zodResolver(createUserSchema)
})
```

## Additional Patterns (from Advanced Elicitation)

**Class vs Function Guidance:**

| Use Classes For | Use Functions For |
|-----------------|-------------------|
| Services (state + deps) | Utilities (pure transforms) |
| Repositories (data access) | Helpers (one-off operations) |
| Error types (identity) | Middleware (request handlers) |
| Models (domain entities) | Route handlers |

```typescript
// Class: Has state, dependencies
class UserService {
  constructor(private db: D1Database) {}
  async findById(id: string): Promise<User> { ... }
}

// Function: Pure, no state
function formatUserName(user: User): string {
  return `${user.firstName} ${user.lastName}`
}
```

**EdgeRecord Usage Pattern:**

```typescript
// Direct usage (simple cases) - OK for MVP
const user = await User.find(id)

// Service wrapper (complex cases) - Required for:
// - Multiple ORM calls in transaction
// - Business logic beyond CRUD
// - External service coordination

class OrderService {
  async createOrder(data: CreateOrderInput) {
    // Transaction, inventory check, payment, etc.
  }
}
```

**Error Decision Tree:**

```
Is it authentication/session related?
├── Yes → AuthError (401)
└── No → Is user not allowed to access resource?
    ├── Yes → ForbiddenError (403)
    └── No → Is resource not found?
        ├── Yes → NotFoundError (404)
        └── No → Is there a conflict (duplicate)?
            ├── Yes → ConflictError (409)
            └── No → Is input invalid?
                ├── Yes → ValidationError (422)
                └── No → InfraError (500)
```

## Enforcement Guidelines

**All AI Agents MUST:**

1. Follow naming conventions exactly - no variations
2. Place tests in mirrored `tests/` structure
3. Use path aliases for imports (`@/`)
4. Return camelCase JSON, store snake_case in DB
5. Use Unix ms timestamps for all dates
6. Use PascalCase for events
7. Throw typed errors extending `AppError`
8. Use discriminated union for AsyncState
9. Share Zod schemas between client/server

## Pattern Enforcement Mechanisms

**Automated Prevention (15 Failure Modes Covered):**

| Mechanism | What It Prevents |
|-----------|-----------------|
| ESLint `no-relative-imports` | Import path chaos |
| ESLint `naming-convention` | Naming drift |
| ESLint `no-bare-throw` | Untyped errors |
| Pre-commit hooks | Pattern violations reaching repo |
| Response middleware | JSON case transformation bugs |
| Vitest coverage gates | Missing tests |
| TypeScript strict | Type mismatches |
| CI pattern checks | PR-level enforcement |

**ESLint Configuration (eslint-plugin-ixflare):**

```javascript
module.exports = {
  rules: {
    'no-relative-imports': 'error',
    'no-bare-throw': 'error',
    'enforce-async-state': 'error',
    'kebab-case-files': 'error',
    'snake-case-db': 'error',
    'camel-case-json': 'error',
  }
}
```

**Pre-commit Hook:**

```bash
#!/bin/sh
pnpm lint:patterns || exit 1
pnpm test:affected || exit 1
```

## Pattern Examples

**Good Examples:**

```typescript
// ✅ Correct file: src/features/auth/utils/validate-token.ts
import { AuthError } from '@/errors'
import type { User } from '@/types'

export async function validateToken(token: string): Promise<User> {
  // snake_case in DB query
  const user = await db.query('SELECT * FROM users WHERE auth_token = ?', [token])

  if (!user) {
    throw new AuthError('TOKEN_INVALID', 'Invalid authentication token')
  }

  // camelCase in response
  return {
    id: user.id,
    email: user.email,
    createdAt: user.created_at, // transformed
  }
}
```

**Anti-Patterns:**

```typescript
// ❌ Wrong file name: src/features/auth/utils/ValidateToken.ts (should be kebab-case)
// ❌ Wrong import: import { AuthError } from '../../errors' (should use @/)
// ❌ Wrong response: { user_id: 1 } (should be camelCase: userId)
// ❌ Wrong date: "2025-12-04T10:30:00Z" (should be Unix ms: 1733311800000)
// ❌ Wrong event: 'user_created' (should be PascalCase: UserCreated)
// ❌ Wrong loading: { isLoading: true } (should be discriminated union)
```

## Cross-Agent Compatibility Verified

Three-agent simulation confirmed patterns produce compatible code:
- Database schema ↔ API routes ↔ Frontend components
- Shared Zod schemas work across all layers
- Error envelope format parsed correctly
- AsyncState renders consistently with discriminated unions

## Pattern Refinements (from Critical Review)

**Error Handling - Extended:**

```typescript
// Core errors (use for 90% of cases)
AppError → AuthError | ValidationError | NotFoundError | ForbiddenError | ConflictError | InfraError

// Generic HttpError (use for edge cases: 429, 402, 410, 412, 503, etc.)
class HttpError extends AppError {
  constructor(status: number, code: string, message: string) {
    super(code, message, status)
  }
}

// Usage
throw new HttpError(429, 'SECURITY.RATE_LIMITED', 'Too many requests')
throw new HttpError(503, 'INFRA.MAINTENANCE', 'Scheduled maintenance')
```

**Import Ordering (ESLint Enforced):**

```typescript
// Order: External → Types → Components → Features → Utils → Relative
import { z } from 'zod'                    // 1. External
import type { User } from '@/types'        // 2. Types
import { Button } from '@/components/ui'   // 3. Components
import { useAuth } from '@/features/auth'  // 4. Features
import { formatDate } from '@/utils'       // 5. Utilities
```

**Logging Enhancement:**

```typescript
// Production logs include human-readable timestamp for debugging
logger.info('User created', {
  userId: 123,
  createdAt: 1733311800000,
  _debug: { createdAtISO: '2025-12-04T10:30:00Z' } // Stripped in prod, kept in staging
})
```

**AsyncState Extended (Complex Cases):**

```typescript
// For pagination, refresh, retry scenarios
type AsyncStateExtended<T, E = AppError> = {
  status: 'idle' | 'loading' | 'success' | 'error' | 'refreshing'
  data: T | null
  error: E | null
  meta?: {
    lastFetched?: number
    retryCount?: number
    hasMore?: boolean
  }
}
```

**Test Orphan Detection:**

```typescript
// vitest.config.ts
export default {
  testOrphanDetection: {
    enabled: true,
    action: 'error', // Fail CI if test file has no matching source
  }
}
```

**IDE Configuration (VS Code):**

```json
// .vscode/settings.json
{
  "explorer.sortOrder": "type",
  "typescript.preferences.importModuleSpecifier": "non-relative"
}
```
