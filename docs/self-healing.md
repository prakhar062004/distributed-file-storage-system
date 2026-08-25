# Automatic Failure Recovery (Self-Healing)

## Mechanism

A background recovery loop runs every `RECOVERY_INTERVAL_MS` (default 20s)
inside the backend process. Each cycle:

1. Fetches current node health from Phase 10's health service.
2. Queries MongoDB for any `Chunk` whose `storageLocations` includes an
   unhealthy node.
3. For each affected chunk, fetches a verified-good copy (checksum-checked,
   reusing Phase 9's verification) from a surviving healthy replica.
4. Writes that copy to a different healthy node that doesn't already hold
   the chunk.
5. Updates `storageLocations` to reflect the new, restored state — dropping
   the dead node's entry and adding the new one.

A manual trigger endpoint (`POST /api/nodes/recover`) also exists for
on-demand recovery and testing, independent of the timer.

## Verified with a real, unattended recovery (not simulated)

A file was uploaded with replication factor 2, landing on node-2 and
node-3. Node-2 was killed via Ctrl+C. Within one recovery cycle — with
**no manual intervention** — the chunk was automatically re-replicated to
node-1, restoring full redundancy across node-1 and node-3. The file
remained fully downloadable throughout, and the manual `/recover` trigger,
run afterward, correctly reported nothing left to repair — confirming the
automatic background cycle had already completed the job on its own.

## Design decisions and honest simplifications

- **Eventual, not instant, consistency**: recovery happens on the next
  cycle, not the instant a node is marked unhealthy. A chunk can run at
  reduced redundancy for up to `RECOVERY_INTERVAL_MS` after a failure —
  an accepted, bounded trade-off, not a flaw (the same approach HDFS uses
  for under-replicated block re-replication).
- **Target node selection is simplified**: recovery picks *any* healthy
  node that doesn't already hold the chunk, rather than strictly the
  ring-correct node consistent hashing would originally choose. A more
  complete implementation would prefer restoring the exact original
  hash-ring placement where possible.
- **In-process timer, not a job queue** (yet): this phase implements
  recovery as a `setInterval` inside the backend process. Phase 13
  (background workers/BullMQ) will move this to a proper job queue with
  retries and backoff — the recovery *logic* built here stays the same,
  only *how the work gets scheduled and retried* changes.
- **True data-loss case is logged, not silently ignored**: if every
  replica of a chunk is simultaneously unhealthy, recovery cannot proceed
  and this is logged loudly as an at-risk condition rather than failing
  silently.