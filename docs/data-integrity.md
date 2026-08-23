# Data Integrity & Checksum Verification

## Mechanism

Every chunk's SHA-256 checksum is computed at write time (Phase 6) and stored
in its `Chunk` document. On every read — both direct downloads and the
dedicated verify endpoint — the checksum is recomputed from the bytes
actually received from a storage node and compared against the stored value.

## Why this matters

Disk and network corruption ("bit rot") is typically *silent* — a file can
appear completely normal (correct size, no read errors) while its actual
bytes are wrong. Without verification, this kind of corruption goes
undetected until a human notices broken output, often long after the fact.
Checksums convert this into an immediately detectable condition.

## Corruption handling reuses the replication fallback path

A corrupted replica and an unreachable replica are treated identically by
the read path: both cause the loop to move to the next entry in
`storageLocations`. This means corruption recovery required no new
fault-tolerance mechanism — it reuses exactly the replica-fallback logic
built in Phase 8, triggered by a different failure signal.

## Verified with real corruption (not simulated)

A chunk's on-disk file was directly overwritten with garbage bytes on one
of its two replica nodes. The dedicated `GET /api/files/:id/verify`
endpoint correctly reported that replica as `corrupted` while the other
remained `ok`. A subsequent download succeeded and reconstructed the file
byte-perfectly, silently using only the surviving good replica.

## Current scope boundary (honest)

This phase detects and routes around corruption — it does not yet *repair*
it. The corrupted replica on the affected node remains corrupted until:
- The node is manually re-synced, or
- Phase 11 (automatic replica recovery) adds a background process that
  notices under-replicated/corrupted chunks and writes a fresh good copy
  back to restore full redundancy.

Until then, a chunk with one corrupted replica is effectively running at
reduced redundancy, the same honest caveat noted for node failures in
Phase 8.