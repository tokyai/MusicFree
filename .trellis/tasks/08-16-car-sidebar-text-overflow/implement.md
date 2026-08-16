# Implementation Plan

## 0. Planning and guardrails

- [x] Review the current PRD, design, frontend component guidelines, and
  display-metrics tests.
- [x] Keep the work limited to text-safe sidebar/navigation/action-rail
  layouts; preserve unrelated user changes.
- [x] Record the baseline UI-tree evidence and 1920x1080 screenshot.

Rollback point: no product files changed.

## 1. Shared text bounds

- [x] Add bounded text styles to `LandscapeNavigationRail` and
  `IconTextButton`.
- [x] Add a safe `minWidth: 0` boundary to shared list/action content only
  where the audit confirms it is part of the same overflow path.

Validation: TypeScript and a focused render/style test or pure layout test.

Rollback point: revert shared component changes; page behavior remains intact.

## 2. Home shortcut fix

- [x] Add the `ActionButton` tile/rail variant with car-mode minimum height and
  a full-width, fitting title.
- [x] Select the rail variant only for car + horizontal home operations.
- [x] Keep portrait/non-car grid behavior and navigation callbacks unchanged.

Validation: focused screenshot and UI-tree bounds show four horizontal titles
inside stable rows; no title node is narrower than a single-character fit.

## 3. Other confirmed action rails

- [x] Apply the same full-width text contract to music-list editor `BottomIcon`.
- [x] Apply it to the file-selector landscape confirmation action.
- [x] Verify plugin list/sort/subscribe secondary rails through the shared
  `IconTextButton` path.
- [x] Review drawer and ordinary `ListItem` consumers; change only if the
  emulator/static audit demonstrates the same defect.

## 4. Tests and static audit

- [x] Extend display/layout tests for 731dp representative car width, medium
  and large font tiers, and the unchanged phone path.
- [x] Search all `LandscapeNavigationRail`, `ActionButton`, `IconTextButton`,
  and `secondaryActions` consumers for unbounded text or fixed intrinsic-width
  children.
- [x] Run `npx tsc --noEmit`, focused Jest, full Jest, and read-only ESLint.

## 5. Emulator and package verification

- [x] Build/install the debug APK and verify home, search/top-list/settings
  navigation rails, plugin action rail, music-list editor, and file selector.
- [x] Repeat the home and one shared rail at both car font tiers where the
  settings toggle is available.
- [x] Capture 1920x1080 screenshots and confirm process stability/no fatal logs.
- [x] Build universal debug and release APKs and verify package metadata.

Artifacts:

- `android/app/build/outputs/apk/debug/app-universal-debug.apk`
- `android/app/build/outputs/apk/release/app-universal-release.apk`
- Both variants report package `fun.upup.musicfree.car`, version `0.6.2`,
  version code `400011`, and minimum SDK 24.

## 6. Finish gates

- [x] Run the full Trellis quality check and update the frontend spec if the
  text-boundary contract is a reusable convention.
- [x] Present a commit plan and wait for one-shot confirmation before commit.
- [ ] Archive the task and record the session after the work commit.

Quality evidence:

- `npx tsc --noEmit`: passed.
- `npx jest --runInBand`: 6 suites and 49 tests passed.
- `npx eslint src --ext .js,.jsx,.ts,.tsx`: 0 errors; 106 existing warnings.
- `gradlew.bat :app:assembleDebug :app:assembleRelease`: passed.
- 1920x1080 emulator screenshots and UI XML cover medium/large home rails,
  shared navigation pages, file selection, and music-list editor actions.
