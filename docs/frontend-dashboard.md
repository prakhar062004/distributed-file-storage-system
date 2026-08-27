# Frontend Dashboard

## Pages

- **Login / Register** — auth entry points (Phase 2)
- **My Files** — upload, list, download, delete (Phase 4/6/7)
- **Shared with Me** — files other users have granted access to, showing
  each file's permission tier (Phase 14)
- **Node Status** — live storage node health, auto-refreshing every 5
  seconds via `GET /api/nodes/status` (Phase 10)

## Navigation

A shared `Navbar` + `AppLayout` wrapper ties all authenticated pages
together consistently, replacing each page's previously-duplicated
header/logout logic.

## Design decision: Node Status as the dashboard's signature moment

Every other page in this app is fairly standard CRUD UI. Node Status is
the one place where the underlying distributed-systems machinery
(heartbeats, health inference, Redis-backed state) becomes visible and
tangible to a user — a pulsing green indicator on a healthy node, turning
red the moment heartbeats stop arriving. This page is a deliberately
minimal but purposeful visualization: everything on it is a real number
from real infrastructure (file count, disk usage, seconds since last
heartbeat), refreshed automatically, not a static mockup.

## Known limitation (honest)

The Shared Files page displays metadata but does not yet wire up a
download action — the backend already supports downloading shared files
(permission-checked via Phase 14's `hasPermission`), but the UI action
itself wasn't added in this pass. A straightforward addition reusing the
same blob-fetch pattern already used in the My Files download handler.