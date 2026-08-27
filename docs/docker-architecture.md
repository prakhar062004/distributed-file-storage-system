# Dockerization

## What's containerized

Seven services, one `docker-compose.yml`, started with `docker compose up -d`:
- `mongodb`, `redis` — official images, named volumes for persistence
- `storage-node-1/2/3` — same custom image, built once, three differently-configured
  containers (distinct `PORT`/`NODE_ID` via environment variables)
- `backend` — custom Node image
- `frontend` — multi-stage build (Node to build the Vite app, then a minimal
  nginx image to serve the static output — no Node/npm in the final image)

## Service discovery

Containers reach each other by service name over Docker's internal network,
not `localhost` — e.g. `http://backend:5000`, `http://storage-node-1:5001`.
This is real service discovery, not a simulation.

## Real bugs found and fixed while containerizing (this is the honest,
valuable part of this phase)

1. **BullMQ hardcoded `localhost:6379`** — the main `ioredis` client used
   `REDIS_URL` correctly (already environment-aware from Phase 12), but
   BullMQ's separate connection config in `storageQueue.js` was hardcoded
   and never updated for Docker. Fixed by reading `REDIS_HOST`/`REDIS_PORT`
   from environment, defaulting to `localhost` for local dev.

2. **Storage node URLs hardcoded to `localhost`** — `storageNodes.js`
   (from Phase 7) assumed `localhost:5001/5002/5003`, which only resolves
   correctly when everything runs on one machine outside Docker. Fixed
   with a `RUNNING_IN_DOCKER` flag that switches between `localhost` URLs
   (local dev) and Docker service names (`storage-node-1`, etc.).

3. **Slow failover on a dead node** — without an explicit request timeout,
   axios calls to a stopped container's port waited on the OS's default
   (much longer) TCP timeout before failing over to the next replica.
   Fixed with an explicit `NODE_REQUEST_TIMEOUT_MS` (default 3000ms) on
   every storage-node HTTP call — fast enough for responsive failover,
   long enough to avoid false failovers on a merely-slow (not dead) node.

4. **YAML syntax error** — a missing `- ` list-item prefix under
   `environment:` broke Compose's parser entirely (`services.backend.environment
   must be a mapping`). A reminder that YAML's whitespace/list syntax is
   unforgiving and worth double-checking after any manual edit.

5. **Attached vs. detached mode** — `docker compose up` (no flag) runs in
   the foreground and stops the entire stack if that terminal is closed.
   `docker compose up -d` runs detached, surviving independently of any
   particular terminal session — the correct mode for anything beyond
   momentary interactive debugging.

## Verified end-to-end through the full containerized stack

Registered, logged in, uploaded, and downloaded a file entirely through
the browser talking to the nginx-served frontend container, which called
the backend container, which coordinated with MongoDB, Redis, and all
three storage-node containers. A storage node container was then stopped
mid-session (`docker stop storage-node-2`) and a file with a replica on
it was downloaded successfully via the surviving replicas — the same
fault-tolerance guarantee from Phase 8/11, now proven across genuine
container process boundaries instead of manually-managed terminals.