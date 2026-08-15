# Implementation Plan

## Pre-development gate

- [x] Read the active task artifacts and `.trellis/spec/frontend/` pre-development checklist files.
- [x] Read the shared reuse and cross-layer thinking guides because the task adds config fields and shared sizing helpers.
- [x] Confirm the dirty tree contains only `.trellis/tasks/08-16-car-display-mode/` before product edits.
- [x] Record baseline TypeScript, focused Jest, full Jest, and read-only ESLint results.
- [ ] Before visual verification on the target head unit, record its runtime `Dimensions.get("window")` width/height and Android density; use the 1920×1080/14.6-inch audit as context, not as a hard-coded layout branch.

## Phase 1. Typed config and display-metrics foundation

- [x] Add `basic.carDisplayMode` and `basic.carDisplayFontSize` to `IAppConfigProperties`; use `?? false` and `?? "medium"` at consumers rather than a schema migration.
- [x] Add a pure display-sizing module with the PRD font/lyric/touch constants, current-short-edge scaling, and safe-width overlay clamping.
- [x] Add focused unit tests for disabled behavior, both tiers, 360/480/600dp short edges, lyric selections, and ultra-wide overlay bounds.
- [x] Add a single provider/hook that combines AppConfig and `useWindowDimensions`, then mount it above navigation and global overlays.
- [x] Checkpoint: focused Jest and `npx tsc --noEmit`.

## Phase 2. Settings and localization

- [x] Add the mode switch and always-visible tier radio row to Basic Settings General using the existing setting factories and RadioDialog.
- [x] Add Simplified Chinese, Traditional Chinese, and English labels for the setting and both tiers.
- [x] Add matching keys to `src/types/core/i18n/index.d.ts` and verify language JSON key parity.
- [x] Verify mode and tier persist independently, default to off/medium when unset, and update the provider immediately.

## Phase 3. Shared typography and controls

- [x] Resolve semantic fonts and clipping-safe line heights in `ThemeText` while leaving disabled-mode style behavior unchanged.
- [x] Adapt shared direct-text boundaries that are visible during normal playback, including paragraph/input/toast/tip and playback metadata where needed.
- [x] Apply the selected touch and icon minima to `ListItem`, `IconButton`, buttons, Chip/TypeTag, Switch, and the landscape navigation rail.
- [x] Raise AppBar, PlayAllBar, MusicBar, dialog action, and panel-header containers when required so enlarged controls are not clipped.
- [x] Update virtualized-list estimates and RadioDialog fixed offsets to match resolved ListItem heights.
- [x] Checkpoint: focused Jest and TypeScript passed; manual toggle remains device-dependent.

## Phase 4. Playback detail and ordered rows

- [x] Clamp the existing four playback-detail lyric sizes to the selected car-tier minima without rewriting `lyric.detailFontSize`.
- [x] Adapt lyric metadata, empty/search state, seek-time label, playback-detail title/artist, and lyric operation hit areas.
- [x] Verify landscape music-table title and action columns remain visible in code paths; compact mode may continue hiding only existing secondary columns.
- [x] Verify mode/tier changes are presentation-only in code paths and do not touch playback state.
- [x] Checkpoint: pure tests cover all four lyric selections in both car tiers.

## Phase 5. Drawer, panels, and dialogs

- [x] Apply safe available-width clamping to the Home drawer only when car mode is enabled.
- [x] Apply bounded right-panel width in `PanelBase` only for landscape car mode; retain portrait height/placement and all dismissal behavior.
- [x] Apply bounded dialog width/max-height and resolved action heights in car mode.
- [x] Confirm `PanelFullscreen` remains full screen and does not use ordinary overlay bounds.
- [x] Checkpoint: code preserves open/close, mask tap, Android back, keyboard avoidance, safe-area, and rotation handlers; device exercise remains pending.

## Phase 6. Full quality gate

- [x] `npx tsc --noEmit`
- [x] `npx jest --runInBand`
- [x] `npx eslint src --ext .js,.jsx,.ts,.tsx`
- [x] `android\\gradlew.bat :app:assembleDebug` from the repository root, or `gradlew.bat :app:assembleDebug` from `android/`; release universal also built.
- [x] `git diff --check` and changed-file scope review.
- [ ] Manual matrix with car mode off, medium, and large at a 360–480dp short edge and a 600dp+ short edge: Home, playback detail, Search, TopList, sheet/album detail, Settings, editor, file selector, drawer, Panel, Dialog, and Fullscreen Panel.
- [ ] On the supplied 1920×1080/14.6-inch 16:9 head unit, verify `medium` first, then `large`; confirm the 38:62/50:50 panes, compact table columns, and safe-width overlay clamps at the device's reported logical dp. (No physical head unit/emulator was available in this session.)
- [ ] Capture landscape screenshots for at least one 360–480dp case and one 600dp+ case; verify text overlap, ellipsis, title/action columns, and touch targets. (Pending device visual validation.)

## Verification log

- `npx tsc --noEmit` — passed.
- `npx jest --runInBand` — 4 suites / 15 tests passed.
- `npx eslint src --ext .js,.jsx,.ts,.tsx` — 0 errors, 111 existing warnings.
- `git diff --check` — passed.
- `gradlew.bat :app:assembleDebug` — passed.
- `gradlew.bat :app:assembleRelease` — passed.
- Universal release APK — `android/app/build/outputs/apk/release/app-universal-release.apk`; APK v2 signature verified; `minSdkVersion` 24.

## Risk and rollback points

- `ThemeText` style precedence is the broadest visual change; verify disabled mode before continuing past Phase 3.
- Resolved ListItem height must stay synchronized with virtual-list estimates and RadioDialog offsets; treat any scroll jump as a blocking defect.
- Overlay sizing must be gated by car mode so existing phone layouts remain byte-for-byte equivalent in intent.
- If one shared primitive causes clipping, roll back that consumer to its legacy constant and fix the specific parent boundary rather than introducing a global scale transform.
