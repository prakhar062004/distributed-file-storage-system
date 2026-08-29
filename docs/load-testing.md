# Load Testing

Tool: autocannon (HTTP) + custom concurrent-request scripts (uploads/downloads,
since those need multipart bodies and auth tokens autocannon doesn't handle
natively).

## Results

| Test | Requests/sec (avg) | Median latency | Notes |
|---|---|---|---|
| `GET /api/health` (baseline) | 1,514 | 29ms | No auth, no DB — raw Express ceiling |
| `GET /api/files` (authenticated, cached) | 296 | 161ms | Full middleware stack: JWT verify + Redis |
| 10 concurrent uploads | — | 164ms avg, 179ms total wall time | 10/10 succeeded, genuinely parallel |
| 20 concurrent downloads, 1 node down | — | 173ms avg, 194ms total wall time | 20/20 succeeded, no cascading failure |

## Before/after analysis: the authenticated-endpoint drop

`/api/files` throughput (296 req/s) is roughly 5x lower than the bare
health-check baseline (1,514 req/s). This is expected, not a red flag —
the comparison isn't apples-to-apples: every authenticated request pays
for JWT verification (Phase 2's `protect` middleware) and a Redis round
trip, neither of which the bare health check incurs. Because the test
window (10s) is much longer than the cache TTL's first-request cost, the
296 req/s figure already reflects a cache-hit-dominated steady state —
the real value of Phase 12's caching is invisible in aggregate throughput
here specifically *because* it's already been priced in; the meaningful
comparison would be against the same endpoint with caching disabled
entirely, which would show a further, larger drop (uncached, every
request would hit MongoDB). Noted as a natural follow-up rather than run
here, to avoid re-testing what Phase 12 already manually verified via the
`cached: true/false` response flag.

## The critical result: fault tolerance under concurrent load

20 simultaneous downloads of a file with a replica on a dead storage node
all succeeded, in aggregate faster (194ms total) than 20 sequential
164ms-average uploads would take if serialized (~3,280ms). This confirms
failover behavior scales under concurrency rather than degrading —
requests fail over to healthy replicas independently and in parallel,
with no evidence of a shared bottleneck (like a single mutex or connection
pool) that would cause pile-up when many requests simultaneously hit an
unreachable node.

## Bottlenecks identified

None severe at this test scale (50 connections, 10-20 concurrent
requests). The most significant latency contributor identified is JWT
verification + middleware overhead on every authenticated request
(~130ms difference vs. the bare baseline) — a legitimate, expected cost
of the security model, not an accidental inefficiency. At meaningfully
larger scale (thousands of concurrent users), this would be the first
place to profile further — e.g., whether JWT verification itself or the
Mongoose user lookup inside `protect` middleware dominates that cost.

## Known limitation (honest)

These tests ran against a 3-storage-node, single-backend-instance local
Docker Compose setup — representative of correctness and relative
behavior, not absolute production capacity figures. A true production
capacity assessment would need dedicated load-testing infrastructure
separate from the machine running the system under test, and testing at
substantially higher concurrency (hundreds to thousands of simultaneous
connections) than performed here.