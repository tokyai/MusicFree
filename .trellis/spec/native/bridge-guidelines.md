# Native Bridge Guidelines

## Android Module Pattern

- Extend `ReactContextBaseJavaModule`, return a stable name from `getName()`,
  and mark JavaScript-callable methods with `@ReactMethod`.
- Validate inputs before starting expensive work. The audio clipper validates
  URL scheme, start time, and duration in
  `audioClipper/AudioClipperModule.kt`.
- Move blocking media or file work off the React Native thread. Own the
  executor/task lifecycle in the module.
- Resolve a structured map on success and reject with stable error codes on
  failure. Delete partial temporary output before rejecting.
- Provide cancellation when work can outlive the caller, and release tasks or
  executors from `invalidate()`.

## TypeScript Wrapper Pattern

- Define the method and result interfaces next to the wrapper.
- Check `Platform.OS` and native module presence. Expose an `isSupported` flag
  when callers need capability checks.
- Reject unsupported required operations with a clear Error; make optional
  cleanup methods safe when the module is absent.

## Registration

- Add a `ReactPackage` and register it in `MainApplication.getPackages()` when
  autolinking is unavailable.
- Keep the JavaScript module name identical to the native `getName()` value.
