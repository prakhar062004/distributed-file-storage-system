# File Sharing & Authorization

## Permission model

Three tiers, checked via numeric rank comparison (`READ` < `WRITE` < `OWNER`):
- **READ** — view metadata, download
- **WRITE** — same as READ (file editing isn't implemented in this project,
  but the tier exists for a complete, extensible model)
- **OWNER** — everything above, plus manage sharing and delete

OWNER is never stored as a `Share` record — it's implicit from `File.ownerId`.
A `Share` document always represents access granted to a non-owner.

## Centralized permission check

`permissionService.getEffectivePermission()` checks ownership first (cheap,
common case), then falls back to a `Share` lookup. Every controller that
needs an authorization decision calls this same function — there is exactly
one place permission logic lives, not one copy per route.

## 404, not 403, for unauthorized access

Read-path routes (`getFile`, `downloadFile`, `verifyFileIntegrity`) return
404 for both "file doesn't exist" and "file exists but you can't see it."
This is deliberate: a 403 would confirm a file's existence to an
unauthorized requester, a real information leak for private data.

## Route ordering bug (real, caught during testing)

Mounting `fileRoutes` (with its `/:id` catch-all) before `shareRoutes`
caused `GET /api/files/shared-with-me` to be incorrectly matched by
`fileRoutes`'s `/:id` route, with "shared-with-me" treated as a literal
file ID — producing a Mongoose CastError. Fixed by mounting `shareRoutes`
before `fileRoutes` on the same `/api/files` prefix. This is the same
class of bug as Phase 12's `/uploads/in-progress` ordering issue —
Express matches routes in mount order, and specific literal paths must
be registered before general `:param` patterns that could shadow them.

## Verified with two real user accounts

A second user was registered. Before sharing: the second user received
404 attempting to view the first user's file. After the owner shared it
with READ permission: the second user could view and download it, but a
delete attempt still correctly failed (owner-only), and the file
correctly appeared in the second user's "shared with me" list.

## Cleanup on delete

Deleting a file now also deletes all associated `Share` records, preventing
orphaned shares from pointing at nonexistent files — `listSharedWithMe`
additionally filters out any such orphans defensively, but the real fix is
this cleanup at deletion time.