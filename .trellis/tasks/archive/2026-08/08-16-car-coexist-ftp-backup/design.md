# Technical Design

## 1. Scope and ownership

This task spans four existing boundaries without creating a new subsystem:

1. Android identity/resources own the coexisting package ID and visible name.
2. A small Android native module owns blocking FTP/FTPS sockets and files.
3. `src/core/` owns backup orchestration, validation and temporary-file cleanup.
4. Existing settings/layout components own user interaction and presentation.

The current `Backup` service remains the only owner of backup serialization and
restore semantics. The new transport must not duplicate playlist/plugin restore
rules.

## 2. Android package coexistence

- Change only Gradle `applicationId` to `fun.upup.musicfree.car`.
- Change Android `app_name`, playback channel display name and `app.json`'s
  human-facing `displayName` to `MusicFree车机版`.
- Keep `app.json.name`, `MainActivity.getMainComponentName()`, namespace,
  manifest package and Kotlin packages as `MusicFree`/`fun.upup.musicfree`.
- Keep the `musicfree://` scheme so existing network plugin links still work.
  With both packages installed Android may show a chooser; that is preferable
  to silently breaking existing links and is outside the data-isolation
  acceptance criterion.

No provider authorities are present, so no authority migration is needed.

## 3. FTP/FTPS layers

### 3.1 Persisted configuration

Add these keys to `IAppConfigProperties` and use the existing `AppConfig`
storage:

| Key | Type | Unset behavior |
| --- | --- | --- |
| `ftp.mode` | `"ftp" | "ftps"` | `"ftps"` |
| `ftp.host` | `string` | empty/invalid |
| `ftp.port` | `number` | `21` |
| `ftp.username` | `string` | empty/invalid |
| `ftp.password` | `string` | empty/invalid |
| `ftp.remoteDirectory` | `string` | `/MusicFree` |

No schema migration is required because all keys are additive and consumers
provide defaults with `??`.

The password uses the same app-private MMKV path as the existing WebDAV
password. It must be masked in the settings panel and never passed to logging.

### 3.2 TypeScript core service

Create `src/core/ftpBackup.ts` as the orchestration owner. It will:

- read/normalize the persisted configuration;
- reject a missing host/account/password, invalid port, URL-like host or unsafe
  remote directory before invoking native code;
- expose test, backup, restore and cancel operations;
- write `Backup.backup()` to a unique local cache file in chunks;
- call the typed native wrapper with the cache path;
- read and validate a downloaded UTF-8 JSON file before `Backup.resume()`;
- delete every local temporary file in `finally`;
- convert stable native error codes into localized user-facing messages.

Enhance `Backup.resume()`/a sibling parser so parsing and structural validation
remain at one boundary. A valid payload has playlist and plugin arrays in the
shape produced by `Backup.backup()`; invalid input fails before any restore
operation begins.

### 3.3 Typed native wrapper

Create `src/native/ftpBackup/index.ts` with:

- typed options and result interfaces;
- `isSupported` for Android module presence;
- `testConnection`, `uploadBackup`, `downloadBackup` and
  `cancelPendingOperation` methods;
- an explicit unsupported-platform error instead of dereferencing an absent
  native module.

### 3.4 Android module

Add Apache Commons Net `3.11.1` and a manually registered `FtpBackupPackage` /
`FtpBackupModule` under the existing Kotlin namespace.

The module owns a single-thread executor, one active task and one active
client. Every bridge method validates input before submission. A new operation
cancels the old one; explicit cancellation closes the active socket, interrupts
the task, and invalidation shuts down the executor.

The bridge contract is:

| Method | Input | Success |
| --- | --- | --- |
| `testConnection` | normalized options | resolved void/map |
| `uploadBackup` | options + local cache path | uploaded size/result map |
| `downloadBackup` | options | local cache path + byte size |
| `cancelPendingOperation` | none | best-effort synchronous cancellation |

The module accepts only the fixed formal filename `MusicFreeBackup.json`; JS
supplies the directory and local source path, not arbitrary remote filenames.

## 4. Connection and security contract

For both modes:

1. Set connect/default/data timeouts and UTF-8 control encoding.
2. Connect and verify a positive server welcome reply.
3. Authenticate and map a rejected login to `FTP_AUTH_FAILED`.
4. Enter passive mode and binary transfer mode.
5. Change to the configured directory; do not silently create it.
6. Perform the requested test/transfer.
7. Logout/disconnect and close streams in `finally`.

For FTPS only:

- instantiate explicit `FTPSClient(false)`;
- replace Commons Net's validity-only trust manager with
  `TrustManagerUtils.getDefaultTrustManager(null)`;
- call `setEndpointCheckingEnabled(true)`;
- after login call `execPBSZ(0)` and `execPROT("P")` so the data channel is
  encrypted;
- treat certificate, hostname, AUTH TLS, PBSZ or PROT errors as FTPS failures;
- never re-enter the FTP branch as a fallback.

Plain FTP uses `FTPClient` only after the saved mode explicitly equals `ftp`.

## 5. Remote replacement state machine

FTP servers differ on whether rename can overwrite an existing target. Use a
rotation state machine instead of delete-then-rename:

