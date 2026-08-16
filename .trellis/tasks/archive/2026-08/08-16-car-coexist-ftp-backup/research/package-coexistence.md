# Android coexistence audit

- The current Gradle `applicationId` and Android manifest/Kotlin namespace are
  `fun.upup.musicfree`. A distinct `applicationId` is sufficient for Android
  package/data isolation; native Kotlin package directories can remain intact.
- The React Native component name is the `name` field in `app.json` and is
  consumed by `MainActivity.getMainComponentName()`/`AppRegistry`; keep it as
  `MusicFree`. Change only `displayName`/Android `app_name` for the visible
  label, avoiding an unnecessary component rename.
- No provider authority or custom file-provider authority is present.
- Both installed packages would currently claim the `musicfree://` deep-link
  scheme. Keeping the scheme preserves existing plugin links but may make
  Android show an app chooser when both versions are installed. Changing the
  scheme would break existing links; this task therefore preserves it and
  limits the coexistence acceptance criterion to installation/data isolation.
