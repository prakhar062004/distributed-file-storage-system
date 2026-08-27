# Automated Testing

## Stack

Jest + Supertest, testing the Express `app` directly in memory (no real
network port bound) — enabled by the Phase 1 decision to separate `app.js`
from `server.js`. `mongodb-memory-server` provides a real, temporary,
disposable MongoDB instance per test run — genuine MongoDB behavior, fully
isolated from development/demo data.

## Coverage

- **Authentication** (8 tests): registration, duplicate email (409), missing
  fields (400), login success/failure, the anti-enumeration identical-error
  behavior, protected-route access with valid/missing/invalid tokens.
- **File authorization** (5 tests): auth requirement on upload, missing-file
  validation, empty listing for new users, 404 on nonexistent files,
  cross-user listing isolation.
- **Consistent hashing** (4 tests): deterministic key→node mapping, distinct
  replica selection, graceful handling when requesting more replicas than
  physical nodes exist, and critically — that removing a node does **not**
  reshuffle all existing key assignments, the core theoretical property
  consistent hashing exists to provide (Phase 7).
- **Sharing/permissions** (5 tests): validation ordering, invalid permission
  tiers rejected, missing-field validation, empty "shared with me" for
  non-recipients.

## A real bug this suite caught immediately

On first run, all 11 tests touching authenticated routes failed with 401s
cascading from a single root cause: `.env.test` wasn't being loaded, so
`JWT_SECRET` was `undefined` and `jsonwebtoken.sign()` threw internally,
turning registration into a 500 and every subsequent "authenticated" test
into `Authorization: Bearer undefined`. Fixed by explicitly loading
`.env.test` in `tests/setup.js`. This is a genuine example of what
automated tests are for — catching a real environment/config bug
immediately and precisely, rather than discovering it manually later.

## Known scope limitation (honest)

Full upload → chunk → distribute → replicate → download round-trip is
**not** covered by this automated suite — that would require real storage
node HTTP servers running during test execution, which our current
Jest setup doesn't provision. That entire flow has been extensively
verified through manual, real-infrastructure testing throughout Phases
4–15 (including killing real processes and containers to prove failure
recovery), which is a different, complementary kind of verification. A
genuine future improvement would be a separate end-to-end suite that
spins up real (or test-double) storage nodes alongside the test run.