# Native Directory Structure

- Android application code lives under
  `android/app/src/main/java/fun/upup/musicfree/`.
- Give each custom bridge a feature package containing its module and
  `ReactPackage`, such as `audioClipper/AudioClipperModule.kt` and
  `audioClipper/AudioClipperPackage.kt`.
- Register non-autolinked packages in
  `android/app/src/main/java/fun/upup/musicfree/MainApplication.kt`.
- Put bundled WebView or native-consumed assets under
  `android/app/src/main/assets/<feature>/` and include third-party notices when
  applicable.
- Expose native features to TypeScript through a focused wrapper under
  `src/native/<feature>/index.ts`.
- Keep iOS code in `ios/MusicFree/`; do not claim iOS support from a shared
  wrapper unless an iOS implementation exists.

Do not call `NativeModules` directly from screens or core orchestration when a
typed wrapper can own platform detection and the native contract.
