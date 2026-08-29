# Distributed File Storage System

A production-style distributed file storage system built with the MERN stack — files are chunked, distributed across independent storage nodes, replicated for fault tolerance, continuously health-monitored, and automatically self-healing after node failures.

Built incrementally, phase by phase, with every distributed-systems claim backed by a real, reproducible test — including deliberately killing live processes and containers to prove failure recovery actually works, not just that it was designed to.

---

## 1. Project Overview

This system is a simplified version of what powers real distributed object storage (think: the storage layer underneath Dropbox or S3) — not a file-upload app with extra steps, but a genuinely distributed system where:

- Files are split into chunks and spread across multiple independent storage-node processes
- Each chunk is replicated across nodes, so losing any single node doesn't lose data
- The system detects node failures on its own, without anyone manually checking
- Under-replicated chunks are automatically repaired in the background, restoring full redundancy without human intervention

Every one of those properties has been demonstrated with a real test — a real process killed with `Ctrl+C`, a real Docker container stopped with `docker stop`, a real corrupted byte written directly to disk — and the system verified to recover correctly each time.

## 2. Features

- User authentication (JWT, bcrypt password hashing)
- Chunked file upload/download with streaming (constant memory regardless of file size)
- Distributed chunk placement via consistent hashing
- Configurable replication (default factor: 2)
- SHA-256 checksum verification with automatic fallback to a healthy replica on corruption
- Proactive node health monitoring via heartbeats
- Automatic replica recovery after node failure — no manual intervention required
- Redis-backed caching, distributed locking, and ephemeral state tracking
- BullMQ-based background job queue with retries and exponential backoff
- File sharing with tiered permissions (READ / WRITE / OWNER)
- Full Docker Compose deployment (7 services, one command)
- Automated test suite (Jest + Supertest)
- Structured logging (Winston)
- Load-tested for concurrent uploads/downloads and failure-under-load behavior

## 3. Tech Stack

**Frontend:** React, Vite, Tailwind CSS, Axios, React Router
**Backend:** Node.js, Express
**Database:** MongoDB, Mongoose
**Cache / Coordination:** Redis (ioredis)
**Queue:** BullMQ
**Storage:** Custom distributed storage-node services (independent Node/Express processes)
**Containerization:** Docker, Docker Compose
**Testing:** Jest, Supertest, mongodb-memory-server, autocannon
**Logging:** Winston

## 4. Architecture
                     CLIENT (React + Vite, served via nginx)
                        |
                        v
                  Backend API (Express)
                   /        \
                  /          \
                 v            v
          MongoDB           Redis
       (metadata:            (health cache,
    users/files/chunks)       locks, caching,
                 |             upload state)
                 v
         Storage Coordinator
      (consistent hashing + replication)
                 |
    +------------+------------+
    |            |            |
    v            v            v
              Background Workers (BullMQ)
       — recovery cycles, retries, backoff
       
**Key architectural decision:** the backend never stores file bytes on its own disk in the running system — it's purely a coordinator. Storage nodes are independent, interchangeable, dumb byte-stores with zero knowledge of users, files, or MongoDB. This separation is what makes replication, failure detection, and self-healing possible at all.

## 5. Component Diagram

| Component | Responsibility |
|---|---|
| **Backend API** | Auth, metadata CRUD, chunk placement decisions, orchestrates storage-node communication |
| **Storage Node** (×3) | Stores/retrieves/deletes chunks by ID, reports health via heartbeat — knows nothing about users or files |
| **MongoDB** | Source of truth for metadata: users, files, chunks, replica locations |
| **Redis** | Node health state, file-list cache, distributed locks, ephemeral upload-progress state |
| **BullMQ Worker** | Runs recovery cycles as durable, retryable background jobs |
| **Frontend** | Upload/browse/share files; live node-health dashboard |

## 6. Upload Flow

1. Client sends file via `multipart/form-data` to `POST /api/files/upload`
2. Multer stages the whole file temporarily on the backend's disk
3. Backend streams the temp file, splitting it into fixed-size chunks (default 1MB, configurable)
4. For each chunk: consistent hashing selects `REPLICATION_FACTOR` target nodes; chunk is sent to all of them in parallel (`Promise.allSettled` — succeeds if at least one write confirms)
5. SHA-256 checksum computed and stored per chunk
6. Chunk metadata (`chunkId`, `fileId`, `chunkIndex`, `checksum`, `storageLocations`) written to MongoDB
7. Temp whole-file copy deleted; only chunks persist, spread across nodes
8. File status: `uploading` → `processing` → `available` (or `failed`, tracked honestly)

