# readyset-review

Frame.io V4 clone — internal media review platform.

## Current Milestone: v1.3 — Video Review Polish

**Goal:** Refinar la experiencia de revisión con mejoras al manejo de versiones, comparación de assets, información de archivos y controles del player de video.

**Target features:**
1. Version stacking via drag & drop — arrastrar un asset encima de otro lo agrega a su stack de versiones
2. Asset comparison — 2+ assets seleccionados → "Compare assets" → vista side-by-side
3. File information tab — pestaña junto a comentarios mostrando fps, resolución, tamaño, codec, duración
4. Safe zones opacity slider — control de opacidad para el overlay de Safe Zones
5. Comment count in grid view — badge de comentarios en tarjetas de grilla (como en lista)
6. Timecode frame bug fix — corregir actualización al avanzar cuadro por cuadro en modo frames

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

---

<details>
<summary>v1.2 Context (shipped 2026-04-07)</summary>

22 phases shipped: breadcrumb nav, drag-to-move, context menus, review link management, bulk download, list view, admin panel, safe zones, VU meter, auth-skip, collaborator autocomplete, asset download button.

See `.planning/milestones/v1.2-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.1 Context (pre-v1.2)</summary>

Add 4 missing UX features: breadcrumb navigation bar, video thumbnail generation, multi-select with rubber-band drag, folder drag-and-drop import.

</details>
