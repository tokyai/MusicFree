# Implementation Plan

## 0. Preflight and guardrails

- [ ] Re-read `prd.md`, `design.md`, both spec indexes and relevant frontend,
  native, reuse and cross-layer guides through `trellis-before-dev`.
- [ ] Snapshot `git status --porcelain`; preserve unrelated user changes.
- [ ] Confirm the task remains scoped to `D:\Sync\Tianyi\MusicFree`.
- [ ] Record the current no-ADB limitation; do not claim device screenshots that
  cannot be produced in this environment.

Rollback point: no product files changed.

## 1. Coexisting Android identity

- [ ] Change only `applicationId` to `fun.upup.musicfree.car`.
- [ ] Change Android/app visible names to `MusicFree车机版` while keeping the
  React Native root component name `MusicFree`.
- [ ] Verify namespace, Kotlin packages and manifest component references still
  resolve.

Validation checkpoint:

```powershell
rg -n "applicationId|namespace|app_name|displayName" android app.json
```

Rollback point: revert the identity/resource edits without touching later FTP
or layout work.

## 2. FTP/FTPS native transport

- [ ] Add `commons-net:commons-net:3.11.1` to Android dependencies.
- [ ] Implement `FtpBackupModule.kt` and `FtpBackupPackage.kt` with validated
  options, one worker executor, cancellation and lifecycle cleanup.
- [ ] Configure passive/binary/timeout behavior and explicit FTPS with system
  trust manager, endpoint checking, PBSZ 0 and PROT P.
- [ ] Implement connection test, upload rotation/rollback and cache-file
  download; map stable error codes and prevent password logging.
- [ ] Register the package in `MainApplication.kt`.
- [ ] Add the typed Android-only wrapper under `src/native/ftpBackup/`.

Validation checkpoint:

```powershell
Push-Location android
.\gradlew.bat :app:compileDebugKotlin
Pop-Location
npx tsc --noEmit
```

Rollback point: remove the package registration, Kotlin directory, wrapper and
Gradle dependency as one unit.

## 3. Core backup orchestration and tests

- [ ] Add typed persisted FTP configuration keys.
- [ ] Add `src/core/ftpBackup.ts` for normalization, cache staging, native calls,
  localized-safe error projection and cleanup.
- [ ] Strengthen the existing backup payload parser so invalid structure fails
  before playlist/plugin mutation.
- [ ] Add focused Jest tests for defaults, mode selection, host/port/directory
  validation, native-code mapping, valid payloads and invalid JSON/shape.

Validation checkpoint:

```powershell
npx jest src/core/ftpBackup.test.ts --runInBand
npx tsc --noEmit
```

Rollback point: core service and its tests can be removed while leaving the
compiled native module isolated.

## 4. Settings UX and picker removal

- [ ] Add all FTP/FTPS labels, warnings, confirmations and error strings to
  English, Simplified Chinese, Traditional Chinese and the typed i18n map.
- [ ] Extend `SetUserVariables` only with optional password masking and keyboard
  type support.
- [ ] Replace local backup/restore actions with FTP/FTPS mode, server settings,
  test, backup and restore actions; retain ResumeMode, URL and WebDAV paths.
- [ ] Wire loading/cancel behavior and restore confirmation to the core service.
- [ ] Remove system-picker actions from plugin, lyric, playlist-cover and custom
  theme screens while preserving non-picker functionality.
- [ ] Remove JS-file intent filters and the local-JS bootstrap install branch;
  preserve network/deep-link plugin install and audio intents.
- [ ] Remove `expo-document-picker` and `react-native-image-picker` from
  `package.json`, `package-lock.json` and `yarn.lock`, auditing the lockfile diff
  for unrelated churn.

Validation checkpoint:

```powershell
rg -n "getDocumentAsync|launchImageLibrary|expo-document-picker|react-native-image-picker" src android package.json package-lock.json yarn.lock
npx tsc --noEmit
```

Expected grep result: no live picker calls or dependency entries; comments may
be removed as stale code so the audit is unambiguous.

Rollback point: revert settings/picker/lockfile edits together so dependency
state cannot drift from imports.

## 5. Semantic car splits and overlay bounds

- [ ] Add a pure semantic split resolver and test every preset.
- [ ] Add `carPreset` to `ResponsiveSplitView`, applying it only in car mode.
- [ ] Assign presets to every current split consumer:
  - navigation: search, top list, recommendation tags, basic settings;
  - home: operation shortcuts/playlists;
  - metadata: artist, playlist/sheet, about and permissions;
  - player: player/lyrics;
  - secondary actions: file selector, playlist editor, plugin list/sort/subscribe;
  - balanced: backup/theme/custom-theme two-pane forms.
- [ ] Update artist nested tab width to match its resolved secondary pane.
- [ ] Reduce/clamp drawer, panel and dialog bounds and update pure sizing tests at
  representative 731dp, 960dp and 1920dp logical widths.
- [ ] Fix HomeDrawer prop spreading and header width/margin overflow.

Validation checkpoint:

```powershell
npx jest src/utils/displayMetrics.test.ts --runInBand
npx tsc --noEmit
```

Rollback point: removing `carPreset` at an individual consumer restores its old
layout; the phone-mode path must never depend on the new preset values.

## 6. Fixed-width and full-page audit

- [ ] Replace overflow-prone panel/page wrappers using `rpx(500/620/750)` with
  bounded flex or `width: "100%"`; retain content-sized artwork already clamped
  by display metrics.
- [ ] Verify every route in `src/core/router/routes.tsx`, all settings types,
  panels/dialogs, AppBar/MusicBar safe areas and virtual-list parents.
- [ ] Confirm primary/secondary panes have `minWidth: 0` and scrolling parents
  have `minHeight: 0` where needed.
- [ ] Check medium and large car-font metrics against 1920×1080 physical target
  represented by plausible logical sizes; do not add physical pixel branches.

Static audit checkpoint:

```powershell
rg -n "width:\s*rpx\((500|620|750)\)|primaryWeight=\{(38|50|62)\}|secondaryWeight=\{(38|50|62)\}" src
```

Review each remaining hit as an intentional content size or remove it.

## 7. Full quality gate

- [ ] Run the complete frontend and native checks:

```powershell
npx tsc --noEmit
npx jest --runInBand
npx eslint src --ext .js,.jsx,.ts,.tsx
Push-Location android
.\gradlew.bat :app:compileDebugKotlin
.\gradlew.bat :app:assembleDebug :app:assembleRelease
Pop-Location
```

- [ ] Inspect the full diff for secrets, password logging, unrelated formatting,
  stale picker references and unbounded layouts.
- [ ] Verify universal APK manifests report
  `package="fun.upup.musicfree.car"`, minSdk 24 and the expected application
  label.
- [ ] Run `apksigner verify --print-certs` on debug and release universal APKs;
  report whether release used the repository's fallback debug key.
- [ ] If ADB becomes available, install alongside the original and capture the
  1920×1080 medium/large car-mode matrix. Otherwise provide both APKs plus a
  concise user-side visual/FTP smoke checklist and state that live-device
  verification remains pending.

## 8. Trellis finish gates

- [ ] Run `trellis-check` full-scope and fix findings until green.
- [ ] Run `trellis-update-spec` judgment for FTP bridge security and semantic
  split conventions.
- [ ] Present the task-related commit plan; commit only after the user's one-shot
  approval, then archive and record the session per Trellis.