## 7. Download Flow

1. Backend fetches all `Chunk` records for the file, sorted by `chunkIndex`
2. For each chunk, tries each node in `storageLocations` in order:
   - Fetches the chunk's bytes
   - Recomputes its checksum and compares against the stored value
   - If corrupted or unreachable, silently tries the next replica
3. Streams each verified-good chunk directly into the HTTP response, in order
4. If every replica for any chunk is exhausted, the download fails with a clear error rather than silently returning bad or incomplete data

## 8. Chunking Strategy

Files are streamed (never fully buffered) and split via a `while` loop draining a rolling buffer — necessary because a single stream `data` event can contain more bytes than one chunk's worth. Chunk size is configurable via `CHUNK_SIZE` env var. Peak memory usage during chunking stays roughly bounded by chunk size, regardless of total file size — verified by successfully chunking files well beyond available RAM without memory growth.

## 9. Replication Strategy

Each chunk is written to `REPLICATION_FACTOR` distinct nodes, selected via a consistent-hashing ring with 100 virtual nodes per physical node (for even distribution). Writes happen in parallel; a chunk is considered successfully stored if **at least one** replica confirms — `storageLocations` only ever reflects nodes that actually confirmed the write, never nodes merely attempted.

**Verified with a real test:** a storage node was killed mid-session (`Ctrl+C`) while it held one of a file's two replicas. The file remained fully downloadable via its surviving replica, with zero user-visible errors.

## 10. Failure Recovery

Three layers working together:

1. **Heartbeats** (Phase 10) — each storage node reports to the backend every 5s; a node is marked `unhealthy` if no heartbeat arrives within the configured timeout (Redis TTL-backed, self-cleaning)
2. **Recovery cycle** (Phase 11) — runs automatically every 20s (via a durable BullMQ repeatable job, Phase 13): finds chunks with a replica on an unhealthy node, fetches a verified-good copy from a surviving replica, writes it to a new healthy node, restores full replication factor
3. **Distributed lock** (Phase 12) — guarantees overlapping recovery cycles (the automatic timer and a manual trigger) never run concurrently and double-repair the same chunk

**Verified with a real, unattended test:** a storage node was killed. Within one recovery cycle — with zero manual intervention — the affected chunk was automatically re-replicated to a different healthy node. The file remained downloadable throughout.

## 11. Database Design

**User:** name, email (unique, indexed), password (bcrypt hash, `select: false`)
**File:** name, originalName, size, mimeType, ownerId (indexed), status (enum), checksum, folderId
**Chunk:** chunkId (unique), fileId (indexed), chunkIndex, size, checksum, storageLocations (array)
**Share:** fileId, userId, permission (READ/WRITE), grantedBy — compound unique index on `{fileId, userId}`

Metadata is deliberately separated from file bytes — MongoDB has a 16MB document size limit and isn't optimized for large binary blobs; storage nodes handle bytes, MongoDB handles structure and relationships. See `docs/database-design.md` for full field-level rationale.

## 12. API Documentation

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Get JWT |
| GET | `/api/auth/me` | ✓ | Current user |
| POST | `/api/files/upload` | ✓ | Upload (chunked, replicated) |
| GET | `/api/files` | ✓ | List own files (Redis-cached) |
| GET | `/api/files/:id` | ✓ (READ) | File metadata |
| GET | `/api/files/:id/download` | ✓ (READ) | Download (reconstructed) |
| GET | `/api/files/:id/verify` | ✓ (READ) | Per-replica integrity report |
| DELETE | `/api/files/:id` | ✓ (owner) | Delete file + all replicas |
| POST | `/api/files/:fileId/share` | ✓ (owner) | Grant access |
| DELETE | `/api/files/:fileId/share/:userId` | ✓ (owner) | Revoke access |
| GET | `/api/files/shared-with-me` | ✓ | Files shared with you |
| GET | `/api/nodes/status` | ✓ | Live node health |
| POST | `/api/nodes/recover` | ✓ | Manually enqueue a recovery job |

## 13. Redis Usage

