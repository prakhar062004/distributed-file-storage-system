# Redis Usage

Redis is used for four distinct, architecturally-justified purposes in this
system — each chosen because the data involved is ephemeral, frequently
accessed, or requires coordination visibility across separate processes,
none of which fit MongoDB's durability-oriented design well.

## 1. Node health tracking (Phase 10)

Heartbeat timestamps per storage node, with TTL-based self-expiry. See
`docs/health-monitoring.md`.

## 2. Metadata caching

`GET /api/files` caches the user's file list for 30 seconds
(`files:list:{userId}`). Explicit invalidation (`del`) runs immediately
after upload and delete, so a user's own changes are never hidden behind
stale cache — the TTL is a safety net for missed invalidations, not the
primary correctness mechanism.

**Verified**: first list call showed `cached: false` (MongoDB read);
immediate second call showed `cached: true` (Redis read); upload
correctly invalidated the cache, and the very next list call showed
`cached: false` again with the new file present.

## 3. Distributed lock for recovery cycles

`lock:recovery-cycle`, acquired via atomic `SET key value NX` before each
recovery cycle runs, released via a token-check-then-delete pattern to
avoid a slow/crashed process deleting a lock it no longer owns. A 30s TTL
ensures a crashed lock-holder can never permanently block future recovery
cycles. This solves a genuine race condition: without it, the automatic
timer and a manual `/recover` call could overlap and both act on the same
under-replicated chunk simultaneously.

## 4. Temporary upload state

`upload:inprogress:{fileId}` tracks an upload from the moment chunking
starts until it completes, with a 5-minute safety TTL in case the process
crashes mid-upload. Exposed via `GET /api/files/uploads/in-progress` —
real, usable data for a future progress-indicator UI, not a placeholder.

## Design principle applied consistently across all four uses

Every Redis key in this system carries a TTL, even ones that are also
explicitly deleted at the "right" moment in code. This is deliberate
defense in depth: if an explicit cleanup path is ever missed (a crash,
an unhandled edge case), the TTL guarantees the system self-heals rather
than accumulating permanently stale state.