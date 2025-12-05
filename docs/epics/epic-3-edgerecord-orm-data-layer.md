# Epic 3: EdgeRecord ORM & Data Layer

**Epic Goal:** Enable developers to define data models with type-safe schemas, perform CRUD operations, and leverage automatic caching across Cloudflare's storage tiers (KV, D1, Durable Objects) without managing complexity.

**FR Coverage:** FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR101, FR125, FR126, FR127, FR148, FR150, FR151, FR152, FR166, FR176

---

## Story 3.1: Type-Safe Model Schema Definition

As a **developer**,
I want to define data models with type-safe schemas,
So that I get full TypeScript support for my data structures.

**Acceptance Criteria:**

**Given** I want to define a User model
**When** I create `src/models/User.ts`:
```typescript
import { defineModel, field, timestamps } from 'ixflare/orm'

export const User = defineModel('users', {
  id: field.id(),
  email: field.string().unique(),
  name: field.string(),
  role: field.enum(['user', 'admin', 'moderator']).default('user'),
  bio: field.text().nullable(),
  avatarUrl: field.string().nullable(),
  emailVerifiedAt: field.datetime().nullable(),
  ...timestamps(), // createdAt, updatedAt
})

// TypeScript type is automatically inferred
export type User = typeof User.$infer
```
**Then** the model is registered with EdgeRecord (FR15)
**And** TypeScript infers the correct type:
```typescript
type User = {
  id: number
  email: string
  name: string
  role: 'user' | 'admin' | 'moderator'
  bio: string | null
  avatarUrl: string | null
  emailVerifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

**Given** I want to define field validations
**When** I use field modifiers:
```typescript
export const Product = defineModel('products', {
  id: field.id(),
  sku: field.string().unique().min(3).max(50),
  price: field.decimal({ precision: 10, scale: 2 }).positive(),
  stock: field.integer().min(0).default(0),
  status: field.enum(['draft', 'active', 'archived']),
})
```
**Then** validations are enforced on create/update operations

**Technical Notes:**
- Implement in `packages/ixflare/src/edge-record/` (Architecture: Project Structure)
- Drizzle-style schema definition (Architecture: Schema Definition)
- Field types map to D1 SQLite types
- Generate Zod schemas from model definitions for runtime validation

**Prerequisites:** Epic 1, Epic 2

---

## Story 3.2: CRUD Operations with Consistent API

As a **developer**,
I want to perform CRUD operations with a consistent API,
So that I can easily create, read, update, and delete records.

**Acceptance Criteria:**

**Given** I have a User model defined
**When** I perform CRUD operations:
```typescript
// Create
const user = await User.create({
  email: 'alex@example.com',
  name: 'Alex Rivera',
})

// Read by ID
const user = await User.find(1)
const user = await User.findOrFail(1) // Throws NotFoundError

// Read with conditions
const users = await User.where({ role: 'admin' }).all()
const user = await User.where({ email: 'alex@example.com' }).first()

// Update
await user.update({ name: 'Alex R.' })
// or
await User.where({ id: 1 }).update({ name: 'Alex R.' })

// Delete
await user.delete()
// or
await User.where({ id: 1 }).delete()
```
**Then** operations work consistently across all models (FR16)
**And** all operations return properly typed results

**Given** I want to create or update based on existence
**When** I use upsert:
```typescript
const user = await User.upsert(
  { email: 'alex@example.com' },  // Match criteria
  { name: 'Alex Rivera', role: 'user' }  // Values to set
)
```
**Then** the record is created if not found, or updated if found

**Given** I want to bulk operations
**When** I use bulk methods:
```typescript
// Bulk create
const users = await User.createMany([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' },
])

// Bulk update
await User.where({ role: 'user' }).update({ role: 'member' })

