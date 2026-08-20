# Database Design

## Overview

MongoDB stores **metadata only** — never raw file bytes. Actual file/chunk data lives on
storage nodes (introduced in Phase 5). This separation is the foundation of the system's
distributed architecture.

## Why metadata is separated from file data

- MongoDB has a 16MB hard document size limit — large files physically cannot be stored
  as document fields.
- Databases are optimized for structured, queryable, indexed data — not for streaming
  large binary blobs.
- Separating the two allows the storage layer (chunks, replication, node placement) to
  evolve independently of how metadata is queried and displayed.

## Collections

### User
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| email | String | required, unique, indexed automatically |
| password | String | bcrypt hash, `select: false` by default |
| createdAt / updatedAt | Date | auto via `timestamps` |

### File
| Field | Type | Notes |
|---|---|---|
| name | String | current display name (renameable) |
| originalName | String | name at time of upload, preserved |
| size | Number | bytes |
| mimeType | String | |
| ownerId | ObjectId → User | indexed — queried on every "my files" request |
| status | Enum | uploading / processing / available / failed / deleted |
| checksum | String | null until Phase 9 (integrity verification) |
| folderId | ObjectId → Folder | nullable, folders added later |
| createdAt / updatedAt | Date | auto via `timestamps` |

**Deliberately excluded from File:** a `chunks` array. A file may have many chunks;
embedding them would make File documents grow unpredictably large and violate the
"keep documents small and focused" principle. Instead, the future `Chunk` model
references `fileId` — a one-to-many relationship expressed via reference, not embedding.

## Indexing strategy

- `ownerId` on File — supports the most common query pattern ("list my files") without
  a full collection scan as data grows.
- `email` on User — unique index, doubles as both a constraint and a lookup accelerator
  for login.
- Indexes are added only where a concrete query pattern justifies them — every index
  speeds up reads but costs write performance and storage, so we avoid speculative
  indexing.

## Relationships

- User (1) → File (many) via `ownerId`
- File (1) → Chunk (many) via `fileId` — added in Phase 6
- File (many) → Folder (1) via `folderId` — added when folder management is implemented