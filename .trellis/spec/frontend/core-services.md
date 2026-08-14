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