// Bulk delete
await User.where({ createdAt: { lt: oneYearAgo } }).delete()
```
**Then** operations are performed efficiently in batches

**Technical Notes:**
- ActiveRecord-style API for familiarity
- Return model instances, not plain objects
- Auto-transform: DB `snake_case` → API `camelCase` (Architecture: Naming Conventions)
- Timestamps automatically managed on create/update

**Prerequisites:** Story 3.1

---

## Story 3.3: Type-Safe Query Builder

As a **developer**,
I want a fluent query builder with full type safety,
So that I can construct complex queries with IDE support.

**Acceptance Criteria:**

**Given** I want to query with conditions
**When** I use the query builder (FR21):
```typescript
const users = await User
  .where({ role: 'admin' })
  .where('createdAt', '>', lastMonth)
  .orderBy('name', 'asc')
  .limit(10)
  .all()
```
**Then** the query is built correctly with full TypeScript support
**And** invalid field names cause compile-time errors

**Given** I want to use complex conditions
**When** I build the query:
```typescript
const users = await User
  .where({
    role: { in: ['admin', 'moderator'] },
    emailVerifiedAt: { isNotNull: true },
    createdAt: { gte: startDate, lte: endDate },
  })
  .orWhere({ email: { like: '%@company.com' } })
  .all()
```
**Then** conditions are combined with AND/OR logic correctly

**Given** I want to select specific fields
**When** I use select:
```typescript
const emails = await User
  .select('id', 'email', 'name')
  .where({ role: 'admin' })
  .all()
// Type: { id: number, email: string, name: string }[]
```
**Then** only selected fields are returned and typed

**Given** I want aggregate queries
**When** I use aggregate methods:
```typescript
const count = await User.where({ role: 'admin' }).count()
const total = await Order.where({ status: 'completed' }).sum('amount')
const average = await Product.avg('price')
const stats = await Order.groupBy('status').count()
```
**Then** aggregate results are properly typed

**Technical Notes:**
- Builder pattern with immutable query objects
- Type-safe field references using keyof
- Compile-time validation of field names
- SQL injection prevention via parameterized queries

**Prerequisites:** Story 3.2

---

## Story 3.4: Model Relationships

As a **developer**,
I want to define relationships between models,
So that I can easily fetch related data.

**Acceptance Criteria:**

**Given** I define relationships in models (FR22):
```typescript
export const User = defineModel('users', {
  id: field.id(),
  email: field.string().unique(),
  name: field.string(),
}, {
  relations: {
    posts: hasMany(Post, 'authorId'),
    profile: hasOne(Profile, 'userId'),
    roles: manyToMany(Role, 'user_roles'),
  },
})

export const Post = defineModel('posts', {
  id: field.id(),
  title: field.string(),
  content: field.text(),
  authorId: field.foreignKey(User),
}, {
  relations: {
    author: belongsTo(User, 'authorId'),
    tags: manyToMany(Tag, 'post_tags'),
  },
})
```
**Then** relationships are properly typed and queryable

**Given** I want to load related data eagerly
**When** I use `.with()` (Architecture: Eager Loading):
```typescript
const user = await User.with('posts', 'profile').find(1)
// user.posts is Post[]
// user.profile is Profile | null

// Nested eager loading
const posts = await Post
  .with('author', 'tags')
  .with('author.profile')
  .all()
```
**Then** related data is loaded in optimized queries (prevents N+1)

**Given** I want to query through relationships
**When** I use relationship queries:
```typescript
// Get all posts by admin users
const posts = await Post
  .whereHas('author', (query) => query.where({ role: 'admin' }))
  .all()

// Get users with at least 5 posts
const activeUsers = await User
  .withCount('posts')
  .having('postsCount', '>=', 5)
  .all()
