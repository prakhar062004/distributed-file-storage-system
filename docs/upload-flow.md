# Upload & Chunking Strategy

## Flow

1. Client uploads a file via `multipart/form-data` to `POST /api/files/upload`.
2. Multer writes the whole file to a temporary location (`server/uploads/`).
3. The backend streams that temp file, splitting it into fixed-size chunks
   (configurable via `CHUNK_SIZE` env var, default 1MB).
4. Each chunk is written to `server/chunks/`, its SHA-256 checksum computed,
   and a `Chunk` document created in MongoDB (chunkId, fileId, chunkIndex,
   size, checksum, storageLocations).
5. The temporary whole-file copy is deleted — only chunks persist.
6. The `File` document's status transitions: uploading → processing → available
   (or failed, if chunking throws partway through).

## Streaming implementation detail

Chunking reads the source file via `for await (const data of readStream)`,
accumulating bytes into a buffer and draining complete `CHUNK_SIZE` pieces
in a `while` loop (not `if`) since a single stream event can contain enough
data for multiple chunks at once. Peak memory usage stays roughly bounded by
CHUNK_SIZE, regardless of total file size.

## Download / reconstruction flow

1. Fetch all `Chunk` documents for the file, sorted by `chunkIndex` ascending.
2. Stream each chunk's bytes into the HTTP response sequentially, awaiting
   each chunk's completion before starting the next.
3. This is the mirror image of chunking — bounded memory, strict ordering.

## What happens if a chunk write fails

The exception propagates up; the File document is marked `status: 'failed'`.
Chunks already written before the failure remain orphaned on disk until
Phase 9 (integrity verification) or manual cleanup — true partial-failure
retry becomes meaningful once chunks are sent to remote storage nodes
individually (Phase 7), where a single failed network call can be retried
without redoing the whole upload.

## Current limitation (honest status, per project rules)

Chunks are currently stored on the backend's own local disk
(`server/chunks/`), NOT yet distributed across the storage nodes built in
Phase 5. This system is not yet "distributed storage" — that requires
Phase 7 (chunk placement across nodes) at minimum. This phase's scope was
proving chunking and reconstruction work correctly in isolation.