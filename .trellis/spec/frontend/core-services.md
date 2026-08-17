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

- Search the target plugin with `title + artist`, then `title`, page 1 only;
  candidates must pass title `>= 0.90`, artist `>= 0.85`, total `>= 0.90`,
  edition-tag equality, and duration tolerance `max(4 seconds, 4%)`.
- `platform@id` is an identity/duplicate key only. IDs from different
  platforms never establish a match.
- A candidate is accepted only when it has a valid direct URL or the target
  plugin resolves at least one configured quality URL.
- The service uses at most two workers, checks `AbortSignal` before each new
  request, and returns `cancelled: true` without a persistence side effect.
- Normal completion preserves `$timestamp`/`$sortIndex` and the original list
  position; temporary stream-validation URLs are not copied into replacements.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Missing/invalid legacy media fields | `failures: no-match`; original stays |
| Same target identity already in the sheet or batch | `skipped: duplicate` |
| Same target platform as the selected item | `skipped: already-target` |
| Version mismatch, ambiguity, no result, or unplayable candidate | Failure; no replacement |
| User cancellation / aborted signal | Discard all candidates; do not call `replaceMusicItems` |
| Storage commit failure | Surface a translated warning and log through `devLog` |

### 5. Good / Base / Bad Cases

- Good: the UI snapshots selected items, lets the service validate them, then
  commits only an un-cancelled result and refreshes the editor atom.
- Base: a failed or duplicate song remains in its original position and source.
- Bad: comparing only IDs, taking the first search result, or writing a
  resolved temporary URL back into the favorite item.

### 6. Tests Required

- Pure matcher tests cover normalization, edition compatibility, duration
  bounds, cross-platform IDs, and ambiguity margins.
- Service tests cover malformed search payloads, unavailable-best-candidate
  fallback with rechecked ambiguity, duplicate prevention, cancellation, and
  invalid legacy records.
- Persistence tests assert identity-index rebuild, order and metadata
  preservation, and rejection of existing/repeated target identities.

### 7. Wrong vs Correct

```ts
// Wrong: UI trusts the first result and mutates the sheet while requests run.
const match = (await plugin.search(title, 1, "music")).data[0];
await MusicSheet.addMusic("favorite", [match]);

// Correct: service validates a strict candidate set; UI commits once.
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
