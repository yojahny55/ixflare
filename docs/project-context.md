---
project_name: 'Ixflare'
user_name: 'Yojahny'
date: '2025-12-04'
sections_completed: ['technology_stack', 'implementation_rules', 'anti_patterns', 'templates', 'quick_reference']
status: 'complete'
---

# Project Context for AI Agents - Ixflare

_Critical rules and patterns for implementing Ixflare - a TypeScript framework for Cloudflare Workers._

---

## Technology Stack & Versions

| Technology | Version | Notes |
|------------|---------|-------|
| TypeScript | 5.x | Strict mode required |
| Cloudflare Workers | V8 isolates | NOT Node.js |
| React | 19 stable | Server Components + Actions |
| Zod | 4.x | Shared client/server validation |
| Drizzle Kit | 0.41.0 | Internal migration engine |
| Tailwind CSS | Latest | Default CSS solution |
| Vitest | Latest | Test runner |
| Miniflare | Latest | Local Workers simulation |
| pnpm | Latest | Package manager (workspaces) |
| tsup | Latest | Library bundling |
| Vite | Latest | Application bundling |

---

## Critical Implementation Rules

### Edge Runtime Constraints (CRITICAL)

- **NO Node.js APIs** - `fs`, `path`, `process`, `Buffer` are unavailable
- **Bundle size** - Must stay under 50KB (current target: ~39KB)
- **Cold start** - Must be under 100ms
- **CPU time** - 50ms free tier, 30s paid tier
- **Memory** - 128MB limit
- **No long-running** - Use Durable Objects for persistent connections

### Package Boundaries

```
packages/ixflare/        → @worker-only (zero runtime deps)
packages/vite-plugin/    → @node-only (Vite, Node.js)
packages/cli/            → @node-only (Wrangler, Drizzle Kit)
packages/create-ixflare/ → @node-only (scaffolder)
```

**NEVER import @node-only code into @worker-only packages.**

### Naming Conventions (MANDATORY)

| Context | Convention | Example |
|---------|------------|---------|
| DB tables/columns | snake_case | `created_at`, `user_id` |
| API responses | camelCase | `createdAt`, `userId` |
| Files | kebab-case | `user-service.ts` |
| Components | kebab-case | `user-card.tsx` |
| Routes | plural nouns | `/api/v1/users` |
| Variables/functions | camelCase | `getUserById` |
| Classes/types | PascalCase | `UserService` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Events | PascalCase | `UserCreated` |

### Import Rules

**Always use path aliases:**
```typescript
// ✅ Correct
import { Button } from '@/components/ui'
import { useAuth } from '@/features/auth'
import type { User } from '@/types'

// ❌ Wrong
import { Button } from '../../components/ui'
```

**Import order (ESLint enforced):**
1. External packages (`zod`, `react`)
2. Types (`import type`)
3. Components (`@/components`)
4. Features (`@/features`)
5. Utilities (`@/utils`)

### Error Handling

**Use typed error classes:**
```typescript
// ✅ Correct
throw new AuthError('TOKEN_EXPIRED', 'Session has expired')
throw new ValidationError('INVALID_EMAIL', 'Email format invalid')
throw new NotFoundError('USER_NOT_FOUND', `User ${id} not found`)

// ❌ Wrong
throw new Error('Something went wrong')
throw { message: 'error' }
```

**Error hierarchy:**
- `AppError` (base)
- `AuthError` (401)
- `ValidationError` (422)
- `NotFoundError` (404)
- `ForbiddenError` (403)
- `ConflictError` (409)
- `InfraError` (500)
- `HttpError` (generic for 429, 402, etc.)

### Async State Pattern

**Always use discriminated unions:**
```typescript
// ✅ Correct
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: AppError }

// ❌ Wrong
type State = { isLoading: boolean; data?: T; error?: Error }
```

### Date/Time Format

**Always Unix milliseconds:**
```typescript
// ✅ Correct
{ createdAt: 1733311800000 }
Date.now()

// ❌ Wrong
{ createdAt: '2025-12-04T10:30:00Z' }
new Date().toISOString()
```

### API Response Format

