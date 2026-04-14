# Requirements: v1.5 Polish & Production Accuracy

## Grid / List View Polish

- [ ] **GRID-01**: Upload date and time is visible on grid cards without opening the asset — critical after unstacking versions since all siblings display V1 and date/time is the only way to distinguish the latest
- [ ] **LIST-01**: Full filename is readable in list view without opening the asset — currently truncated with no tooltip or expand mechanism on hover

## Measurement Accuracy

- [ ] **FPS-01**: Frame rate displayed in the info tab and grid matches the actual file frame rate — currently shows 31fps for 30fps files due to timing variance in `requestVideoFrameCallback`; fix by snapping raw measurement to nearest standard frame rate (23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60) within ±0.6fps tolerance; accurate FPS is a hard spec requirement for CTV delivery
- [ ] **VU-01**: VU meter measures the raw audio signal from the file, independent of the player volume control — currently the meter reacts to volume slider changes, meaning it measures the post-gain signal rather than the source signal; AnalyserNode must tap the audio chain before the GainNode

## Asset Management

- [ ] **COPY-01**: Copying an asset to a folder does not add a "copy of" prefix to the name — current behavior requires renaming every copy before delivering a CFF; copy should preserve the original name

## Review Links

- [ ] **RVLINK-01**: "Show all versions" toggle on review link creation actually causes the review link page to show all versions of a versioned asset — currently shows only one version regardless of the toggle setting
- [ ] **RVLINK-02**: A visible, prominent download button is present in the full video player view (not just on hover over the thumbnail preview) — clients need to find it without guessing

## Compare View

- [ ] **COMPARE-01**: User can click either version label in the compare view to designate that side as the active audio source — currently audio source is fixed to one side with no way to switch
- [ ] **COMPARE-02**: The compare view displays the active (clicked) version's comment thread — currently no comments are visible during comparison at all; switching the active side updates the comment panel to that version's comments

---

## Carried Over from v1.4 (not executed)

- COMPARE-01 and COMPARE-02 were Phase 34 in v1.4 — planned but never executed; promoted as v1.5 requirements above.

## Out of Scope for v1.5

- Waveform display in VU meter (show audio peaks over time)
- Real-time collaborative cursor in compare view
- Sub-frame FPS precision for HFR content (>60fps)
