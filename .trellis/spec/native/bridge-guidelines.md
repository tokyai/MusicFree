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

## Scenario: One-Shot LAN Backup Transport

### 1. Scope / Trigger

Use this contract when changing the Android LAN backup bridge, its typed
wrapper, or `src/core/lanBackup.ts`. It moves an existing backup between the
car unit and a phone browser without invoking Android's file picker.

### 2. Signatures

- `LanBackup.startServer({ mode, backupJson?, maxBytes?, timeoutMs? })`
  returns `Promise<{ url, expiresAt, mode }>`.
- `LanBackup.waitForTransfer()` returns
  `Promise<{ bytes, payload? }>`; `payload` exists only for restore uploads.
- `LanBackup.stopServer(): void` is idempotent cleanup.
- Core entry points are `startLanBackup()`, `startLanResume(resumeMode)`, and
  `cancelLanBackup()`.
- Native module name: `LanBackup`.

### 3. Contracts

- Bind a random port on a non-loopback LAN IPv4 address and require a random
  128-bit token on every request. Only one session and one transfer waiter may
  be active; a new session cancels the previous one.
- `GET /?token=...` serves the phone page. Backup mode permits one
  `GET /download?token=...`; restore mode permits one
  `POST /upload?token=...` with `Content-Length`.
- Defaults are a 16 MiB payload limit and a 10-minute lifetime. Configurable
  bounds are 1 KiB to 64 MiB and 30 seconds to 30 minutes.
- Native code validates HTTP framing, token, size, and strict UTF-8 only. It
  must not parse the MusicFree schema. TypeScript calls `parseBackupPayload`
  before `Backup.resume`, so an invalid upload never mutates storage.
- A successful transfer, timeout, explicit stop, superseding start, or module
  invalidation closes both the listening socket and any accepted client socket
  and settles the pending promise once.
- The service is Android-only and guarded by the typed wrapper's
  `isSupported`; FTP/FTPS, WebDAV, and URL restore behavior stays independent.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| No usable LAN IPv4 address | Reject `LAN_NETWORK_UNAVAILABLE` |
| Wrong token, method, path, or HTTP framing | Return 4xx to that client; keep the session available |
| Missing length or payload above limit | Return 411/413; do not expose an upload payload |
| Malformed UTF-8 | Return 400; do not expose an upload payload |
| Session expires | Reject `LAN_TIMEOUT` and close sockets |
| Explicit stop or superseding start | Reject the waiter with `LAN_CANCELLED` and close sockets |
| Second waiter | Reject `LAN_BUSY` without replacing the first waiter |
| Uploaded JSON fails `parseBackupPayload` | Reject `LAN_INVALID_BACKUP`; do not call `Backup.resume` |

### 5. Good / Base / Bad Cases

- Good: the phone downloads or uploads once, the dialog completes, and the
  port disappears immediately.
- Base: a bad token or malformed request receives an error while the same
  short-lived session remains available for a correct retry.
- Bad: binding all interfaces, logging the token or payload, parsing sheet
  fields in Kotlin, or closing only the server socket while a client read is
  still blocked.

### 6. Tests Required

- TypeScript tests assert backup serialization, upload parsing before restore,
  invalid-shape rejection, unsupported-platform behavior, and cancellation.
- Run TypeScript checks and `:app:compileDebugKotlin` after contract changes.
- With Android available, exercise page access, wrong-token retry, successful
  download/upload, invalid backup rejection, explicit cancellation, and verify
  the ephemeral port closes after every terminal path.
- Packaging checks verify the universal APK manifest, application id, and
  signature.

### 7. Wrong vs Correct

```kotlin
// Wrong: stop accepting new clients but leave a partial upload blocked.
activeSocket?.close()

// Correct: cancellation owns and closes both socket boundaries.
activeClient?.close()
activeSocket?.close()
```