```
**Then** relationship conditions are applied correctly

**Technical Notes:**
- Foreign key constraints in D1
- Eager loading with `.with()` to prevent N+1 queries
- Lazy loading available but discouraged
- Join tables for many-to-many (`user_roles`, `post_tags`)

**Prerequisites:** Story 3.3

---

## Story 3.5: Automatic Storage Tier Selection

As a **developer**,
I want EdgeRecord to automatically select the optimal storage tier,
So that I get the best performance without manual configuration.

**Acceptance Criteria:**

**Given** I define a model without specifying storage
**When** EdgeRecord analyzes the model (FR17, FR150):
```typescript
// High-read, simple key-value data → KV
export const Setting = defineModel('settings', {
  key: field.string().primaryKey(),
  value: field.json(),
})

// Relational data with queries → D1
export const User = defineModel('users', {
  id: field.id(),
  email: field.string().unique(),
  // ... relations defined
})

// Strong consistency required → Durable Objects
export const Counter = defineModel('counters', {
  id: field.string().primaryKey(),
  value: field.integer(),
}, {
  consistency: 'strong', // FR101
})
```
**Then** the appropriate storage tier is selected automatically:
- **KV**: Simple key-value, high read, eventual consistency OK
- **D1**: Relational data, complex queries, indexes
- **DO**: Strong consistency, real-time coordination

**Given** automatic selection doesn't fit my needs
**When** I explicitly specify the tier (FR151):
```typescript
export const Session = defineModel('sessions', {
  id: field.string().primaryKey(),
  userId: field.integer(),
  data: field.json(),
}, {
  storage: 'kv',  // Force KV storage
  ttl: 3600,      // Auto-expire after 1 hour
})
```
**Then** my specified tier is used instead

**Given** access patterns change over time
**When** data should migrate between tiers (FR152):
```typescript
export const Product = defineModel('products', {
  // ...
}, {
  cache: {
    tier: 'kv',
    populateFrom: 'd1',
    ttl: 300,  // Cache for 5 minutes
  },
})
```
**Then** frequently accessed D1 data is cached in KV

**Technical Notes:**
- Tier selection based on: schema complexity, consistency requirements, access patterns
- Default to D1 for most models (safest choice)
- KV for session-like data, settings, feature flags
- DO for counters, rate limits, real-time collaboration

**Prerequisites:** Story 3.1

---

## Story 3.6: Automatic Caching & Invalidation

As a **developer**,
I want automatic caching of frequently accessed data,
So that reads are fast without manual cache management.

**Acceptance Criteria:**

**Given** I configure caching for a model (FR18):
```typescript
export const Product = defineModel('products', {
  id: field.id(),
  name: field.string(),
  price: field.decimal(),
}, {
  cache: {
    enabled: true,
    ttl: 300,  // 5 minutes (FR176)
    strategy: 'read-heavy', // Architecture: Cache strategy presets
  },
})
```
**When** I query for a product by ID
**Then** the result is cached in KV
**And** subsequent reads hit the cache

**Given** I update a cached record
**When** I call `product.update({ price: 29.99 })` (FR19)
**Then** the cache is automatically invalidated
**And** the next read fetches fresh data from D1

**Given** I want to manually control caching
**When** I use cache methods:
```typescript
// Skip cache for this query
const product = await Product.find(1, { cache: false })

// Manually invalidate
await Product.invalidateCache(1)

// Warm cache proactively
await Product.warmCache([1, 2, 3])
```
**Then** I have full control when needed

**Given** I want different cache strategies (Architecture: Cache Strategy Presets):
```typescript
// Read-heavy: Aggressive caching, lazy invalidation
{ strategy: 'read-heavy', ttl: 3600 }

// Write-heavy: Minimal caching, immediate invalidation
{ strategy: 'write-heavy', ttl: 60 }

// Balanced: Moderate caching, smart invalidation
{ strategy: 'balanced', ttl: 300 }
```
**Then** caching behavior adapts to my workload

**Technical Notes:**
- Cache key format: `model:id` or `model:query:hash`
- Use KV for distributed cache across edge locations
- Invalidation on write, update, delete
- D1 connection warmup option for cold starts (Architecture: database.warmup)

**Prerequisites:** Story 3.5

---

## Story 3.7: Database Migrations

As a **developer**,
I want to manage database schema changes with migrations,
So that I can evolve my schema safely.

**Acceptance Criteria:**

**Given** I modify a model schema
**When** I run `ix migrate:generate` (FR20):
```bash
$ ix migrate:generate add-bio-to-users