**Naked success, envelope on error:**
```typescript
// ✅ Success (naked JSON)
return Response.json({ id: 1, name: 'Jordan', createdAt: 1733311800000 })

// ✅ Error (envelope)
return Response.json({
  error: {
    code: 'AUTH.TOKEN_EXPIRED',
    message: 'Session has expired',
    status: 401,
    rayId: ctx.rayId,
    timestamp: Date.now()
  }
}, { status: 401 })
```

### Testing Rules

**Test location (mirrored):**
```
src/services/user.ts → tests/services/user.test.ts
src/components/ui/button.tsx → tests/components/ui/button.test.tsx
```

**Test naming:**
```typescript
describe('UserService', () => {
  it('should return user when valid ID provided', async () => {})
  it('should throw NotFoundError when user does not exist', async () => {})
})
```

**Use Miniflare for Workers simulation in tests.**

### Validation Pattern

**Zod schemas shared between client and server:**
```typescript
// schemas/user.ts (shared)
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
})

// API route (server)
const data = createUserSchema.parse(await request.json())

// Form (client)
const { register } = useForm({ resolver: zodResolver(createUserSchema) })
```

### JWT Implementation

**Custom WebCrypto-based (NOT jose):**
- ES256 or HS256 (never both in same app)
- 15-minute access token expiry
- Automatic key rotation (30d interval)
- Algorithm validation before signature check

### EdgeRecord ORM

**3-tier storage:**
1. KV (cache, 5-20ms)
2. D1 (primary, SQLite)
3. Durable Objects (strong consistency, 50-100ms)

**Prevent N+1 queries:**
```typescript
// ✅ Correct - eager loading
const users = await User.with('posts', 'profile').all()

// ❌ Wrong - N+1
const users = await User.all()
for (const user of users) {
  user.posts = await user.loadPosts() // N+1!
}
```

---

## Anti-Patterns (NEVER DO)

| Anti-Pattern | Why | Do Instead |
|--------------|-----|------------|
| Import Node.js modules in Workers | Won't work at runtime | Use Web APIs |
| Relative imports (`../..`) | Breaks refactoring | Use `@/` aliases |
| `{ isLoading, data, error }` state | Impossible states possible | Discriminated union |
| ISO date strings in API | Inconsistent parsing | Unix ms |
| `throw new Error()` | Untyped, no code | Typed error classes |
| snake_case in API responses | Inconsistent with JS | camelCase (transform from DB) |
| Colocated tests | Against project pattern | Mirrored `tests/` |
| jose library for JWT | Bloated for Workers | Custom WebCrypto |

---

## File Templates

### New API Route
```typescript
// src/routes/api/v1/users.ts
import { z } from 'zod'
import type { RouteContext } from '@/types'
import { ValidationError } from '@/errors'

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})

export async function POST(ctx: RouteContext) {
  const body = await ctx.request.json()
  const result = createUserSchema.safeParse(body)

  if (!result.success) {
    throw new ValidationError('INVALID_INPUT', result.error.message)
  }

  const user = await User.create(result.data)
  return Response.json(user)
}
```

### New Component
```typescript
// src/components/features/user-card.tsx
import type { User } from '@/types'

interface UserCardProps {
  user: User
}

export function UserCard({ user }: UserCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">{user.name}</h3>
      <p className="text-gray-600">{user.email}</p>
    </div>
  )
}
```

### New Test
```typescript
// tests/services/user.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { UserService } from '@/services/user'
import { NotFoundError } from '@/errors'

describe('UserService', () => {
  let service: UserService

  beforeEach(() => {
    service = new UserService(mockDb)
  })

  it('should return user when valid ID provided', async () => {
    const user = await service.findById('123')
    expect(user).toMatchObject({ id: '123' })
  })

  it('should throw NotFoundError when user does not exist', async () => {
    await expect(service.findById('invalid'))
      .rejects.toThrow(NotFoundError)
  })
})
```

---

## Quick Reference

```
DB: snake_case → API: camelCase
Files: kebab-case
Routes: plural (/users not /user)
Imports: @/ aliases only
Errors: typed classes
State: discriminated union
Dates: Unix ms
Tests: mirrored in tests/
JWT: custom WebCrypto (not jose)
Bundle: <50KB
```