1. Upload to `.MusicFreeBackup.json.uploading-<timestamp>`.
2. If the formal file exists, remove a stale recovery file, then rename the
   formal file to `.MusicFreeBackup.json.previous`.
3. Rename the uploaded temporary file to `MusicFreeBackup.json`.
4. On success, delete the recovery file.
5. If step 3 fails, delete any partial formal target and rename the recovery
   file back. If rollback itself fails, keep the recovery file and return a
   dedicated replacement/rollback error rather than deleting it.
6. On every pre-commit failure or cancellation, delete the uploading file.

This is the strongest portable behavior available through FTP commands; the
protocol cannot guarantee filesystem-level atomic replace on every server.

## 6. Restore data flow

```text
Settings confirmation
  -> ftpBackup core validation
  -> native download into app cache
  -> read UTF-8 text
  -> Backup payload parse/shape validation
  -> Backup.resume(current ResumeMode)
  -> local temp cleanup
```

No local state is changed before validation succeeds. `Backup.resume()` remains
responsible for playlist and plugin updates.

## 7. Error contract

Native rejects with stable codes; UI localizes the code and may append a safe
server message. Passwords and full option maps are never logged.

| Code family | Examples |
| --- | --- |
| validation/support | `FTP_INVALID_CONFIG`, `FTP_UNSUPPORTED` |
| connection | `FTP_DNS_FAILED`, `FTP_CONNECT_TIMEOUT`, `FTP_NETWORK_FAILED` |
| security/auth | `FTP_AUTH_FAILED`, `FTP_TLS_FAILED` |
| remote state | `FTP_DIRECTORY_NOT_FOUND`, `FTP_FILE_NOT_FOUND` |
| transfer/commit | `FTP_UPLOAD_FAILED`, `FTP_DOWNLOAD_FAILED`, `FTP_REPLACE_FAILED` |
| lifecycle | `FTP_CANCELLED` |

Unexpected errors fall back to a generic localized failure plus a safe message.

## 8. Settings UX

The backup page keeps the existing `ResumeMode`, URL restore and WebDAV paths,
but removes local backup/restore actions. FTP/FTPS becomes the primary remote
section with:

- a mode row showing FTP or FTPS;
- a masked server-settings panel for host, port, username, password and remote
  directory;
- an FTPS/FTP security description that changes with the selected mode;
- test connection, backup and restore actions;
- loading/cancel behavior and a restore confirmation dialog.

Extend the existing `SetUserVariables` panel only with optional secure-key and
keyboard-type props; plugin callers keep their current behavior.

## 9. Removing unsafe picker paths

Remove the action and unused imports for:

- local backup and local restore;
- local plugin installation;
- raw/translated local lyric upload;
- playlist-cover picking in both editor implementations;
- custom-theme background picking.

Remove the JS-file Android intent filters and the bootstrap branch that installs
plugins from local file/content URLs. Preserve network plugin installation,
subscription updates, `musicfree://install`, audio-file intents and the in-app
RNFS directory selector.

Once no live calls remain, remove `expo-document-picker` and
`react-native-image-picker` from both lockfile ecosystems to prevent accidental
native registration of the unsupported capabilities.

## 10. Car layout design

### 10.1 Semantic split presets

Add a pure preset resolver next to display metrics and a `carPreset` prop on
`ResponsiveSplitView`. When car mode is enabled the preset overrides weights;
otherwise existing explicit/default weights win unchanged.

| Preset | Weights |
| --- | ---: |
| `navigation` | 24:76 |
| `home` | 28:72 |
| `metadata` | 30:70 |
| `player` | 42:58 |
| `secondaryActions` | 74:26 |
| `balanced` | 50:50 |

Assign a preset to every current split consumer. Update the artist tab-view
initial width through the same resolver so nested content does not retain the
old 62% assumption.

### 10.2 Overlays and drawer

- Reduce car drawer bounds to approximately 26% with a 200dp minimum and 420dp
  maximum, always clamped to available safe width.
- Reduce the landscape panel minimum/ratio so it does not consume most of a
  731dp logical-wide emulator while retaining enough room for forms.
- Reduce dialog maximums while keeping safe margins and content scrolling.
- Correct `DrawerContentScrollView` prop spreading and replace header
  `width + marginLeft` with bounded padding.

Exact overlay bounds remain pure constants covered by tests; they do not depend
on physical 1920/1080 checks.

### 10.3 Fixed-width cleanup

Change page/panel wrappers that use `rpx(750)` and list/action rows that can
overflow to `width: "100%"`/bounded flex. Keep content-sized artwork and control
dimensions where the existing display-metrics logic already clamps them.

Every modified pane keeps `flex: 1`, `minWidth: 0`, and when applicable
`minHeight: 0`. No per-row window listeners are added.

## 11. Compatibility and rollback

- Minimum Android version stays API 24. Android 6/API 23 is not claimed.
- `usesCleartextTraffic=true` remains because the user explicitly requested a
  plain FTP option; FTPS is still the unset/default mode.
- Existing app data is not migrated because the new application ID creates a
  separate sandbox by design. Users may populate it through FTP/FTPS restore.
- Removing the new package and reinstalling the previous APK is the application
  rollback. FTP uploads preserve a previous remote copy during replacement.
- If a layout preset regresses a page, removing that consumer's `carPreset`
  restores its old weights without changing phone layout.