✓ Detected changes:
  • Added column: users.bio (text, nullable)
  • Added column: users.avatar_url (text, nullable)

✓ Generated migration: migrations/001_add_bio_to_users.sql
```
**Then** a migration file is created with the SQL changes

**Given** I have pending migrations
**When** I run `ix migrate`:
```bash
$ ix migrate

Pending migrations:
  • 001_add_bio_to_users.sql
  • 002_create_posts_table.sql

? Apply 2 migrations? (Y/n)

✓ Applied: 001_add_bio_to_users.sql (12ms)
✓ Applied: 002_create_posts_table.sql (8ms)

All migrations complete!
```
**Then** migrations are applied in order
**And** migration state is tracked in D1

**Given** I need to rollback a migration (FR163)
**When** I run `ix migrate:rollback`:
```bash
$ ix migrate:rollback

Last applied migration: 002_create_posts_table.sql

? Rollback this migration? (Y/n)

✓ Rolled back: 002_create_posts_table.sql
```
**Then** the migration is reversed
**And** the down migration SQL is executed

**Given** I want to see migration status
**When** I run `ix migrate:status`:
```bash
$ ix migrate:status

Migration Status:
  ✓ 001_add_bio_to_users.sql      (applied: 2024-12-01)
  ✓ 002_create_posts_table.sql    (applied: 2024-12-02)
  ○ 003_add_tags_table.sql        (pending)
```
**Then** I see which migrations have been applied

**Technical Notes:**
- Use Drizzle Kit for migration generation (Architecture: Migration CLI)
- Migrations stored in `migrations/` directory
- Track applied migrations in `_migrations` table
- Support both up and down migrations

**Prerequisites:** Story 3.1

---

## Story 3.8: Transactions with Automatic Rollback

As a **developer**,
I want to perform multiple operations in a transaction,
So that all changes succeed or fail together.

**Acceptance Criteria:**

**Given** I need atomic operations (FR125)
**When** I use a transaction:
```typescript
import { transaction } from 'ixflare/orm'

await transaction(async (tx) => {
  // Debit from sender
  await tx.update(Account, senderId, {
    balance: { decrement: amount },
  })

  // Credit to receiver
  await tx.update(Account, receiverId, {
    balance: { increment: amount },
  })

  // Create transfer record
  await tx.create(Transfer, {
    fromId: senderId,
    toId: receiverId,
    amount,
  })
})
```
**Then** all operations succeed together
**And** if any fails, all are rolled back

**Given** I throw an error in a transaction
**When** the error occurs:
```typescript
await transaction(async (tx) => {
  await tx.create(Order, { userId, total })

  if (inventory < quantity) {
    throw new Error('Insufficient inventory')
    // Transaction automatically rolls back
  }

  await tx.update(Product, productId, {
    inventory: { decrement: quantity },
  })
})
```
**Then** the transaction is automatically rolled back
**And** no partial changes are committed

**Given** I want nested transactions
**When** I nest transaction calls:
```typescript
await transaction(async (tx) => {
  await tx.create(Order, orderData)

  // Nested transaction (savepoint)
  await transaction(async (innerTx) => {
    await innerTx.create(OrderItem, item1)
    await innerTx.create(OrderItem, item2)
  }, { parent: tx })
})
```
**Then** savepoints are used for nested transactions

**Technical Notes:**
- D1 supports transactions
- Use SQLite savepoints for nested transactions
- Auto-rollback on uncaught exceptions
- Transaction timeout to prevent long-running locks

**Prerequisites:** Story 3.2

---

## Story 3.9: Database Seeding

As a **developer**,
I want to seed the database with test/development data,
So that I can work with realistic data locally.

**Acceptance Criteria:**

**Given** I create a seed file `seeds/users.ts` (FR126):
```typescript
import { seed } from 'ixflare/orm'
import { User, Post } from '@/models'
import { faker } from '@faker-js/faker'

