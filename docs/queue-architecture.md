# Background Workers & Job Queue

## Migration from setInterval to BullMQ

Phase 11 implemented recovery as an in-process `setInterval`. This phase
replaces *only the scheduling mechanism* with BullMQ (Redis-backed) —
`runRecoveryCycle` and `repairChunk` themselves are completely unchanged,
proving the earlier phase's logic was already correctly decoupled from
how it gets invoked.

## Producer / Consumer

- **Producer**: the recurring scheduler (`scheduler.js`) and the manual
  `/api/nodes/recover` endpoint both enqueue `RUN_RECOVERY_CYCLE` jobs.
- **Consumer (Worker)**: `storageWorker.js` picks jobs off the
  `storage-jobs` queue and dispatches by job name to the appropriate
  service function.

## Retry, backoff, and failure handling

Jobs are configured with `attempts: 3` and exponential backoff
(`{ type: 'exponential', delay: 2000 }`) — a transient failure (e.g., Redis
briefly unreachable) gets retried with increasing delay rather than either
giving up immediately or retrying at full speed. Failed jobs (after
exhausting retries) remain inspectable in Redis rather than disappearing
silently — a real, if simple, dead-letter mechanism.

## Verified durability across a server restart

The backend was restarted mid-session (via nodemon / manual `npm run dev`)
between two manual recovery triggers. The recurring job schedule survived
the restart without duplication (thanks to a stable `jobId`), and a
manually-enqueued job (job 9) was correctly picked up and processed by the
freshly-started worker — demonstrating the durability an in-memory
`setInterval` could never provide.

## Idempotency

Recovery jobs are safe to run more than once with the same outcome:
`repairChunk` checks `survivingLocations.length >= REPLICATION_FACTOR`
before doing any work, so a redundant or retried job simply finds nothing
to do rather than causing incorrect over-replication or errors. This
property was actually established back in Phase 11, unmodified here.

## Response semantics: 202 Accepted

`POST /api/nodes/recover` now returns `202 Accepted` with a `jobId`,
not `200 OK` with a result — since the work is now asynchronous and may
not complete by the time the HTTP response is sent, `202` accurately
communicates "accepted for processing" rather than falsely implying
completion.

## Scope note: worker runs in-process (honest simplification)

The worker currently runs inside the same Node process as the API server
— acceptable for this project's scale. A production system would
typically run workers as separate processes/containers so heavy job
processing can't compete with API request handling for CPU/event-loop
time. Phase 15's Docker Compose setup could split these into separate
services as a natural extension.