# System-Level Test Design - Ixflare Framework

**Date:** 2025-12-04
**Author:** Yojahny (via TEA Agent - Murat)
**Status:** Draft
**Project:** Cloudfare Edge Fullstack Framework (Ixflare)
**Phase:** Solutioning (Phase 3 - Pre-Implementation Gate)

---

## Executive Summary

**Project Type:** Developer tool framework for Cloudflare Workers
**Architecture:** Monorepo with 4 packages targeting V8 isolates (edge runtime)
**Key Constraints:** <50KB bundle, <100ms cold start, NO Node.js APIs

**Testability Assessment:**
- Controllability: **PASS** with recommendations
- Observability: **PASS** with recommendations
- Reliability: **CONCERNS** - Edge runtime simulation gap

**Risk Summary:**
- Total ASRs identified: 12
- High-priority risks (score ≥6): 4
- Critical blockers (score = 9): 0

---

## Testability Assessment

### 1. Controllability: PASS with Recommendations

**Can we control system state for testing?**

| Aspect | Assessment | Evidence |
|--------|------------|----------|
| API seeding | ✅ PASS | EdgeRecord provides `seed` capabilities (FR126), factories supported |
| Database reset | ✅ PASS | D1 is SQLite-based, Miniflare provides local D1 simulation |
| External dependency mocking | ✅ PASS | Architecture defines clear package boundaries (`@worker-only`, `@node-only`) |
| Tier switching | ✅ PASS | EdgeRecord tier selection overridable per query (FR151) |
| Configuration injection | ✅ PASS | `edge.config.ts` with environment variable precedence (wrangler.toml → .env.production → .env.local → .env) |

**Recommendations:**
- Implement test fixture pattern for EdgeRecord with auto-cleanup (KV/D1/DO)
- Provide mock implementations for Cloudflare bindings in test environment
- Document tier isolation strategy for parallel test execution

### 2. Observability: PASS with Recommendations

**Can we inspect system state and validate behavior?**

| Aspect | Assessment | Evidence |
|--------|------------|----------|
| Logging | ✅ PASS | Hybrid structured logger with CF Analytics default (Core Architecture) |
| Stack traces | ✅ PASS | NFR-DX-9: Stack traces map to original TypeScript source |
| Query logging | ✅ PASS | NFR-DX-11: EdgeRecord query logs include execution time and tier |
| Error differentiation | ✅ PASS | NFR-DX-10: Logs differentiate framework vs user code errors |
| Deterministic results | ⚠️ CONCERNS | KV eventual consistency may cause non-deterministic test results |

**Recommendations:**
- Implement deterministic test modes for KV tier (wait for propagation or use D1/DO for test isolation)
- Add traceId propagation for distributed tracing in tests
- Include Server-Timing headers for performance assertions

### 3. Reliability: CONCERNS

**Are tests isolated and reproducible?**

| Aspect | Assessment | Evidence |
|--------|------------|----------|
| Parallel safety | ⚠️ CONCERNS | Multi-tier data (KV/D1/DO) requires careful isolation strategy |
| Failure reproduction | ⚠️ CONCERNS | Edge runtime differs from Miniflare simulation |
| Component coupling | ✅ PASS | Clean package boundaries with ESLint enforcement |
| State between requests | ✅ PASS | FR120: System warns on global state persistence attempts |

**Critical Concern: Edge Runtime Simulation Gap**
- Miniflare simulates Workers locally but may not perfectly match production V8 isolate behavior
- Cold start timing, memory limits, and CPU constraints differ between environments
- **Mitigation Required:** Staging environment tests with real Workers deployment

**Recommendations:**
- Implement burn-in testing strategy for flaky test detection
- Add staging environment smoke tests with real Cloudflare Workers
- Document known Miniflare vs production behavior differences

---

## Architecturally Significant Requirements (ASRs)

### High-Priority ASRs (Score ≥6)