export default seed(async () => {
  // Create admin user
  const admin = await User.create({
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
  })

  // Create fake users with posts
  for (let i = 0; i < 10; i++) {
    const user = await User.create({
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: 'user',
    })

    // Create posts for each user
    for (let j = 0; j < 5; j++) {
      await Post.create({
        authorId: user.id,
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(3),
      })
    }
  }
})
```
**When** I run `ix db:seed`
**Then** seed data is created in the database

**Given** I want environment-specific seeds
**When** I configure seeds:
```typescript
// seeds/index.ts
export default {
  development: [
    './users.ts',
    './products.ts',
    './fixtures/sample-data.json', // JSON fixtures for prod-like data
  ],
  test: [
    './test-fixtures.ts',
  ],
}
```
**Then** appropriate seeds run per environment (Architecture: Hybrid Factories + Fixtures)

**Given** I want to reset and reseed
**When** I run `ix db:seed --fresh`:
```bash
$ ix db:seed --fresh

⚠️  This will delete all data and reseed. Continue? (y/N)

✓ Truncated all tables
✓ Running seeds...
  • users.ts (created 11 users)
  • products.ts (created 50 products)
✓ Seeding complete!
```
**Then** all data is cleared and reseeded

**Technical Notes:**
- Use @faker-js/faker for development data (Architecture: Seed Strategy)
- JSON fixtures for production-like data
- Seed order matters for foreign keys
- Idempotent seeds for safety

**Prerequisites:** Story 3.2

---

## Story 3.10: Soft Deletes

As a **developer**,
I want to soft-delete records instead of permanent deletion,
So that I can recover data and maintain audit trails.

**Acceptance Criteria:**

**Given** I enable soft deletes on a model (FR127):
```typescript
export const User = defineModel('users', {
  id: field.id(),
  email: field.string().unique(),
  name: field.string(),
  deletedAt: field.datetime().nullable(),
}, {
  softDeletes: true,
})
```
**When** I delete a record:
```typescript
await user.delete()
```
**Then** the record is soft-deleted (deletedAt is set)
**And** the record is excluded from normal queries

**Given** I query for records
**When** I use normal queries:
```typescript
// Only returns non-deleted users
const users = await User.all()
const user = await User.find(1)  // Returns null if soft-deleted
```
**Then** soft-deleted records are automatically filtered out

**Given** I want to include soft-deleted records
**When** I use `withTrashed()`:
```typescript
// Include soft-deleted
const allUsers = await User.withTrashed().all()

// Only soft-deleted
const deletedUsers = await User.onlyTrashed().all()

// Find including soft-deleted
const user = await User.withTrashed().find(1)
```
**Then** I can access soft-deleted records when needed

**Given** I want to restore a soft-deleted record
**When** I call `restore()`:
```typescript
const user = await User.withTrashed().find(1)
await user.restore()  // Sets deletedAt to null
```
**Then** the record is restored and appears in normal queries

**Given** I want to permanently delete
**When** I call `forceDelete()`:
```typescript
await user.forceDelete()  // Permanent deletion
```
**Then** the record is permanently removed from the database

**Technical Notes:**
- `deletedAt` column convention
- Global scope automatically applied
- Cascade soft deletes for relationships (optional)
- Index on `deletedAt` for query performance

**Prerequisites:** Story 3.2

---

## Story 3.11: Pagination Helpers

As a **developer**,
I want built-in pagination for large result sets,
So that I can efficiently paginate through data.

**Acceptance Criteria:**

**Given** I want offset-based pagination (FR148)
**When** I use `paginate()`:
```typescript
const result = await User
  .where({ role: 'user' })
  .orderBy('createdAt', 'desc')
  .paginate({ page: 2, perPage: 20 })

