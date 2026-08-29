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