| ASR ID | Requirement | Category | Probability | Impact | Score | Testing Challenge |
|--------|-------------|----------|-------------|--------|-------|-------------------|
| ASR-001 | Bundle size ≤50KB (NFR-PERF-13) | PERF | 3 | 3 | 9 | Build-time validation required, tree-shaking verification |
| ASR-002 | Cold start ≤100ms (NFR-PERF-6) | PERF | 2 | 3 | 6 | Real Workers deployment needed, Miniflare insufficient |
| ASR-003 | JWT token expiry 15m (Security) | SEC | 2 | 3 | 6 | Time manipulation in tests, clock mocking required |
| ASR-004 | EdgeRecord tier consistency (NFR-REL-5) | DATA | 2 | 3 | 6 | Multi-tier transaction testing, rollback verification |

### Medium-Priority ASRs (Score 3-5)

| ASR ID | Requirement | Category | Probability | Impact | Score | Testing Approach |
|--------|-------------|----------|-------------|--------|-------|------------------|
| ASR-005 | SSR render ≤200ms p50 (NFR-PERF-1) | PERF | 2 | 2 | 4 | k6 load testing with realistic component trees |
| ASR-006 | HMR ≤1s (NFR-PERF-9) | DX | 2 | 2 | 4 | Dev server timing tests with file watchers |
| ASR-007 | SQL injection prevention (Security) | SEC | 1 | 3 | 3 | OWASP security test suite |
| ASR-008 | Edge location distribution (NFR-SCALE-1) | SCALE | 1 | 2 | 2 | Manual staging validation |

### Low-Priority ASRs (Score 1-2)

| ASR ID | Requirement | Category | Probability | Impact | Score | Testing Approach |
|--------|-------------|----------|-------------|--------|-------|------------------|
| ASR-009 | CLI command ≤2s (NFR-PERF-7) | DX | 1 | 1 | 1 | Unit tests with timing assertions |
| ASR-010 | Documentation searchable ≤3s (NFR-DX-2) | DX | 1 | 1 | 1 | Future: Algolia/DocSearch integration |
| ASR-011 | Build ≤30s (NFR-PERF-10) | DX | 1 | 2 | 2 | CI build timing monitoring |
| ASR-012 | Type check ≤10s incremental (NFR-PERF-11) | DX | 1 | 1 | 1 | TSC timing in CI |

---

## Test Levels Strategy

Based on the Ixflare architecture (framework + CLI + build tools), here's the recommended test distribution:

### Recommended Split

| Level | Percentage | Rationale |
|-------|------------|-----------|
| **Unit** | 60% | Business logic in EdgeRecord, router, middleware, auth modules |
| **Integration** | 25% | Package interactions (CLI → runtime, vite-plugin → ixflare) |
| **E2E** | 15% | User journeys (create project → dev → build → deploy) |

### Level-Specific Guidance

**Unit Tests (60% - ~100 tests estimated for MVP)**
- EdgeRecord query builder, model validation, tier selection logic
- Router path matching, middleware chain execution
- JWT creation, verification, key rotation
- Config schema validation, environment variable loading
- Error class behavior, stack trace mapping

**Integration Tests (25% - ~40 tests estimated for MVP)**
- CLI commands executing against mock Miniflare environment
- Vite plugin integration with file-based routing codegen
- EdgeRecord CRUD operations across KV/D1/DO tiers
- SSR rendering with component trees
- Deployment pipeline (build → validate → upload)

**E2E Tests (15% - ~15 tests estimated for MVP)**
- `npm create ixflare` project scaffolding
- `ix dev` → make changes → HMR reflects changes
- `ix build` → bundle size validation → `ix deploy`
- Full user journey: create project → add route → add model → deploy

---

## NFR Testing Approach

### Security (NFR-SEC-1 through NFR-SEC-12)

| NFR | Testing Approach | Tools |
|-----|------------------|-------|
| NFR-SEC-1: Secrets encrypted at rest | Unit: verify encryption in config loader | Vitest |
| NFR-SEC-2: Secrets never logged | Integration: capture logs, assert no secrets | Vitest + log capture |
| NFR-SEC-5: Token expiry 90d | Unit: JWT expiry validation with clock mocking | Vitest + date-fns |
| NFR-SEC-7: Bearer token validation | Integration: API route auth middleware tests | Vitest + supertest |
| NFR-SEC-11: HTTPS enforcement | E2E: staging deployment verification | Playwright |
| NFR-SEC-12: Security headers | Integration: response header assertions | Vitest + supertest |

**Security Test Categories:**
- Authentication tests (JWT, OAuth flows)
- Authorization tests (RBAC + policies)
- Input validation (Zod schema enforcement)
- OWASP Top 10 (SQL injection, XSS in non-React contexts)