// result shape:
{
  data: User[],           // 20 users
  meta: {
    total: 156,           // Total records
    perPage: 20,
    currentPage: 2,
    lastPage: 8,
    from: 21,             // First record index
    to: 40,               // Last record index
  },
  links: {
    first: '/api/users?page=1',
    prev: '/api/users?page=1',
    next: '/api/users?page=3',
    last: '/api/users?page=8',
  }
}
```
**Then** I get paginated results with metadata

**Given** I want cursor-based pagination for large datasets
**When** I use `cursorPaginate()`:
```typescript
const result = await Post
  .orderBy('createdAt', 'desc')
  .cursorPaginate({
    cursor: 'eyJpZCI6MTAwfQ==',  // Encoded cursor
    limit: 20,
  })

// result shape:
{
  data: Post[],
  meta: {
    hasMore: true,
    nextCursor: 'eyJpZCI6MTIwfQ==',
    prevCursor: 'eyJpZCI6ODB9',
  }
}
```
**Then** I get cursor-based pagination for infinite scroll

**Given** I'm building an API
**When** I paginate in a route handler:
```typescript
export const GET: RouteHandler = async ({ request }) => {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')

  const users = await User.paginate({ page, perPage: 20 })

  return Response.json(users)
}
```
**Then** the response includes data and pagination metadata

**Technical Notes:**
- Offset pagination: Simple but slow for large offsets
- Cursor pagination: Efficient for large datasets, requires ordered column
- Auto-generate pagination links with base URL
- Respect max page size limits

**Prerequisites:** Story 3.3

---

## Story 3.12: Multi-Tier Data Consistency

As a **developer**,
I want consistent data across storage tiers,
So that cached data stays in sync with the source of truth.

**Acceptance Criteria:**

**Given** data is cached in KV and stored in D1 (FR23)
**When** I update the D1 record:
```typescript
await product.update({ price: 29.99 })
```
**Then** the KV cache is invalidated immediately
**And** the next read returns fresh data

**Given** I need strong consistency (FR101)
**When** I configure strong consistency:
```typescript
export const Inventory = defineModel('inventory', {
  productId: field.integer().primaryKey(),
  quantity: field.integer(),
}, {
  consistency: 'strong',  // Use Durable Objects
})

// Operations are strongly consistent
await Inventory.decrement(productId, 'quantity', 1)
```
**Then** Durable Objects ensure strong consistency

**Given** eventual consistency is acceptable
**When** I configure eventual consistency:
```typescript
export const PageView = defineModel('page_views', {
  pageId: field.string().primaryKey(),
  count: field.integer(),
}, {
  consistency: 'eventual',  // Use KV with periodic D1 sync
})
```
**Then** writes go to KV first, syncing to D1 periodically

**Given** I want to coordinate across storage tiers
**When** data changes:
```typescript
// Framework handles:
// 1. Write to D1 (source of truth)
// 2. Invalidate KV cache
// 3. Broadcast to DOs if subscribed
// 4. Optional: write-through to KV for hot data
```
**Then** all tiers stay synchronized

**Technical Notes:**
- D1 is always source of truth for relational data
- KV for read caching and session-like data
- DO for strong consistency and real-time coordination
- Write-through vs write-behind strategies configurable

**Prerequisites:** Story 3.5, Story 3.6

---

**Epic 3 Complete: EdgeRecord ORM & Data Layer**

**Stories Created:** 12
**FR Coverage:** FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR101, FR125, FR126, FR127, FR148, FR150, FR151, FR152, FR166, FR176
**Technical Context Used:** Drizzle-style schemas, automatic tier selection, cache strategies, D1/KV/DO coordination
**UX Patterns Incorporated:** First-Time Setup Flow stage 4 (First Database Query), query response <10ms

---
