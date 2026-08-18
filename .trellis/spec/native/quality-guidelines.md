# Native Quality Guidelines

## Compatibility

- The current Android minimum is API 26 (`android/build.gradle`) because the
  bundled libmpv AAR requires Android 8. Do not claim Android 7/API 25 or lower
  compatibility without replacing the dependency and completing a build audit.
- Preserve `MainActivity` configuration-change handling for orientation and
  screen-size changes.
- Shared TypeScript UI may target Android and iOS, but platform-specific native
  behavior must remain guarded.

## Resource Safety

- Close or release codecs, extractors, muxers, streams, cursors, and executors
  in `finally`/lifecycle cleanup paths.
- Check cancellation inside long loops, not only before starting.
- Store temporary files in application cache and delete failed or cancelled
  output.

## Verification

- Run `gradlew.bat :app:compileDebugKotlin` from `android/` after Kotlin or
  package-registration changes.
- Run `gradlew.bat :app:mergeDebugAssets` after bundled asset changes.
- Run `npx tsc --noEmit` after changing a TypeScript bridge contract.
- Exercise success, validation failure, cancellation, and unsupported-platform
  behavior when a device or emulator is available.
