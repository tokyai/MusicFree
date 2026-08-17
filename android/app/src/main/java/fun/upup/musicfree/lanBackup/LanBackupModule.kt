package `fun`.upup.musicfree.lanBackup

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.URLDecoder
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.Locale
import java.util.concurrent.CancellationException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicLong

/**
 * One-shot, token-protected HTTP transport for moving a MusicFree backup
 * between a trusted phone and the car head unit. The module intentionally does
 * not understand the backup JSON schema; validation and restore remain in JS.
 */
class LanBackupModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val requestGeneration = AtomicLong(0)
    private val stateLock = Any()
    private val random = SecureRandom()

    @Volatile
    private var activeTask: Future<*>? = null

    @Volatile
    private var activeSocket: ServerSocket? = null

    @Volatile
    private var activeClient: Socket? = null

    private var activeOptions: ServerOptions? = null
    private var activeToken: String? = null
    private var pendingTransferPromise: Promise? = null
    private var bufferedTransfer: TransferResult? = null
    private var bufferedError: LanOperationException? = null

    override fun getName() = "LanBackup"

    @ReactMethod
    fun startServer(rawOptions: ReadableMap, promise: Promise) {
        val options = try {
            parseOptions(rawOptions)
        } catch (error: Exception) {
            reject(promise, error)
            return
        }

        stopSession(
            LanOperationException(
                "LAN_CANCELLED",
                "The previous LAN backup session was cancelled",
            ),
            retainError = false,
        )
        val generation = requestGeneration.incrementAndGet()
        var socket: ServerSocket? = null

        try {
            val bindAddress = findLanAddress()
                ?: throw LanOperationException(
                    "LAN_NETWORK_UNAVAILABLE",
                    "No local LAN IPv4 address is available",
                )
            socket = ServerSocket().apply {
                reuseAddress = true
                bind(InetSocketAddress(bindAddress, 0))
                soTimeout = ACCEPT_TIMEOUT_MS
            }
            val token = createToken()
            val expiresAt = System.currentTimeMillis() + options.timeoutMs
            synchronized(stateLock) {
                activeSocket = socket
                activeOptions = options
                activeToken = token
                bufferedTransfer = null
                bufferedError = null
                pendingTransferPromise = null
            }
            activeTask = executor.submit {
                serve(socket, options, token, expiresAt, generation)
            }

            promise.resolve(
                Arguments.createMap().apply {
                    putString(
                        "url",
                        "http://${bindAddress.hostAddress}:${socket.localPort}/?token=$token",
                    )
                    putDouble("expiresAt", expiresAt.toDouble())
                    putString("mode", options.mode.value)
                },
            )
        } catch (error: Exception) {
            try {
                socket?.close()
            } catch (_: Exception) {
            }
            synchronized(stateLock) {
                activeSocket = null
                activeOptions = null
                activeToken = null
            }
            reject(promise, error)
        }
    }

    @ReactMethod
    fun waitForTransfer(promise: Promise) {
        var result: TransferResult? = null
        var error: LanOperationException? = null
        var busy = false

        synchronized(stateLock) {
            if (pendingTransferPromise != null) {
                busy = true
            } else if (bufferedTransfer != null) {
                result = bufferedTransfer
                bufferedTransfer = null
            } else if (bufferedError != null) {
                error = bufferedError
                bufferedError = null
            } else if (activeOptions == null) {
                error = LanOperationException(
                    "LAN_NOT_RUNNING",
                    "No LAN backup session is running",
                )
            } else {
                pendingTransferPromise = promise
            }
        }

        if (busy) {
            promise.reject("LAN_BUSY", "A LAN transfer is already being awaited")
            return
        }
        result?.let {
            promise.resolve(transferMap(it))
            return
        }
        error?.let {
            reject(promise, it)
        }
    }

    @ReactMethod
    fun stopServer() {
        stopSession(
            LanOperationException("LAN_CANCELLED", "LAN backup was cancelled"),
            retainError = true,
        )
    }

    private fun serve(
        socket: ServerSocket,
        options: ServerOptions,
        token: String,
        expiresAt: Long,
        generation: Long,
    ) {
        try {
            while (isActive(generation) && System.currentTimeMillis() < expiresAt) {
                val client = try {
                    socket.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (!isActive(generation)) return
                    throw error
                }

                val shouldHandle = synchronized(stateLock) {
                    if (requestGeneration.get() == generation && activeOptions != null) {
                        activeClient = client
                        true
                    } else {
                        false
                    }
                }
                if (!shouldHandle) {
                    client.close()
                    return
                }

                try {
                    client.use {
                        it.soTimeout = CLIENT_TIMEOUT_MS
                        try {
                            val transfer = handleRequest(
                                it,
                                options,
                                token,
                                generation,
                            )
                            if (transfer != null) {
                                completeTransfer(generation, transfer)
                                return
                            }
                        } catch (error: SocketTimeoutException) {
                            trySendTextResponse(
                                it.getOutputStream(),
                                408,
                                "Request timed out",
                            )
                        } catch (error: LanOperationException) {
                            trySendTextResponse(
                                it.getOutputStream(),
                                error.httpStatus,
                                error.message ?: "Request failed",
                            )
                        } catch (error: IOException) {
                            // A disconnected browser is not a failed backup. Keep
                            // the one-shot server alive until timeout or retry.
                        }
                    }
                } finally {
                    synchronized(stateLock) {
                        if (activeClient === client) {
                            activeClient = null
                        }
                    }
                }
            }
            if (isActive(generation)) {
                completeError(
                    generation,
                    LanOperationException("LAN_TIMEOUT", "LAN backup session timed out"),
                )
            }
        } catch (error: Exception) {
            if (isActive(generation)) {
                completeError(generation, mapError(error))
            }
        } finally {
            try {
                socket.close()
            } catch (_: Exception) {
            }
            synchronized(stateLock) {
                if (activeSocket === socket) {
                    activeSocket = null
                }
                if (requestGeneration.get() == generation) {
                    activeTask = null
                }
            }
        }
    }

    private fun handleRequest(
        socket: Socket,
        options: ServerOptions,
        token: String,
        generation: Long,
    ): TransferResult? {
        val request = readRequest(socket.getInputStream())
        val requestToken = request.query["token"]
        if (requestToken != token) {
            sendTextResponse(socket.getOutputStream(), 403, "Invalid LAN token")
            return null
        }

        return when {
            request.method == "GET" && request.path == "/" -> {
                sendResponse(
                    socket.getOutputStream(),
                    200,
                    "text/html; charset=utf-8",
                    pageBytes(options.mode, token, options.maxBytes),
                )
                null
            }
            request.method == "GET" && request.path == "/download" -> {
                if (options.mode != ServerMode.BACKUP) {
                    sendTextResponse(socket.getOutputStream(), 409, "Download is not available")
                    null
                } else {
                    ensureActive(generation)
                    val body = options.backupJson!!.toByteArray(Charsets.UTF_8)
                    sendResponse(
                        socket.getOutputStream(),
                        200,
                        "application/json; charset=utf-8",
                        body,
                        "Content-Disposition: attachment; filename=MusicFreeBackup.json",
                    )
                    TransferResult(body.size.toLong(), null)
                }
            }
            request.method == "POST" && request.path == "/upload" -> {
                if (options.mode != ServerMode.RESTORE) {
                    sendTextResponse(socket.getOutputStream(), 409, "Upload is not available")
                    null
                } else {
                    val body = readBody(
                        socket.getInputStream(),
                        request.headers["content-length"],
                        options.maxBytes,
                        generation,
                    )
                    val payload = decodeUtf8(body)
                    sendResponse(
                        socket.getOutputStream(),
                        200,
                        "application/json; charset=utf-8",
                        "{\"ok\":true}".toByteArray(Charsets.UTF_8),
                    )
                    TransferResult(body.size.toLong(), payload)
                }
            }
            else -> {
                sendTextResponse(socket.getOutputStream(), 404, "Not found")
                null
            }
        }
    }

    private fun completeTransfer(generation: Long, result: TransferResult) {
        val pending: Promise?
        val socket: ServerSocket?
        synchronized(stateLock) {
            if (requestGeneration.get() != generation || activeOptions == null) return
            activeOptions = null
            activeToken = null
            socket = activeSocket
            activeSocket = null
            pending = pendingTransferPromise
            pendingTransferPromise = null
            bufferedError = null
            bufferedTransfer = if (pending == null) result else null
        }
        try {
            socket?.close()
        } catch (_: Exception) {
        }
        pending?.resolve(transferMap(result))
    }

    private fun completeError(generation: Long, error: LanOperationException) {
        val pending: Promise?
        val socket: ServerSocket?
        synchronized(stateLock) {
            if (requestGeneration.get() != generation || activeOptions == null) return
            activeOptions = null
            activeToken = null
            socket = activeSocket
            activeSocket = null
            pending = pendingTransferPromise
            pendingTransferPromise = null
            bufferedTransfer = null
            bufferedError = if (pending == null) error else null
        }
        try {
            socket?.close()
        } catch (_: Exception) {
        }
        pending?.let { reject(it, error) }
    }

    private fun stopSession(error: LanOperationException, retainError: Boolean) {
        requestGeneration.incrementAndGet()
        val task: Future<*>?
        val socket: ServerSocket?
        val client: Socket?
        val pending: Promise?
        synchronized(stateLock) {
            val wasActive = activeOptions != null || pendingTransferPromise != null
            task = activeTask
            activeTask = null
            socket = activeSocket
            activeSocket = null
            client = activeClient
            activeClient = null
            activeOptions = null
            activeToken = null
            pending = pendingTransferPromise
            pendingTransferPromise = null
            bufferedTransfer = null
            bufferedError = if (retainError && wasActive) error else null
        }
        task?.cancel(true)
        try {
            client?.close()
        } catch (_: Exception) {
        }
        try {
            socket?.close()
        } catch (_: Exception) {
        }
        pending?.let { reject(it, error) }
    }

    private fun isActive(generation: Long): Boolean =
        generation == requestGeneration.get() && synchronized(stateLock) {
            activeOptions != null
        } && !Thread.currentThread().isInterrupted

    private fun ensureActive(generation: Long) {
        if (!isActive(generation)) {
            throw CancellationException("LAN backup was cancelled")
        }
    }

    private fun readRequest(input: InputStream): HttpRequest {
        val requestLine = readLine(input)
            ?: throw LanOperationException("LAN_INVALID_REQUEST", "Empty HTTP request", 400)
        val requestParts = requestLine.split(" ", limit = 3)
        if (requestParts.size != 3 || requestParts[2] != "HTTP/1.1") {
            throw LanOperationException("LAN_INVALID_REQUEST", "Invalid HTTP request", 400)
        }
        val headers = linkedMapOf<String, String>()
        var headerBytes = 0
        while (true) {
            val line = readLine(input)
                ?: throw LanOperationException("LAN_INVALID_REQUEST", "Incomplete HTTP headers", 400)
            headerBytes += line.toByteArray(StandardCharsets.ISO_8859_1).size
            if (headerBytes > MAX_HEADER_BYTES) {
                throw LanOperationException("LAN_INVALID_REQUEST", "HTTP headers are too large", 431)
            }
            if (line.isEmpty()) break
            val separator = line.indexOf(':')
            if (separator <= 0) {
                throw LanOperationException("LAN_INVALID_REQUEST", "Invalid HTTP header", 400)
            }
            headers[line.substring(0, separator).trim().lowercase(Locale.ROOT)] =
                line.substring(separator + 1).trim()
        }

        val target = requestParts[1]
        val queryStart = target.indexOf('?')
        val path = if (queryStart >= 0) target.substring(0, queryStart) else target
        val queryString = if (queryStart >= 0) target.substring(queryStart + 1) else ""
        val query = linkedMapOf<String, String>()
        queryString.split('&').filter { it.isNotEmpty() }.forEach { part ->
            val equals = part.indexOf('=')
            val key = if (equals >= 0) part.substring(0, equals) else part
            val value = if (equals >= 0) part.substring(equals + 1) else ""
            query[decodeQuery(key)] = decodeQuery(value)
        }
        return HttpRequest(requestParts[0].uppercase(Locale.ROOT), path, query, headers)
    }

    private fun readLine(input: InputStream): String? {
        val bytes = ByteArrayOutputStream()
        while (bytes.size() <= MAX_LINE_BYTES) {
            val value = input.read()
            if (value < 0) return if (bytes.size() == 0) null else throw LanOperationException(
                "LAN_INVALID_REQUEST",
                "Incomplete HTTP line",
                400,
            )
            if (value == '\n'.code) {
                val raw = bytes.toByteArray()
                val length = if (raw.lastOrNull()?.toInt() == '\r'.code) raw.size - 1 else raw.size
                return String(raw, 0, length, StandardCharsets.ISO_8859_1)
            }
            bytes.write(value)
        }
        throw LanOperationException("LAN_INVALID_REQUEST", "HTTP line is too long", 431)
    }

    private fun readBody(
        input: InputStream,
        contentLengthHeader: String?,
        maxBytes: Long,
        generation: Long,
    ): ByteArray {
        val contentLength = contentLengthHeader?.toLongOrNull()
            ?: throw LanOperationException("LAN_INVALID_REQUEST", "Content-Length is required", 411)
        if (contentLength < 0 || contentLength > maxBytes || contentLength > Int.MAX_VALUE) {
            throw LanOperationException("LAN_UPLOAD_TOO_LARGE", "Uploaded backup is too large", 413)
        }
        val output = ByteArrayOutputStream(contentLength.toInt())
        val buffer = ByteArray(8192)
        var remaining = contentLength
        while (remaining > 0) {
            ensureActive(generation)
            val count = input.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
            if (count < 0) {
                throw LanOperationException("LAN_INVALID_REQUEST", "Uploaded backup is incomplete", 400)
            }
            output.write(buffer, 0, count)
            remaining -= count
        }
        return output.toByteArray()
    }

    private fun decodeUtf8(body: ByteArray): String {
        return try {
            val decoder = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
            decoder.decode(ByteBuffer.wrap(body)).toString().removePrefix("\uFEFF")
        } catch (error: Exception) {
            throw LanOperationException(
                "LAN_INVALID_ENCODING",
                "Uploaded backup is not valid UTF-8",
                400,
                error,
            )
        }
    }

    private fun sendTextResponse(output: OutputStream, status: Int, text: String) {
        sendResponse(
            output,
            status,
            "text/plain; charset=utf-8",
            text.toByteArray(Charsets.UTF_8),
        )
    }

    private fun trySendTextResponse(output: OutputStream, status: Int, text: String) {
        try {
            sendTextResponse(output, status, text)
        } catch (_: IOException) {
            // The browser may disconnect while an error response is being
            // written. Keep the one-shot server available for a retry.
        }
    }

    private fun sendResponse(
        output: OutputStream,
        status: Int,
        contentType: String,
        body: ByteArray,
        extraHeader: String? = null,
    ) {
        val reason = STATUS_REASONS[status] ?: "OK"
        val headers = buildString {
            append("HTTP/1.1 ").append(status).append(' ').append(reason).append("\r\n")
            append("Content-Type: ").append(contentType).append("\r\n")
            append("Content-Length: ").append(body.size).append("\r\n")
            append("Connection: close\r\n")
            if (extraHeader != null) append(extraHeader).append("\r\n")
            append("\r\n")
        }
        output.write(headers.toByteArray(StandardCharsets.ISO_8859_1))
        output.write(body)
        output.flush()
    }

    private fun pageBytes(mode: ServerMode, token: String, maxBytes: Long): ByteArray {
        val escapedToken = htmlEscape(token)
        val body = if (mode == ServerMode.BACKUP) {
            """
            <!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>body{font-family:sans-serif;max-width:42rem;margin:3rem auto;padding:0 1rem;line-height:1.6}a{display:inline-block;padding:.8rem 1.2rem;background:#2673e8;color:#fff;text-decoration:none;border-radius:.5rem}</style>
            <h2>MusicFree 局域网备份</h2><p>请点击下面按钮下载备份文件，完成后车机服务会自动关闭。</p>
            <a href="/download?token=$escapedToken">下载 MusicFreeBackup.json</a>
            """.trimIndent()
        } else {
            """
            <!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>body{font-family:sans-serif;max-width:42rem;margin:3rem auto;padding:0 1rem;line-height:1.6}button{padding:.8rem 1.2rem;background:#2673e8;color:#fff;border:0;border-radius:.5rem;font-size:1rem}</style>
            <h2>MusicFree 局域网还原</h2><p>选择备份 JSON 文件后点击上传。最大文件大小：${maxBytes / (1024 * 1024)} MB。</p>
            <input id="file" type="file" accept=".json,application/json"><button onclick="upload()">上传备份</button><p id="status"></p>
            <script>
            function readFile(file){return new Promise(function(resolve,reject){const reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=function(){reject(reader.error);};reader.readAsText(file,'UTF-8');});}
            async function upload(){const f=document.getElementById('file').files[0];if(!f){document.getElementById('status').textContent='请选择文件';return;}if(f.size>${maxBytes}){document.getElementById('status').textContent='文件过大';return;}const s=document.getElementById('status');s.textContent='正在上传…';try{const body=await readFile(f);const r=await fetch('/upload?token=$escapedToken',{method:'POST',headers:{'Content-Type':'application/json'},body:body});s.textContent=r.ok?'上传完成，请回到车机查看。':'上传失败：'+await r.text();}catch(e){s.textContent='上传失败，请检查车机和手机是否在同一局域网。';}}
            </script>
            """.trimIndent()
        }
        return body.toByteArray(Charsets.UTF_8)
    }

    private fun htmlEscape(value: String): String = value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")

    private fun decodeQuery(value: String): String = try {
        URLDecoder.decode(value, "UTF-8")
    } catch (error: Exception) {
        throw LanOperationException("LAN_INVALID_REQUEST", "Invalid URL encoding", 400, error)
    }

    private fun parseOptions(rawOptions: ReadableMap): ServerOptions {
        val modeValue = requiredString(rawOptions, "mode")
        val mode = when (modeValue) {
            "backup" -> ServerMode.BACKUP
            "restore" -> ServerMode.RESTORE
            else -> throw IllegalArgumentException("LAN mode must be backup or restore")
        }
        val maxBytes = optionalLong(rawOptions, "maxBytes", DEFAULT_MAX_BYTES)
        require(maxBytes in MIN_MAX_BYTES..MAX_MAX_BYTES) {
            "LAN maximum size is invalid"
        }
        val timeoutMs = optionalLong(rawOptions, "timeoutMs", DEFAULT_TIMEOUT_MS)
        require(timeoutMs in MIN_TIMEOUT_MS..MAX_TIMEOUT_MS) {
            "LAN timeout is invalid"
        }
        val backupJson = if (mode == ServerMode.BACKUP) {
            requiredString(rawOptions, "backupJson").also {
                require(it.toByteArray(Charsets.UTF_8).size <= maxBytes) {
                    "Backup is too large"
                }
            }
        } else {
            null
        }
        return ServerOptions(mode, backupJson, maxBytes, timeoutMs)
    }

    private fun requiredString(map: ReadableMap, key: String): String {
        require(map.hasKey(key) && !map.isNull(key) && map.getType(key) == ReadableType.String) {
            "Missing LAN option: $key"
        }
        return map.getString(key).orEmpty().also {
            require(it.isNotEmpty()) { "Missing LAN option: $key" }
        }
    }

    private fun optionalLong(map: ReadableMap, key: String, defaultValue: Long): Long {
        if (!map.hasKey(key) || map.isNull(key)) return defaultValue
        require(map.getType(key) == ReadableType.Number) { "Invalid LAN option: $key" }
        val value = map.getDouble(key)
        require(value.isFinite() && value % 1.0 == 0.0) { "LAN option $key must be an integer" }
        return value.toLong()
    }

    private fun findLanAddress(): Inet4Address? {
        val interfaces = try {
            NetworkInterface.getNetworkInterfaces()
        } catch (_: SocketException) {
            return null
        } ?: return null
        while (interfaces.hasMoreElements()) {
            val networkInterface = interfaces.nextElement()
            try {
                if (!networkInterface.isUp || networkInterface.isLoopback) continue
            } catch (_: SocketException) {
                continue
            }
            val addresses = networkInterface.inetAddresses
            while (addresses.hasMoreElements()) {
                val address = addresses.nextElement()
                if (address !is Inet4Address || address.isLoopbackAddress) continue
                if (address.isSiteLocalAddress || address.isLinkLocalAddress) return address
            }
        }
        return null
    }

    private fun createToken(): String {
        val bytes = ByteArray(TOKEN_BYTES)
        random.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(Locale.ROOT, it) }
    }

    private fun transferMap(result: TransferResult) =
        Arguments.createMap().apply {
            putDouble("bytes", result.bytes.toDouble())
            result.payload?.let { putString("payload", it) }
        }

    private fun mapError(error: Exception): LanOperationException = when (error) {
        is LanOperationException -> error
        is CancellationException -> LanOperationException("LAN_CANCELLED", "LAN backup was cancelled", 499, error)
        is SocketTimeoutException -> LanOperationException("LAN_TIMEOUT", "LAN backup session timed out", 408, error)
        is IOException -> LanOperationException("LAN_TRANSFER_FAILED", "LAN network operation failed", 500, error)
        else -> LanOperationException("LAN_TRANSFER_FAILED", "LAN backup operation failed", 500, error)
    }

    private fun reject(promise: Promise, error: Exception) {
        val mapped = if (error is LanOperationException) error else mapError(error)
        promise.reject(mapped.code, mapped.message, mapped.cause ?: mapped)
    }

    override fun invalidate() {
        stopSession(
            LanOperationException("LAN_CANCELLED", "LAN backup was cancelled"),
            retainError = false,
        )
        executor.shutdownNow()
        super.invalidate()
    }

    private enum class ServerMode(val value: String) {
        BACKUP("backup"),
        RESTORE("restore"),
    }

    private data class ServerOptions(
        val mode: ServerMode,
        val backupJson: String?,
        val maxBytes: Long,
        val timeoutMs: Long,
    )

    private data class TransferResult(
        val bytes: Long,
        val payload: String?,
    )

    private data class HttpRequest(
        val method: String,
        val path: String,
        val query: Map<String, String>,
        val headers: Map<String, String>,
    )

    private class LanOperationException(
        val code: String,
        message: String,
        val httpStatus: Int = 500,
        cause: Throwable? = null,
    ) : Exception(message, cause)

    private companion object {
        const val DEFAULT_TIMEOUT_MS = 10 * 60 * 1000L
        const val MIN_TIMEOUT_MS = 30 * 1000L
        const val MAX_TIMEOUT_MS = 30 * 60 * 1000L
        const val DEFAULT_MAX_BYTES = 16L * 1024L * 1024L
        const val MIN_MAX_BYTES = 1024L
        const val MAX_MAX_BYTES = 64L * 1024L * 1024L
        const val ACCEPT_TIMEOUT_MS = 1000
        const val CLIENT_TIMEOUT_MS = 30_000
        const val MAX_LINE_BYTES = 8 * 1024
        const val MAX_HEADER_BYTES = 64 * 1024
        const val TOKEN_BYTES = 16
        val STATUS_REASONS = mapOf(
            200 to "OK",
            400 to "Bad Request",
            403 to "Forbidden",
            404 to "Not Found",
            408 to "Request Timeout",
            409 to "Conflict",
            411 to "Length Required",
            413 to "Payload Too Large",
            431 to "Request Header Fields Too Large",
            499 to "Client Closed Request",
            500 to "Internal Server Error",
        )
    }
}
