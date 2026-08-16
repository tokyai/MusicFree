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

## Scenario: FTP/FTPS Backup Transport

### 1. Scope / Trigger

Use this contract when changing the Android FTP backup bridge, its typed
wrapper, or the `src/core/ftpBackup.ts` orchestration boundary. The bridge is
Android-only and the project minimum remains API 24.

### 2. Signatures

- `normalizeFtpBackupOptions(settings): IFtpConnectionOptions`
- `FtpBackup.testConnection(options): Promise<void>`
- `FtpBackup.uploadBackup(options, localCachePath): Promise<{ bytes: number }>`
- `FtpBackup.downloadBackup(options): Promise<{ path: string; bytes: number }>`
- `FtpBackup.cancelPendingOperation(): void`
- Native module name: `FtpBackup`; methods mirror the wrapper signatures.

### 3. Contracts

- Options contain `mode`, `host`, `port`, `username`, `password`,
  `remoteDirectory`, `connectTimeoutMs`, and `readTimeoutMs`.
- `mode` is `ftp` or explicit `ftps`; FTPS uses the system trust manager,
  endpoint checking, `PBSZ 0`, and `PROT P`. TLS failure never falls back to
  plain FTP.
- The only formal remote name is `MusicFreeBackup.json`. Upload through a
  unique temporary name, rotate the prior file, then rename into place.
- Local upload/download files must stay under the application cache. Blocking
  I/O runs on the module executor, supports cancellation, and closes sockets
  and streams in `finally` paths.
- JavaScript validates downloaded UTF-8 JSON before invoking restore logic and
  removes temporary files after success, failure, or cancellation.

### 4. Validation & Error Matrix

| Condition | Required code |
| --- | --- |
| Invalid host, port, credentials, directory, or timeout | `FTP_INVALID_CONFIG` |
| DNS lookup failure | `FTP_DNS_FAILED` |
| Authentication rejected | `FTP_AUTH_FAILED` |
| Certificate, hostname, AUTH TLS, PBSZ, or PROT failure | `FTP_TLS_FAILED` |
| Missing/inaccessible directory | `FTP_DIRECTORY_NOT_FOUND` |
| Missing backup file | `FTP_FILE_NOT_FOUND` |
| Upload/download/replace failure | Matching `FTP_*_FAILED` code |
| Explicit or superseding cancellation | `FTP_CANCELLED` |

### 5. Good / Base / Bad Cases

- Good: explicit FTPS uploads from cache, protects both channels, rotates the
  prior backup, and deletes the local staging file.
- Base: plain FTP is used only after the persisted mode explicitly selects it;
  the remaining validation and cleanup contracts stay identical.
- Bad: accepting a shared-storage path, logging the options map, deleting the
  formal backup before a replacement is ready, or retrying FTPS as FTP.

### Replacement cancellation invariant

When an upload has already renamed `MusicFreeBackup.json` to
`.MusicFreeBackup.json.previous`, cancellation or any later commit failure must
run the same rollback path as an ordinary replacement failure. That path may
delete a partial formal target, but it must attempt to rename `.previous` back
to the formal filename before rejecting. If the rollback cannot be completed,
leave `.previous` on the server and report `FTP_REPLACE_FAILED`; never report a
successful upload while the formal backup is missing.

### 6. Tests Required

- Unit-test defaults and invalid host/port/directory/credential inputs before
  native work starts.
- Assert native error codes pass through and staging/download files are removed
  on failures.
- Exercise cancellation both before and after the formal file is rotated;
  after-rotation cancellation must restore the previous formal file (or keep
  the `.previous` recovery file and return `FTP_REPLACE_FAILED` when rollback
  itself fails).
- Assert invalid JSON and invalid backup shapes never call restore mutation.
- Run TypeScript checks, focused Jest tests, and Android Kotlin compilation;
  verify the final universal APK manifest and signature when packaging.

### 7. Wrong vs Correct

```kotlin
// Wrong: validity-only trust and unprotected data channel
FTPSClient(false)

// Correct: platform trust, hostname verification, and protected data channel
val client = FTPSClient(false).apply {
    setTrustManager(TrustManagerUtils.getDefaultTrustManager(null))
    setEndpointCheckingEnabled(true)
}
client.execPBSZ(0L)
client.execPROT("P")
```