### Performance (NFR-PERF-1 through NFR-PERF-14)

| NFR | Testing Approach | Tools |
|-----|------------------|-------|
| NFR-PERF-1: SSR ≤200ms p50 | k6 load test on staging | k6 |
| NFR-PERF-6: Cold start ≤100ms | Staging Workers timing | Wrangler CLI + custom timing |
| NFR-PERF-8: Dev server ≤5s | Unit: startup timing in CI | Vitest + custom timers |
| NFR-PERF-12: Bundle ≤1MB | Build-time assertion | CI workflow + bundlesize |
| NFR-PERF-13: Core ≤50KB | Build-time assertion | CI workflow + bundlesize |
| NFR-PERF-14: Tree-shaking | Build analysis | rollup-plugin-visualizer |

**Performance Testing Levels:**
1. **Build-time** (CI): Bundle size, tree-shaking verification
2. **Dev-time** (Local): CLI command timing, HMR latency
3. **Production-simulation** (Staging): Cold start, SSR timing, API latency

**k6 Load Test Configuration (Recommended):**
```javascript
export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // SSR NFR
    errors: ['rate<0.01'],
  },
};
```

### Reliability (NFR-REL-1 through NFR-REL-12)

| NFR | Testing Approach | Tools |
|-----|------------------|-------|
| NFR-REL-2: Write durability | Integration: write → immediate read verification | Vitest + EdgeRecord |
| NFR-REL-3: Rollback ≤2min | E2E: deployment rollback timing | Playwright + Wrangler |
| NFR-REL-5: ACID across tiers | Integration: transaction tests with failure injection | Vitest |
| NFR-REL-8: Exception handling | Unit: error boundary coverage | Vitest |
| NFR-REL-9: Retry with backoff | Unit: retry logic assertions | Vitest + mock timers |

**Reliability Test Categories:**
- Error handling (graceful degradation, error boundaries)
- Retry mechanisms (EdgeRecord connection failures)
- Health checks (`/_health` endpoint validation)
- Data consistency (tier transition tests)

### Developer Experience (NFR-DX-1 through NFR-DX-15)

| NFR | Testing Approach | Tools |
|-----|------------------|-------|
| NFR-DX-1: Hello World ≤5min | E2E: timed user journey | Playwright |
| NFR-DX-4: Error messages actionable | Unit: error message assertions | Vitest |
| NFR-DX-5: Local = prod 95% | Integration: behavior comparison matrix | Vitest |
| NFR-DX-9: TS source maps | Integration: stack trace validation | Vitest |
| NFR-DX-14: Migration tools 100% | Unit: migration command coverage | Vitest |

---

## Test Environment Requirements

### Local Development (Miniflare)

| Component | Tool | Purpose |
|-----------|------|---------|
| Workers simulation | Miniflare | Local V8 isolate emulation |
| D1 database | SQLite (Miniflare) | Local D1 simulation |
| KV store | Miniflare KV | Local KV simulation |
| Durable Objects | Miniflare DO | Local DO simulation |
| Test runner | Vitest | Fast, ESM-native |
| E2E runner | Playwright | User journey validation |

### Staging Environment (Real Workers)

| Component | Purpose | Validation |
|-----------|---------|------------|
| Cloudflare Workers | Cold start timing, real V8 | NFR-PERF-6 |
| D1 production | Real D1 latency | NFR-PERF-4 |
| KV production | Real KV latency | NFR-PERF-3 |
| Edge locations | Distribution verification | NFR-SCALE-1 |

### CI/CD Environment (GitHub Actions)

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
      - run: pnpm test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
      - run: pnpm test:e2e

  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm build
      - run: npx bundlesize # Fail if >50KB

  staging-smoke:
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    steps:
      - run: wrangler deploy --env staging
      - run: pnpm test:smoke:staging
