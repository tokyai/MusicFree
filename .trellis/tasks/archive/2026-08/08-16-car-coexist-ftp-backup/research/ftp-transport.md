# FTP/FTPS transport research

## Repository constraints

- `android/build.gradle` sets `minSdkVersion = 24`, `targetSdkVersion = 30`.
- `android/app/src/main/AndroidManifest.xml` already grants `INTERNET` and sets
  `android:usesCleartextTraffic="true"`, so an explicitly selected plain FTP
  connection is permitted on the current target SDK.
- Native modules are manually registered through `MainApplication.kt` and use a
  `ReactContextBaseJavaModule` plus a `ReactPackage`.

## Library choice

Apache Commons Net `commons-net:commons-net:3.11.1` is the conservative choice:

- The 3.11.1 POM targets Java 8, which is compatible with the Android Gradle
  toolchain used by this project and API 24.
- Its runtime artifact has no required Commons IO dependency (Commons IO is
  test-scoped in the POM), keeping the Android dependency surface small.
- `FTPClient` provides passive mode, binary transfer, connect/default/data
  timeouts, `storeFile`, `retrieveFile`, directory changes and rename/delete.
- `FTPSClient(false)` is explicit FTPS (AUTH TLS on the normal FTP control
  connection), not implicit FTPS/990.

References:

- https://commons.apache.org/proper/commons-net/javadocs/api-3.11.1/
- https://repo1.maven.org/maven2/commons-net/commons-net/3.11.1/commons-net-3.11.1.pom

## FTPS security findings

Commons Net's `FTPSClient` default trust manager only checks certificate
validity dates; it does not use the platform trust store. The implementation
must explicitly set `TrustManagerUtils.getDefaultTrustManager(null)` and enable
`setEndpointCheckingEnabled(true)` so system CA and hostname verification are
used. It must then call `execPBSZ(0)` and `execPROT("P")` before data transfers.

The FTPS branch must never retry as plain FTP after a TLS or certificate error.
Plain FTP is reachable only when the persisted mode is explicitly `ftp`.

## Transfer contract

- Connect/login/change to the configured remote directory in a worker executor.
- Use passive mode and `FTP.BINARY_FILE_TYPE`.
- Upload to a unique temporary name, rotate an existing formal file to a
  recovery name, rename the new file to `MusicFreeBackup.json`, then delete the
  recovery name after success. If the second rename fails, attempt rollback so
  the previous formal file remains available.
- Download only the formal file to an app-cache temporary file. JS validates
  UTF-8/JSON before calling `Backup.resume` and deletes the temporary file in a
  `finally` block.
- Map reply codes and exceptions to stable bridge error codes; never include the
  password in logs or messages.
