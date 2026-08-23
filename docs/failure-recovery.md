# Replication & Fault Tolerance

## Replication strategy

Each chunk is written to `REPLICATION_FACTOR` (default 2) distinct nodes,
selected via the consistent hash ring's clockwise walk (`getNodes`). Writes
happen in parallel via `Promise.allSettled` — a chunk is considered
successfully stored if at least one replica confirms, and `storageLocations`
on the Chunk document only ever reflects nodes that actually confirmed
success, never nodes we merely attempted.

## Read path with replica fallback

On download, each chunk's `storageLocations` are tried in order. The moment
one replica responds successfully, the loop moves to the next chunk — a
dead or unreachable replica is invisible to the end user as long as at
least one other replica is alive.

## Verified fault tolerance (real test, not simulated)

A 4-chunk file was uploaded with replication factor 2 (8 total chunk writes
across 3 nodes). One storage node process was then killed outright
(Ctrl+C, not a graceful shutdown). The file was downloaded again
immediately afterward and reconstructed byte-for-byte correctly — proving
the system tolerates a real node failure without data loss or user-visible
error, using only the mechanisms built in this phase.

## What replication does NOT yet solve (honest scope boundary)

- **No automatic detection of node failure** — nothing currently notices a
  node went down on its own; we only found out because we killed it
  ourselves and then tried to read. Phase 10 (heartbeats) adds real
  detection.
- **No automatic re-replication** — the chunk that lost a replica on the
  killed node is now running with *effectively* replication factor 1 until
  the dead node comes back or the chunk is manually re-replicated. Phase 11
  (automatic replica recovery) closes this gap.
- **No configurable read/write quorum** — we use "at least 1 of N succeeds"
  for writes and "first available" for reads, a simplified version of the
  quorum concept used in systems like Cassandra (which allow tunable W/R
  thresholds per operation).