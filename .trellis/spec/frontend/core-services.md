# Core Services And Boundaries

## Core Ownership

- Keep domain orchestration in `src/core/`, outside visual components.
  `TrackPlayer`, `PluginManager`, `MusicSheet`, `Downloader`, and
  `lyricManager` are established owners.
- Components should call typed manager methods and subscribe through exported
  hooks or atoms. They should not duplicate queue, plugin capability, download,
  or lyric-selection rules.
- Register application bootstrap work through `src/entry/bootstrap/bootstrap.ts`
  or `BootstrapComponent`; do not run substantial side effects at arbitrary
  module import sites.

## Plugins And External Data

- Check plugin capabilities through `PluginManager` before invoking optional
  plugin functions.
- Treat plugin and network payloads as untrusted at the boundary. Normalize
  them into the project's media types before rendering or storing them.
- Keep request state and retries visible to the caller. Use the shared
  `RequestStateCode`, `ListEmpty`, and `ListFooter` behavior.

## Errors, Logging, And Cancellation

- Surface recoverable user-facing failures through the existing Toast/Dialog
  helpers and retain actionable context in logs.
- Use the logging helpers in `src/utils/log.ts` instead of adding an unrelated
  logging framework.
- Long-running media, network, timer, WebView, and native operations must expose
  cancellation and release temporary data. The Bilibili recognition flow and
  `AudioClipper` wrapper are reference implementations.

## Cross-Layer Changes

- A setting change normally touches its type, default/consumer, settings UI,
  and all language files.
- A native feature normally touches Kotlin/Objective-C implementation,
  registration, a typed `src/native` wrapper, and a platform support guard.

## Scenario: Favorite Batch Source Switching

### 1. Scope / Trigger

This contract applies when the favorite editor migrates selected songs from
one enabled search plugin to another. It crosses the editor UI, plugin search
and stream resolution, the music-sheet store, and persisted music-list data.

### 2. Signatures

- `batchSwitchMusicSources(options): Promise<IMusicSourceSwitchResult>` in
  `src/core/musicSourceSwitcher.ts`.
- `MusicSheet.replaceMusicItems(sheetId, replacements): Promise<number>`
  persists accepted replacements in one list write.
- The UI starts the service with an `AbortSignal`; it is the only layer that
  decides whether a completed result is committed.

### 3. Contracts

- Search the target plugin with `title + artist`, then `title`, page 1 only.
  Candidates must contain `id`, `platform`, `title`, and `artist`, then pass
  normalized title `>= 0.85`, artist `>= 0.80`, and total `>= 0.82`.
- Album, duration, and edition tags are ranking signals only. Differences in
  those fields must not reject an otherwise matching title/artist pair. Equal
  scores preserve plugin result order instead of failing as ambiguous.
- `platform@id` is an identity/duplicate key only. IDs from different
  platforms never establish a match.
- A candidate is accepted only when it has a valid direct URL or the target
  plugin resolves at least one configured quality URL.
- The service uses at most two workers, checks `AbortSignal` before each new
  request, and returns `cancelled: true` without a persistence side effect.
- Every valid item already in the sheet remains an occupied target identity,
  including selected items that already use the target plugin. Each accepted
  batch candidate reserves its target identity before another worker commits.
- Normal completion preserves `$timestamp`/`$sortIndex` and the original list
  position; temporary stream-validation URLs are not copied into replacements.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Missing/invalid legacy media fields | `failures: no-match`; original stays |
| Same target identity already in the sheet or batch | `skipped: duplicate` |
| Same target platform as the selected item | `skipped: already-target` |
| Title/artist below threshold, no result, or unplayable candidate | Failure; no replacement |
| Same title/artist but different album, duration, or edition | Rank candidates; do not reject for that difference alone |
| User cancellation / aborted signal | Discard all candidates; do not call `replaceMusicItems` |
| Storage commit failure | Surface a translated warning and log through `devLog` |

### 5. Good / Base / Bad Cases

- Good: the UI snapshots selected items, lets the service validate them, then
  commits only an un-cancelled result and refreshes the editor atom.
- Good: a QQ and Kugou item with matching normalized title/artist can replace
  each other even when one plugin reports a different album or duration.
- Base: a failed or duplicate song remains in its original position and source.
- Bad: comparing only IDs, restoring strict duration/edition rejection, or
  writing a resolved temporary URL back into the favorite item.

### 6. Tests Required

- Pure matcher tests cover normalization, title/artist thresholds,
  cross-platform IDs, metadata differences, and deterministic equal scores.
- Service tests cover malformed search payloads, unavailable-best-candidate
  fallback, both QQ/Kugou directions, duplicate prevention, cancellation, and
  invalid legacy records.
- Persistence tests assert identity-index rebuild, order and metadata
  preservation, and rejection of existing/repeated target identities.

### 7. Wrong vs Correct

```ts
// Wrong: duration is a hard cross-platform identity requirement.
if (Math.abs(source.duration - candidate.duration) > 4) return null;

// Correct: the shared matcher gates on normalized title/artist and uses
// duration, album, and edition only to rank valid candidates.
const result = await batchSwitchMusicSources({
    musicItems,
    existingMusicItems,
    targetPlugin,
    signal,
});
if (!result.cancelled) {
    await MusicSheet.replaceMusicItems("favorite", result.replacements);
}
```
