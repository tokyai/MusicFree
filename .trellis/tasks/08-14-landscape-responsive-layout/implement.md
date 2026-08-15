# Implementation Plan

## Pre-development gate

-   [ ] Read `.trellis/spec/frontend/component-guidelines.md`, `hook-guidelines.md`, `state-management.md`, `type-safety.md`, and `quality-guidelines.md` before editing.
-   [ ] Confirm the dirty tree contains only this task's planning files.
-   [ ] Record baseline TypeScript, Jest and read-only ESLint results.

## Phase 1. Shared responsive foundation

-   [ ] Add the minimal split container and vertical navigation rail under `src/components/base/`.
-   [ ] Keep orientation ownership in `src/hooks/useOrientation.ts`; add only pure/derived helpers needed by multiple consumers.
-   [ ] Establish `38:62` and `50:50` pane contracts, min-width containment and safe-area usage.
-   [ ] Remove page-level full-width assumptions only where touched; do not globally replace intentional panel sizing.
-   [ ] Add focused tests for any pure orientation/sizing helper introduced.
-   [ ] Checkpoint: TypeScript and focused Jest tests.

## Phase 2. Existing landscape pages

-   [ ] Normalize Home operations/sheets to the shared `38:62` split.
-   [ ] Bound MusicDetail to `50:50` and verify cover, controls and lyric at short landscape heights.
-   [ ] Give ArtistDetail a scrollable metadata pane and bounded result pane; remove `rpx(750)` page-width assumptions.
-   [ ] Normalize About to `38:62`, responsive image/QR sizing and independent content scrolling.
-   [ ] Checkpoint: portrait comparison plus rotation checks for all four pages.

## Phase 3. Sheet, album and ranking detail family

-   [ ] Update shared `MusicSheetPage` to keep portrait list-header composition and add landscape split composition.
-   [ ] Adapt shared metadata header so description scrolls while PlayAllBar/actions stay pinned.
-   [ ] Apply the same contract to local `sheetDetail` without changing current-track highlighting or sheet actions.
-   [ ] Verify plugin sheet, album and ranking detail retry/load-more paths in the shared layout.
-   [ ] Checkpoint: independent left/right scrolling and playback from each detail type.

## Phase 4. Rankings, recommendations and global search

-   [ ] TopList: render plugin sources in the landscape rail and the selected board on the right; preserve portrait tabs.
-   [ ] RecommendSheets: combine active plugin and tag choices into the landscape rail; keep the existing portrait source tabs and tag chips.
-   [ ] SearchPage: lift controlled media/source selection enough to render both groups in the landscape rail; preserve result atoms, paging and portrait nested tabs.
-   [ ] Ensure long source/tag lists scroll and selected state remains visible.
-   [ ] Checkpoint: loading, empty, retry, refresh and pagination for each page.

## Phase 5. Settings and plugin subpages

-   [ ] BasicSetting: vertical directory left, SectionList right, click-to-scroll and viewability-to-highlight synchronization.
-   [ ] Theme, backup and About: use meaningful left metadata/directory and right content without inventing new settings state.
-   [ ] Plugin list, sort and subscription: keep the nested stack and adapt lists/actions to available landscape width.
-   [ ] Verify all setting controls update the same config keys and dialogs/panels still open correctly.
-   [ ] Checkpoint: rotate while editing switches, sliders, text fields and plugin order.

## Phase 6. Ordered lists, editors and utility pages

-   [ ] Add an explicit landscape table presentation to `MusicItem` and pass it from `MusicList` and direct list owners.
-   [ ] Apply stable columns to history, local music, detail results, list search and download rows while preserving order.
-   [ ] MusicListEditor: list left; selection/save/batch actions in a permanent right rail; portrait bottom actions unchanged.
-   [ ] FileSelector: file list left; select-all/confirm actions right; preserve path navigation and hardware back.
-   [ ] SetCustomTheme: preview left, controls right; Permissions and remaining obvious vertical utility sections use responsive split layouts.
-   [ ] Checkpoint: narrow landscape text fit, row actions, sorting, multi-select, keyboard and disabled states.

## Phase 7. Drawer and overlays

-   [ ] Bound the Home drawer width in landscape and verify full scroll range.
-   [ ] Complete PanelBase right-side width, corners, safe area and keyboard behavior while retaining portrait placement.
-   [ ] Bound and center dialog geometry; keep actions reachable with long content.
-   [ ] Confirm PanelFullscreen and image/fullscreen experiences remain full-screen.
-   [ ] Checkpoint: mask taps, Android back, repeated open/close, rotation while open and keyboard dismissal.

## Phase 8. Full quality gate

-   [ ] `npx tsc --noEmit`
-   [ ] `npx jest --runInBand`
-   [ ] `npx eslint src --ext .js,.jsx,.ts,.tsx`
-   [ ] `android\\gradlew.bat :app:assembleDebug` from the repository root, or `gradlew.bat :app:assembleDebug` from `android/`.
-   [ ] Android API 24+ manual matrix: portrait to landscape to portrait, narrow and regular landscape, gesture/navigation insets, keyboard, AppBar/MusicBar, long lists, dialogs, panels and drawer.
-   [ ] iOS simulator matrix when available: shared split geometry, safe areas, rotation, lists and overlays.
-   [ ] Review `git diff --check`, portrait screenshots and changed-file scope.

## Risk and rollback points

-   TabView state lifting in search/recommendations is the highest behavioral risk; stop and verify request identity after Phase 4 before continuing.
-   Sortable list geometry and keyboard-aware panels are the highest interaction risks; verify them before merging later phases.
-   If a family regresses portrait behavior, revert that family's conditional landscape branch rather than changing managers or data contracts.
