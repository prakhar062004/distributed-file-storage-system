# Node Heartbeats & Health Monitoring

## Mechanism

Each storage node sends a heartbeat (nodeId, disk stats, timestamp) to
`POST /api/nodes/heartbeat` every `HEARTBEAT_INTERVAL_MS` (default 5s).
The backend records each heartbeat in Redis, keyed by nodeId, with a TTL
of double the health-check timeout — stale entries clean themselves up
automatically without a dedicated cleanup job.

## Why Redis for this data

Heartbeats are frequent, ephemeral, and only meaningful if recent — a poor
fit for MongoDB's durability-oriented writes. Redis's in-memory speed and
native key expiry (TTL) make it the natural fit for "data that matters only
if it's fresh."

## Failure detection is inference, not certainty

A node is classified `unhealthy` when its last heartbeat is older than
`HEARTBEAT_TIMEOUT_MS` (default 15s) — this is inferred from *absence* of
signal, not an explicit failure report (a truly failed node usually can't
report its own failure). This creates an inherent trade-off:

- Too aggressive a timeout → false positives (briefly slow/busy nodes
  wrongly marked unhealthy)
- Too lenient a timeout → slow detection of real failures

This reflects a known result in distributed systems theory: in an
asynchronous network, a failure detector cannot be both perfectly accurate
and instantly fast — some trade-off is unavoidable, not a flaw specific to
this implementation.

## Verified with a real kill, not simulated

Node 2 was killed via Ctrl+C mid-session. Node status API showed it flip
to `unhealthy` automatically within the timeout window, with zero manual
intervention or chunk operation triggering the check — proactive detection,
not reactive discovery. Restarting the node caused it to be marked
`healthy` again once heartbeats resumed.

## Known simplification (honest note)

The `/api/nodes/heartbeat` endpoint has no authentication — any client
could post fake heartbeats. In a production system, node-to-backend calls
would need their own auth mechanism (e.g. a shared internal API key or
mTLS), distinct from user-facing JWT auth. This is flagged as a known,
deliberate simplification for this project's scope, not an oversight.

## What this phase does NOT yet do

Detection alone doesn't fix anything — an unhealthy node's chunks are
still only as available as their surviving replicas allow, and nothing
yet acts on an unhealthy node's under-replicated chunks. Phase 11
(automatic failure recovery) uses this health data to actually repair
lost redundancy.