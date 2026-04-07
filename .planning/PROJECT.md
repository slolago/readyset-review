# readyset-review

Frame.io V4 clone — internal media review platform.

## Current State (v1.2 — shipped 2026-04-07)

A fully-featured media review platform with:
- **Asset management** — upload, drag-to-move, version stacks, context menus (rename/copy/duplicate), bulk download, list + grid views
- **Review links** — short tokens, guest name prompt, allow downloads/approvals toggles, folder sharing, virtual folder browser, auth-skip for logged-in users
- **Video player** — safe zones overlay (14 platforms), VU meter (Web Audio API), version switcher, download button
- **Collaboration** — name-based autocomplete invite search, collaborator roles, guest read-only enforcement
- **Navigation** — collapsible sidebar with project tree, breadcrumb nav, folder size badges, dashboard real stats
- **Admin** — user management, all-projects view with owner info, role-based access

## Stack

- Next.js 14 App Router + TypeScript
- Firebase Auth (Google OAuth) + Firebase Admin
- Firestore (database)
- Google Cloud Storage (file storage + signed URLs, dual URL strategy for inline/download)
- Tailwind CSS dark theme (#0d0d0d bg, #6c5ce7 accent purple)
- Video.js for video playback
- Fabric.js for canvas annotations

## Repositories

- origin: slolago/readyset-review
- vercel: slolago/readyset-review-vercel

## Next Milestone Goals

_To be defined. Run `/gsd:new-milestone` to start requirements gathering._

---

<details>
<summary>v1.1 Context (pre-v1.2)</summary>

## Previous Goal (v1.1)

Add 4 missing UX features to the existing working app:
1. Breadcrumb navigation bar
2. Video thumbnail generation
3. Multi-select with rubber-band drag
4. Folder drag-and-drop import (with subfolder structure)

</details>
