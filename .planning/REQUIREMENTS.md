# Requirements: readyset-review

**Defined:** 2026-04-20 (v1.8 — asset pipeline & visual polish)
**Core Value:** Fast, accurate video review — frame-level precision, rich metadata, and fluid version management without leaving the browser.

## v1.8 Requirements

Requirements for milestone v1.8 — Asset Pipeline & Visual Polish. Each maps to roadmap phases via the Traceability table below.

### Metadata Accuracy

- [ ] **MEA-01**: Image assets are NOT processed by ffprobe — metadata extraction branches on `asset.type`; images use an image-appropriate path (e.g. `sharp` / `image-size` / EXIF parser) and do not surface video-only fields (Container, Pixel format, Color space, Overall bitrate).
- [ ] **MEA-02**: Info panel renders different field sets per asset type — images show resolution, file size, color space (when present), EXIF orientation; videos keep the current field set. Empty/non-applicable fields are hidden, not shown as "—".
- [ ] **MEA-03**: Resolution and file size reflect the actual source file as uploaded — a 2250×4000 / 718 KB JPEG must display as 2250×4000 / 718 KB in the Info panel, not a transformed/thumbnailed version.
- [ ] **MEA-04**: Upload timestamp in the Info panel renders as a readable date (e.g. "Apr 20, 2026, 3:42 PM") — never "Invalid Date". Timestamp serialization between Firestore Admin and the client is correct for both `Timestamp` and `{_seconds, _nanoseconds}` shapes.

### Review Links

- [ ] **RVL-01**: "Add to review link" modal (opened from asset/folder actions) loads the current project's existing review links without surfacing "Failed to load review links". API and render paths align on the query shape.
- [ ] **RVL-02**: Project-level review-link views — both the sidebar `Review Links` shortcut under a project AND the project's `Review Links` tab — list the review links created for that project. Filter is by `projectId`, not omitted.

### Trash & Recovery

- [ ] **TRH-01**: Deleting an asset or folder soft-deletes it into a Trash list (e.g. `deletedAt` timestamp) instead of hard-deleting immediately. Soft-deleted items disappear from normal grid/list views.
- [ ] **TRH-02**: User can open Trash (project-level view) and see deleted assets/folders; each item shows name, deleted date, and a Restore action. Restore returns the item to its original folder (or project root if the original folder is also gone).
- [ ] **TRH-03**: User can permanently delete a single item from Trash, or "Empty Trash" to permanently delete all. Permanent deletion frees the GCS object and removes the Firestore doc. Confirmation goes through the in-app `useConfirm` dialog.

### File Type Expansion

- [ ] **UPL-01**: Uploader accepts, in addition to video/image, the following MIME types and extensions: PDF (`application/pdf`), archives (`.zip`), fonts (`.ttf`, `.otf`, `.woff`, `.woff2`), HTML (`.html`), editable design (`.ai`, `.psd`, `.aep`, `.fig`). Server and client allow-lists agree.
- [ ] **UPL-02**: Non-viewable asset types (archive, font, design file) render a file-type icon + filename + metadata card (size, uploader, date) in the viewer instead of attempting a broken video/image preview.
- [ ] **UPL-03**: Grid/list cards for non-viewable types show the file-type icon prominently (not the generic broken-thumbnail placeholder) with the extension badge.
- [ ] **UPL-04**: PDF and HTML assets open in an inline viewer — PDF via an iframe / pdf.js, HTML via a sandboxed iframe — so a user reviewing a deck or interactive prototype can scroll through without downloading.

### Visual Polish

- [ ] **VIS-01**: New Folder modal's top accent gradient is clipped to the modal card's rounded container — the colored line never extends past the card edge.
- [ ] **VIS-02**: Folder cards show a content preview — the first 1–4 child asset thumbnails, stacked or tiled within the folder card, replacing the generic folder icon when the folder has assets.
- [ ] **VIS-03**: Inline folder/asset rename has an explicit confirm affordance — an adjacent checkmark button commits the change, Escape cancels, Enter commits. The user never has to guess whether blur-to-save is the trigger.
- [ ] **VIS-04**: Asset card thumbnails preserve source aspect ratio — images/videos display `object-contain` within a fixed aspect-ratio frame, no stretching to full card width when the source is tall/narrow.
- [ ] **VIS-05**: Asset cards show the version count badge exactly once (no duplicate).
- [ ] **VIS-06**: Asset tag/label pills remain legible on any thumbnail — add a semi-opaque dark background + white text (or text shadow / backdrop-blur) so tags are readable against bright, busy, or low-contrast image previews.
- [ ] **VIS-07**: Create Review Link modal keeps all UI (pickers, toggles, action buttons) contained within the modal card — no controls bleed outside the card boundary.
- [ ] **VIS-08**: Dashboard Quick Actions route to their respective flows — "Browse Projects" → `/dashboard` (or project list), "Upload Assets" → opens the upload modal / navigates to the default project's upload flow, "Invite Team" → opens the invite/collaborators flow. Each action's `href`/`onClick` is distinct.

## Absorbed from prior milestones

See `.planning/MILESTONES.md` for shipped scope.

## v2 / Future Requirements

- Review-link holder presence indicator (who is currently reviewing)
- Notifications (in-app + email) for new comments on shared assets
- Bulk export (export a whole folder of trims in one job)
- Per-asset watermarking for client-facing review links
- AI-powered asset search / auto-tagging

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mobile app | Web-first approach |
| Real-time collaborative cursors | Not needed for async review workflow |
| Video transcoding library / ingest pipeline | ffmpeg trim + convert is enough |
| Offline mode | Real-time collaboration is core value |
| SSO / SAML / OIDC beyond Google | Google OAuth is the single entry point |
| Role customization / custom permission matrices | Fixed role set is sufficient |
| In-browser Photoshop/AE editing | Only preview/download for design files |
| Archive extraction + preview of zip contents | Download to inspect; out of scope for this milestone |
| Server-side HTML sandboxing / CSP hardening beyond iframe sandbox | iframe `sandbox` is the boundary |
| Trash retention policy / auto-purge after N days | Manual cleanup only — no cron in v1.8 |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MEA-01 | Phase 49 | Pending |
| MEA-02 | Phase 49 | Pending |
| MEA-03 | Phase 49 | Pending |
| MEA-04 | Phase 49 | Pending |
| RVL-01 | Phase 50 | Pending |
| RVL-02 | Phase 50 | Pending |
| TRH-01 | Phase 52 | Pending |
| TRH-02 | Phase 52 | Pending |
| TRH-03 | Phase 52 | Pending |
| UPL-01 | Phase 51 | Pending |
| UPL-02 | Phase 51 | Pending |
| UPL-03 | Phase 51 | Pending |
| UPL-04 | Phase 51 | Pending |
| VIS-01 | Phase 53 | Pending |
| VIS-02 | Phase 53 | Pending |
| VIS-03 | Phase 53 | Pending |
| VIS-04 | Phase 53 | Pending |
| VIS-05 | Phase 53 | Pending |
| VIS-06 | Phase 53 | Pending |
| VIS-07 | Phase 53 | Pending |
| VIS-08 | Phase 53 | Pending |

**Coverage:**
- v1.8 requirements: 21 total
- Mapped to phases: 21 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-20 — traceability populated at roadmap creation*
