---
status: complete
phase: 28-version-stack-dnd
source: [28-VERIFICATION.md]
started: 2026-04-08T01:00:00Z
updated: 2026-04-08T01:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Drag highlight
expected: Accent border + ring visible on target card during hover
result: pass

### 2. Successful merge
expected: Toast appears, source card disappears, target version count increments
result: pass

### 3. Self-drop no-op
expected: No toast, no change when dragging card onto itself
result: pass

### 4. Same-stack no-op
expected: No toast, no change when dragging onto same version group
result: pass

### 5. Uploading card blocks drop
expected: No highlight, no-drop cursor during active upload
result: pass

### 6. Folder-move unchanged
expected: Folder drag-and-drop still works alongside new DnD code
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