Four distinct, justified roles — not decoration. See `docs/redis-usage.md` for full detail:
1. Node health tracking (TTL-backed heartbeat state)
2. File-list caching with explicit invalidation on write
3. Distributed locking for the recovery cycle (atomic `SET NX`, token-verified release)
4. Ephemeral in-progress upload state

## 14. Queue/Worker Architecture

BullMQ, Redis-backed. Recovery runs as a durable repeatable job (survives backend restarts, unlike the `setInterval` it replaced) with `attempts: 3` and exponential backoff. A manual trigger endpoint enqueues the same job type on demand, returning `202 Accepted` + `jobId` — correctly honest async semantics, not a fake synchronous response.

## 15. Docker Architecture

Seven services, one `docker-compose.yml`, `docker compose up -d`: MongoDB, Redis, three storage-node containers (same image, different env vars), backend, and an nginx-served multi-stage-built frontend. Containers communicate via Docker's internal service discovery (`http://backend:5000`), not `localhost`. See `docs/docker-architecture.md` for the real bugs found and fixed while containerizing (hardcoded localhost URLs, a missing YAML list prefix, slow failover before an explicit request timeout was added).

## 16. Scalability

- **Horizontal storage scaling**: adding a 4th storage node only reshuffles a small fraction of existing chunk placements, thanks to consistent hashing — not a full data migration
- **Read scaling**: Redis caching reduces MongoDB load for repeated reads
- **Async work isolation**: recovery/repair work runs via a job queue, decoupled from user-facing request latency
- **Known current limits** (honest): single backend instance, single MongoDB/Redis instance — a production deployment would need MongoDB replica sets, Redis Cluster/Sentinel, and multiple backend instances behind a load balancer, none of which are implemented here (correctly scoped out as beyond this project's goals)

## 17. Fault Tolerance

Every fault-tolerance claim in this README has a corresponding real test, not just a design intention:
- Node failure → verified via killing a live process and a live Docker container, confirming downloads still succeed
- Data corruption → verified by overwriting real bytes on disk and confirming automatic detection + fallback
- Concurrent failure under load → verified via 20 simultaneous downloads succeeding while a node was down

## 18. Security

- Bcrypt password hashing, JWT auth, `select: false` on password field
- Anti-enumeration: identical error for "wrong password" and "unknown email"
- 404 (not 403) for unauthorized file access — no existence leakage
- Path-traversal protection: randomly generated storage filenames, never user-controlled
- File size limits (multer)
- CORS restricted to a known origin
- No secrets committed to git (`.env` gitignored everywhere, `.env.example` documents required vars)
- **Known, honestly-documented gap**: the storage-node `/internal/heartbeat` endpoint has no authentication — a production system would need service-to-service auth (internal API key or mTLS) distinct from user-facing JWT

## 19. Performance

See `docs/load-testing.md` for full results. Headline findings: 10 concurrent uploads and 20 concurrent downloads (with a node down) both completed with 100% success and genuine parallelism (not serialization) — the most important result being that failover behavior doesn't cascade or degrade under concurrent load.

## 20. Future Improvements

- Service-to-service authentication between backend and storage nodes
- MongoDB replica set + Redis Cluster for the metadata/cache layer itself
- Multiple backend instances behind a load balancer
- Ring-position-aware recovery (currently picks any healthy node, not strictly the hash-ring-correct one)
- End-to-end test suite with real storage-node servers (current automated tests cover auth/permissions/hashing logic; full upload→replicate→download flow is covered by extensive manual/chaos testing instead)
- Metrics aggregation (Prometheus-style) and distributed tracing (OpenTelemetry) alongside the structured logging already in place
- Wired-up download action on the Shared Files page (backend already supports it via permission checks)

---

## Getting Started

**Requirements:** Docker Desktop, Node.js 20+, Git

```bash
git clone https://github.com/prakhar062004/distributed-file-storage-system.git
cd distributed-file-storage-system
cp .env.example .env   # set a real JWT_SECRET
docker compose up -d --build
```

Open `http://localhost:5173`.

**Run tests:**
```bash
cd server && npm test
```

**Run load tests:**
```bash
cd server && node loadtests/health-check.js
```

---

## Documentation Index

Detailed design docs live in `docs/`: architecture, database design, upload/download flow, chunk placement, replication, data integrity, health monitoring, self-healing, Redis usage, queue architecture, authorization, Docker architecture, testing, load testing, monitoring/logging, and frontend dashboard design.
