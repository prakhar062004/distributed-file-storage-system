# Monitoring & Logging

## Stack

Winston, structured JSON logging with a human-readable console formatter
layered on top for local development. File transports (`logs/error.log`,
`logs/combined.log`) activate only in production.

## What's instrumented

- **Every HTTP request** — method, path, status code, duration, userId
  (via `requestLogger` middleware), with severity derived from status
  code (5xx → error, 4xx → warn, else info).
- **Uploads** — success (fileId, chunkCount, sizeBytes) and failure.
- **Downloads** — start event with chunk count; corruption detection
  logs the specific chunk and node when a checksum mismatch occurs.
- **Node health** — a node having no heartbeat, or an overdue heartbeat,
  each logged with context. Healthy checks are deliberately NOT logged
  per-poll — logging every routine success would drown the log stream in
  noise for the expected, boring case. Only anomalies are worth a log line.
- **Recovery cycles** — unhealthy nodes detected, chunks repaired, chunks
  that couldn't be repaired (logged as `error` — genuine data-at-risk
  conditions), all with chunkId/fileId/node context.
- **Background worker jobs** — job processing start, completion, and
  failure (with retry count), via BullMQ's event hooks.
- **All errors** — centralized in `errorHandler.js`, logged with the
  triggering HTTP method/path and authenticated user, before responding.

## Logs vs. metrics vs. tracing (honest scope)

This project implements structured **logging** thoroughly. It does not
implement dedicated **metrics** aggregation (e.g., Prometheus counters/
histograms) or distributed **tracing** (e.g., OpenTelemetry spans across
the backend → storage node hop) — both are real, valuable, and genuinely
larger undertakings than this project's scope. The Node Status dashboard
page (Phase 17) provides a lightweight, metrics-*shaped* view (live counts,
disk usage) but is not a substitute for a proper metrics/alerting pipeline.

## Real bug caught while instrumenting this phase

While adding logging to `verifyFileIntegrity`, discovered the function
was missing `const chunks = await Chunk.find(...)` entirely — it
referenced `chunks` in its loop without ever fetching them, which would
have thrown a `ReferenceError` on any real call to `GET /api/files/:id/verify`.
Fixed as part of this phase. A good example of how revisiting code for
one purpose (logging) can surface unrelated latent bugs through simple
re-reading.

## Production integration point (not implemented, noted honestly)

In a real deployment, Winston's JSON output would typically be shipped to
a log aggregation/alerting service (Datadog, CloudWatch Logs, ELK stack,
or an error-specific service like Sentry) rather than living only in
local files or container stdout. The structured format here is exactly
what such services expect to ingest — this phase builds the foundation,
not the shipping integration itself.