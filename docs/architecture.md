# Architecture

## Storage Nodes (Phase 5)

Storage nodes are independent Express services with no knowledge of users, files,
authentication, or MongoDB. Each node only understands "chunks" — opaque binary
blobs identified by a chunkId — and exposes a minimal internal API:

- `POST /internal/chunks` — store a chunk (chunkId provided by caller, or generated)
- `GET /internal/chunks/:chunkId` — retrieve a chunk
- `DELETE /internal/chunks/:chunkId` — delete a chunk
- `GET /internal/health` — report node status

### Why this separation matters

The backend API (`server/`) never writes file bytes to its own disk once storage
nodes are in use — it becomes a *client* of each storage node, communicating over
HTTP exactly like the frontend communicates with the backend. This symmetry is
deliberate: every layer of the system is independently replaceable because layers
only depend on each other's HTTP contracts, never shared code or shared filesystem
state.

### Verified independence

Three storage node instances were run simultaneously on ports 5001, 5002, and 5003,
each with isolated on-disk storage. A chunk stored on Node 2 was confirmed
retrievable from Node 2 and *not found* on Node 1 — proving nodes do not share
state and genuinely operate as independent services.

### What's NOT implemented yet (by design, staged for later phases)

- The backend does not yet decide *which* node a chunk should go to (Phase 7 —
  Storage Node Selection)
- No file is chunked yet — files still upload whole to local disk in Phase 4's flow
  (Phase 6 — File Chunking)
- No replication — a chunk currently lives on exactly one node with no backup
  (Phase 8 — Replication)
- No failure detection — if a node goes down, nothing currently notices
  (Phase 10 — Heartbeats)

### Known implementation detail: multipart field ordering

When storing a chunk via `multipart/form-data`, the `chunkId` field must be sent
*before* the `chunk` file field — multer processes fields in arrival order, and
the filename callback needs `chunkId` already parsed. This will be handled
carefully when the backend coordinator (Phase 7) constructs these requests
programmatically.