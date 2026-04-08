---
status: partial
phase: 24-safe-zones-opacity
source: [24-VERIFICATION.md]
started: 2026-04-07T21:35:00Z
updated: 2026-04-07T21:35:00Z
---

## Current Test

number: 1
name: Slider visual consistency with volume slider
expected: |
  Both sliders share the same height, width (w-16), purple fill color (#7a00df), and cursor style
awaiting: user response

## Tests

### 1. Slider visual consistency with volume slider
expected: Open the viewer with a video loaded. Select any safe zone. Both the opacity slider and volume slider should share the same height, width (w-16), purple fill color (#7a00df), and cursor style.
result: [pending]

### 2. Slider conditional visibility
expected: With no safe zone selected the opacity slider is absent. Selecting a safe zone makes it appear. Clicking "None" makes it disappear again — no layout shift.
result: [pending]

### 3. Real-time opacity feedback
expected: Dragging the opacity slider from 100% to 0% fades the safe zone overlay progressively and smoothly in real-time, with no delay or frame drop.
result: [pending]

### 4. Regression — volume slider and other controls
expected: Volume slider, playback speed, annotation mode, frame-step buttons, and fullscreen button all function normally with a safe zone active.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
