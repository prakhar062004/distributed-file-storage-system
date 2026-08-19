# Distributed File Storage System

A production-style, resume-worthy distributed file storage system built with the MERN stack.

## Status: Phase 0 - Project Planning Complete

## What is this?
A simplified distributed object storage system. Files are chunked, distributed across
multiple independent storage nodes, replicated for fault tolerance, and continuously
health-checked with automatic failure recovery.

## Why distributed?
- Multiple independent storage nodes doing the same job, not one server with subfolders
- No single point of failure for data (replication)
- Coordination without a central bottleneck in the data path

## Functional Requirements
- User auth (register/login, JWT)
- Chunked file upload/download with streaming
- File metadata, folders, sharing with permissions
- Distributed chunk placement across storage nodes
- Chunk replication
- Node health monitoring via heartbeats
- Automatic replica recovery on node failure
- Checksum-based integrity verification

## Non-Functional Requirements
- Tolerate at least 1 storage node failure without data loss
- Streaming uploads (no full in-memory buffering)
- Eventual consistency for replica repair
- Structured logging for key events

## Tech Stack
- Frontend: React, Vite, Tailwind CSS, Axios, React Router
- Backend: Node.js, Express
- Database: MongoDB, Mongoose
- Cache/Coordination: Redis
- Queue: BullMQ
- Storage: Custom distributed storage-node services
- Containerization: Docker, Docker Compose

## Architecture
See docs/architecture.md (added in later phases)

## Development Phases
This project is built incrementally, one feature per commit. See commit history
and docs/ for details as each phase lands.
