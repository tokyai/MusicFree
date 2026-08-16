package `fun`.upup.musicfree.ftpBackup

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import org.apache.commons.net.ftp.FTP
import org.apache.commons.net.ftp.FTPClient
import org.apache.commons.net.ftp.FTPReply
import org.apache.commons.net.ftp.FTPSClient
import org.apache.commons.net.util.TrustManagerUtils
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.CancellationException
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicLong
import javax.net.ssl.SSLException

class FtpBackupModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
    private val executor = Executors.newSingleThreadExecutor()
    private val requestGeneration = AtomicLong(0)

    @Volatile
    private var activeTask: Future<*>? = null

    @Volatile
    private var activeClient: FTPClient? = null

    override fun getName() = "FtpBackup"

    @ReactMethod
    fun testConnection(rawOptions: ReadableMap, promise: Promise) {
        val options = parseOptionsOrReject(rawOptions, promise) ?: return
        submit(options, promise) { generation ->
            withConnectedClient(options, generation) {
                ensureActive(generation)
            }
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun uploadBackup(rawOptions: ReadableMap, localPath: String, promise: Promise) {
        val options = parseOptionsOrReject(rawOptions, promise) ?: return
        val source = try {
            validateLocalCacheFile(localPath)
        } catch (error: Exception) {
            reject(promise, error, options.mode)
            return
        }

        submit(options, promise) { generation ->
            withConnectedClient(options, generation) { client ->
                uploadWithRotation(client, source, generation)
            }
            ensureActive(generation)
            promise.resolve(
                Arguments.createMap().apply {
                    putDouble("bytes", source.length().toDouble())
                },
            )
        }
    }

    @ReactMethod
    fun downloadBackup(rawOptions: ReadableMap, promise: Promise) {
        val options = parseOptionsOrReject(rawOptions, promise) ?: return
        submit(options, promise) { generation ->
            val outputFile = File.createTempFile(
                "musicfree-ftp-restore-",
                ".json",
                reactContext.cacheDir,
            )
            var keepOutput = false
            try {
                withConnectedClient(options, generation) { client ->
                    downloadToFile(client, outputFile, generation)
                }
                ensureActive(generation)
                promise.resolve(
                    Arguments.createMap().apply {
                        putString("path", outputFile.absolutePath)
                        putDouble("bytes", outputFile.length().toDouble())
                    },
                )
                keepOutput = true
            } finally {
                if (!keepOutput) outputFile.delete()
            }
        }
    }

    @ReactMethod
    fun cancelPendingOperation() {
        requestGeneration.incrementAndGet()
        cancelActiveResources()
    }

    private fun submit(
        options: ConnectionOptions,
        promise: Promise,
        operation: (Long) -> Unit,
    ) {
        val generation = requestGeneration.incrementAndGet()
        cancelActiveResources()
        activeTask = executor.submit {
            try {
                ensureActive(generation)
                operation(generation)
            } catch (error: Exception) {
                reject(promise, error, options.mode)
            } finally {
                if (generation == requestGeneration.get()) {
                    activeTask = null
                }
            }
        }
    }

    private fun withConnectedClient(
        options: ConnectionOptions,
        generation: Long,
        operation: (FTPClient) -> Unit,
    ) {
        val client = createClient(options)
        activeClient = client
        try {
            ensureActive(generation)
            client.connect(options.host, options.port)
            ensureActive(generation)
            if (!FTPReply.isPositiveCompletion(client.replyCode)) {
                throw FtpOperationException(
                    "FTP_NETWORK_FAILED",
                    "FTP server rejected the connection",
                )
            }
            client.soTimeout = options.readTimeoutMs
            if (!client.login(options.username, options.password)) {
                throw FtpOperationException(
                    "FTP_AUTH_FAILED",
                    "FTP authentication failed",
                )
            }
            if (client is FTPSClient) {
                try {
                    client.execPBSZ(0L)
                    if (!FTPReply.isPositiveCompletion(client.replyCode)) {
                        throw FtpOperationException(
                            "FTP_TLS_FAILED",
                            "Could not set the FTPS protection buffer",
                        )
                    }
                    client.execPROT("P")
                    if (!FTPReply.isPositiveCompletion(client.replyCode)) {
                        throw FtpOperationException(
                            "FTP_TLS_FAILED",
                            "Could not protect the FTPS data connection",
                        )
                    }
                } catch (error: Exception) {
                    throw FtpOperationException(
                        "FTP_TLS_FAILED",
                        "Could not protect the FTPS data connection",
                        error,
                    )
                }
            }
            client.enterLocalPassiveMode()
            if (!client.setFileType(FTP.BINARY_FILE_TYPE)) {
                throw FtpOperationException(
                    "FTP_NETWORK_FAILED",
                    "FTP server rejected binary transfer mode",
                )
            }
            if (!client.changeWorkingDirectory(options.remoteDirectory)) {
                throw FtpOperationException(
                    "FTP_DIRECTORY_NOT_FOUND",
                    "FTP backup directory does not exist or is not accessible",
                )
            }
            ensureActive(generation)
            operation(client)
        } finally {
            try {
                if (client.isConnected) {
                    client.logout()
                }
            } catch (_: Exception) {
            }
            try {
                if (client.isConnected) {
                    client.disconnect()
                }
            } catch (_: Exception) {
            }
            if (activeClient === client) {
                activeClient = null
            }
        }
    }

    private fun createClient(options: ConnectionOptions): FTPClient {
        val client = if (options.mode == FtpMode.FTPS) {
            FTPSClient(false).apply {
                setTrustManager(TrustManagerUtils.getDefaultTrustManager(null))
                setEndpointCheckingEnabled(true)
            }
        } else {
            FTPClient()
        }
        client.connectTimeout = options.connectTimeoutMs
        client.defaultTimeout = options.connectTimeoutMs
        client.setDataTimeout(options.readTimeoutMs)
        client.controlEncoding = Charsets.UTF_8.name()
        return client
    }

    private fun uploadWithRotation(
        client: FTPClient,
        source: File,
        generation: Long,
    ) {
        val temporaryName =
            ".$BACKUP_FILE_NAME.uploading-${System.currentTimeMillis()}-$generation"
        var committed = false
        var rotatedPrevious = false
        try {
            BufferedInputStream(FileInputStream(source)).use { input ->
                if (!client.storeFile(temporaryName, input)) {
                    throw FtpOperationException(
                        "FTP_UPLOAD_FAILED",
                        "FTP backup upload failed",
                    )
                }
            }
            ensureActive(generation)

            if (remoteFileExists(client, BACKUP_FILE_NAME)) {
                if (
                    remoteFileExists(client, PREVIOUS_FILE_NAME) &&
                    !client.deleteFile(PREVIOUS_FILE_NAME)
                ) {
                    throw FtpOperationException(
                        "FTP_REPLACE_FAILED",
                        "Could not remove the previous FTP recovery file",
                    )
                }
                if (!client.rename(BACKUP_FILE_NAME, PREVIOUS_FILE_NAME)) {
                    throw FtpOperationException(
                        "FTP_REPLACE_FAILED",
                        "Could not rotate the existing FTP backup",
                    )
                }
                rotatedPrevious = true
                ensureActive(generation)
            }

            if (!client.rename(temporaryName, BACKUP_FILE_NAME)) {
                throw FtpOperationException(
                    "FTP_REPLACE_FAILED",
                    "Could not commit the uploaded FTP backup",
                )
            }

            committed = true
            if (rotatedPrevious) {
                client.deleteFile(PREVIOUS_FILE_NAME)
            }
        } catch (error: Exception) {
            if (!committed && rotatedPrevious) {
                rollbackRotation(client)
            }
            throw error
        } finally {
            if (!committed && client.isConnected) {
                try {
                    client.deleteFile(temporaryName)
                } catch (_: Exception) {
                }
            }
        }
    }

    private fun rollbackRotation(client: FTPClient) {
        try {
            if (remoteFileExists(client, BACKUP_FILE_NAME)) {
                client.deleteFile(BACKUP_FILE_NAME)
            }
            if (!client.rename(PREVIOUS_FILE_NAME, BACKUP_FILE_NAME)) {
                throw FtpOperationException(
                    "FTP_REPLACE_FAILED",
                    "FTP backup replacement and rollback both failed; the recovery file was preserved",
                )
            }
        } catch (error: FtpOperationException) {
            throw error
        } catch (error: Exception) {
            throw FtpOperationException(
                "FTP_REPLACE_FAILED",
                "FTP backup replacement and rollback both failed; the recovery file was preserved",
                error,
            )
        }
    }

    private fun downloadToFile(
        client: FTPClient,
        outputFile: File,
        generation: Long,
    ) {
        BufferedOutputStream(FileOutputStream(outputFile)).use { output ->
            if (!client.retrieveFile(BACKUP_FILE_NAME, output)) {
                if (client.replyCode == FILE_UNAVAILABLE_REPLY_CODE) {
                    throw FtpOperationException(
                        "FTP_FILE_NOT_FOUND",
                        "FTP backup file was not found",
                    )
                }
                throw FtpOperationException(
                    "FTP_DOWNLOAD_FAILED",
                    "FTP backup download failed",
                )
            }
        }
        ensureActive(generation)
    }

    private fun remoteFileExists(client: FTPClient, fileName: String): Boolean =
        client.listFiles(fileName).any { it.name == fileName }

    private fun validateLocalCacheFile(localPath: String): File {
        val file = File(localPath).canonicalFile
        val cacheDirectory = reactContext.cacheDir.canonicalFile
        val cachePrefix = cacheDirectory.path + File.separator
        require(file.path.startsWith(cachePrefix)) {
            "Backup source must be inside the application cache"
        }
        require(file.isFile && file.canRead()) { "Backup source is not readable" }
        return file
    }

    private fun parseOptionsOrReject(
        rawOptions: ReadableMap,
        promise: Promise,
    ): ConnectionOptions? = try {
        parseOptions(rawOptions)
    } catch (error: Exception) {
        reject(promise, error, null)
        null
    }

    private fun parseOptions(rawOptions: ReadableMap): ConnectionOptions {
        val mode = when (requiredString(rawOptions, "mode", trim = true)) {
            "ftp" -> FtpMode.FTP
            "ftps" -> FtpMode.FTPS
            else -> throw IllegalArgumentException("FTP mode must be ftp or ftps")
        }
        val host = requiredString(rawOptions, "host", trim = true)
        require(!host.contains("://") && host.none { it.isWhitespace() || it == '/' || it == '\\' }) {
            "FTP host must be a hostname or IP address without a URL scheme"
        }
        val port = requiredInt(rawOptions, "port")
        require(port in 1..65535) { "FTP port must be between 1 and 65535" }
        val username = requiredString(rawOptions, "username", trim = true)
        val password = requiredString(rawOptions, "password", trim = false)
        val remoteDirectory = normalizeRemoteDirectory(
            requiredString(rawOptions, "remoteDirectory", trim = true),
        )
        val connectTimeoutMs = optionalInt(
            rawOptions,
            "connectTimeoutMs",
            DEFAULT_CONNECT_TIMEOUT_MS,
        )
        val readTimeoutMs = optionalInt(
            rawOptions,
            "readTimeoutMs",
            DEFAULT_READ_TIMEOUT_MS,
        )
        require(connectTimeoutMs in MIN_TIMEOUT_MS..MAX_TIMEOUT_MS) {
            "FTP connect timeout is invalid"
        }
        require(readTimeoutMs in MIN_TIMEOUT_MS..MAX_TIMEOUT_MS) {
            "FTP read timeout is invalid"
        }
        return ConnectionOptions(
            mode = mode,
            host = host,
            port = port,
            username = username,
            password = password,
            remoteDirectory = remoteDirectory,
            connectTimeoutMs = connectTimeoutMs,
            readTimeoutMs = readTimeoutMs,
        )
    }

    private fun requiredString(
        map: ReadableMap,
        key: String,
        trim: Boolean,
    ): String {
        require(
            map.hasKey(key) &&
                !map.isNull(key) &&
                map.getType(key) == ReadableType.String,
        ) { "Missing FTP configuration: $key" }
        val rawValue = map.getString(key).orEmpty()
        val value = if (trim) rawValue.trim() else rawValue
        require(value.isNotEmpty()) { "Missing FTP configuration: $key" }
        return value
    }

    private fun requiredInt(map: ReadableMap, key: String): Int {
        require(
            map.hasKey(key) &&
                !map.isNull(key) &&
                map.getType(key) == ReadableType.Number,
        ) { "Missing FTP configuration: $key" }
        val value = map.getDouble(key)
        require(value.isFinite() && value % 1.0 == 0.0) {
            "FTP configuration $key must be an integer"
        }
        return value.toInt()
    }

    private fun optionalInt(map: ReadableMap, key: String, defaultValue: Int): Int {
        if (!map.hasKey(key) || map.isNull(key)) return defaultValue
        require(map.getType(key) == ReadableType.Number) {
            "Invalid FTP configuration: $key"
        }
        val value = map.getDouble(key)
        require(value.isFinite() && value % 1.0 == 0.0) {
            "FTP configuration $key must be an integer"
        }
        return value.toInt()
    }

    private fun normalizeRemoteDirectory(rawDirectory: String): String {
        require(rawDirectory.startsWith("/") && !rawDirectory.contains('\\')) {
            "FTP directory must be an absolute path"
        }
        require(!rawDirectory.contains('\u0000')) { "FTP directory is invalid" }
        val segments = rawDirectory.split('/').filter { it.isNotEmpty() }
        require(segments.none { it == "." || it == ".." }) {
            "FTP directory must not contain relative path segments"
        }
        return if (rawDirectory == "/") "/" else rawDirectory.trimEnd('/')
    }

    private fun ensureActive(generation: Long) {
        if (generation != requestGeneration.get() || Thread.currentThread().isInterrupted) {
            throw CancellationException("FTP operation was cancelled")
        }
    }

    private fun cancelActiveResources() {
        activeTask?.cancel(true)
        activeTask = null
        val client = activeClient
        activeClient = null
        try {
            if (client?.isConnected == true) {
                client.disconnect()
            }
        } catch (_: Exception) {
        }
    }

    private fun reject(promise: Promise, error: Exception, mode: FtpMode?) {
        val mapped = when (error) {
            is FtpOperationException -> error
            is CancellationException -> FtpOperationException(
                "FTP_CANCELLED",
                "FTP operation was cancelled",
                error,
            )
            is UnknownHostException -> FtpOperationException(
                "FTP_DNS_FAILED",
                "FTP server address could not be resolved",
                error,
            )
            is SocketTimeoutException -> FtpOperationException(
                "FTP_CONNECT_TIMEOUT",
                "FTP connection or transfer timed out",
                error,
            )
            is SSLException -> FtpOperationException(
                "FTP_TLS_FAILED",
                "FTPS certificate or TLS negotiation failed",
                error,
            )
            is ConnectException, is IOException -> FtpOperationException(
                "FTP_NETWORK_FAILED",
                "FTP network operation failed",
                error,
            )
            is IllegalArgumentException -> FtpOperationException(
                "FTP_INVALID_CONFIG",
                error.message ?: "FTP configuration is invalid",
                error,
            )
            else -> FtpOperationException(
                if (mode == FtpMode.FTPS) "FTP_TLS_FAILED" else "FTP_NETWORK_FAILED",
                if (mode == FtpMode.FTPS) {
                    "FTPS operation failed"
                } else {
                    "FTP operation failed"
                },
                error,
            )
        }
        promise.reject(mapped.code, mapped.message, mapped.cause ?: mapped)
    }

    override fun invalidate() {
        cancelPendingOperation()
        executor.shutdownNow()
        super.invalidate()
    }

    private enum class FtpMode {
        FTP,
        FTPS,
    }

    private data class ConnectionOptions(
        val mode: FtpMode,
        val host: String,
        val port: Int,
        val username: String,
        val password: String,
        val remoteDirectory: String,
        val connectTimeoutMs: Int,
        val readTimeoutMs: Int,
    )

    private class FtpOperationException(
        val code: String,
        message: String,
        cause: Throwable? = null,
    ) : Exception(message, cause)

    private companion object {
        const val BACKUP_FILE_NAME = "MusicFreeBackup.json"
        const val PREVIOUS_FILE_NAME = ".MusicFreeBackup.json.previous"
        const val FILE_UNAVAILABLE_REPLY_CODE = 550
        const val DEFAULT_CONNECT_TIMEOUT_MS = 15_000
        const val DEFAULT_READ_TIMEOUT_MS = 30_000
        const val MIN_TIMEOUT_MS = 1_000
        const val MAX_TIMEOUT_MS = 120_000
    }
}