```

---

## Testability Concerns

### Concern 1: Miniflare vs Production Parity (MEDIUM)

**Issue:** Miniflare simulates Cloudflare Workers but may not perfectly match production behavior for:
- Cold start timing (Miniflare is faster)
- Memory limits (Miniflare doesn't enforce 128MB)
- CPU time limits (Miniflare doesn't enforce 50ms/30s)

**Risk Score:** 2 (Probability) × 2 (Impact) = 4

**Mitigation:**
- Implement staging smoke tests with real Workers deployment
- Document known differences in test documentation
- Add CI job for staging environment validation before release

### Concern 2: KV Eventual Consistency in Tests (MEDIUM)

**Issue:** KV tier has eventual consistency (60s propagation), which can cause flaky tests if:
- Write followed by immediate read
- Parallel tests share KV namespace

**Risk Score:** 2 × 2 = 4

**Mitigation:**
- Use D1 (strongly consistent) for test isolation by default
- Implement polling/retry helpers for KV consistency in tests
- Document test patterns that avoid KV consistency issues

### Concern 3: Durable Objects State Isolation (LOW)

**Issue:** Durable Objects maintain state across requests, requiring careful cleanup between tests.

**Risk Score:** 1 × 2 = 2

**Mitigation:**
- Implement DO cleanup fixtures in test setup
- Use unique DO IDs per test (e.g., `test-${testId}-${timestamp}`)
- Add afterEach cleanup in DO-related tests

---

## Recommendations for Sprint 0

### Test Framework Setup (`*framework` workflow)

1. **Vitest Configuration**
   - ESM-native, Miniflare integration
   - Coverage thresholds: 80% statements, 70% branches
   - Parallel execution with worker isolation

2. **Playwright Configuration**
   - Base URL: local dev server + staging
   - Screenshot/video capture on failure
   - Network interception for API mocking

3. **k6 Configuration**
   - Staging environment load tests
   - SLO thresholds from NFRs
   - CI integration with threshold enforcement

### CI Pipeline Setup (`*ci` workflow)

1. **Test Stages**
   - `lint` → `unit` → `integration` → `e2e` → `bundle-size` → `staging-smoke`

2. **Quality Gates**
   - P0 tests: 100% pass (no exceptions)
   - P1 tests: ≥95% pass
   - Bundle size: <50KB (fail build on exceed)
   - Coverage: ≥80% (warning <80%, fail <60%)

3. **Artifact Collection**
   - Test reports (HTML)
   - Coverage reports (Istanbul)
   - Bundle analysis (visualizer)
   - Performance baselines (k6 trends)

### Test Data Strategy

1. **Factory Functions**
   - `createUser()`, `createProduct()`, `createRoute()` with faker.js
   - Consistent across unit/integration/E2E

2. **Fixture Management**
   - Auto-cleanup via Vitest fixtures
   - Database seeding via API (fast, controlled)
   - Storage state reuse for auth (Playwright)

3. **Tier-Specific Patterns**
   - KV: Use deterministic keys, implement polling helpers
   - D1: Transaction isolation per test
   - DO: Unique IDs per test, explicit cleanup

---

## Quality Gate Criteria

### Implementation Readiness Gate (This Document)

- [x] Testability assessment complete (Controllability, Observability, Reliability)
- [x] ASRs identified and scored (12 ASRs, 4 high-priority)
- [x] Test levels strategy defined (60/25/15 split)
- [x] NFR testing approach documented (Security, Performance, Reliability, DX)
- [x] Environment requirements specified (Local, Staging, CI)
- [x] Testability concerns flagged with mitigations (3 concerns, all MEDIUM or LOW)
- [x] Sprint 0 recommendations provided

### Pre-Implementation Checklist

- [ ] Vitest + Miniflare configuration validated
- [ ] Playwright + staging environment access confirmed
- [ ] k6 + staging Workers deployment ready
- [ ] CI pipeline skeleton with test stages
- [ ] Factory functions for core entities (User, Route, Model)

---

## Appendix

### Knowledge Base References

- `nfr-criteria.md` - NFR validation approach (Security, Performance, Reliability, Maintainability)
- `test-levels-framework.md` - Test level selection guidance
- `risk-governance.md` - Risk classification and scoring
- `test-quality.md` - Quality standards and Definition of Done

### Related Documents

- PRD: docs/prd/
- Architecture: docs/architecture/
- UX Design: docs/ux-design-specification/
- Project Context: docs/project-context.md

---

**Generated by:** BMad TEA Agent - Test Architect Module (Murat)
**Workflow:** `.bmad/bmm/testarch/test-design`
**Version:** 4.0 (BMad v6)
