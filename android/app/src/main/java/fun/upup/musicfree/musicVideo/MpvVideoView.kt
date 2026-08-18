package `fun`.upup.musicfree.musicVideo

import android.content.Context
import android.os.SystemClock
import android.view.SurfaceHolder
import android.view.SurfaceView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter
import dev.jdtech.mpv.MPVLib
import java.lang.ref.WeakReference

@Suppress("DEPRECATION")
class MpvVideoView(context: Context) : SurfaceView(context), SurfaceHolder.Callback,
    MPVLib.EventObserver {

    data class VideoSource(
        val uri: String,
        val headers: Map<String, String>,
    )

    companion object {
        private var activeView = WeakReference<MpvVideoView>(null)
        private const val PROGRESS_EVENT_INTERVAL_MS = 250L
    }

    private var playerInitialized = false
    private var surfaceAttached = false
    private var released = false
    private var source: VideoSource? = null
    private var loadedSource: VideoSource? = null
    private var paused = false
    private var duration = 0.0
    private var position = 0.0
    private var eofReached = false
    private var ignoredEndEvents = 0
    private var lastProgressEventAt = 0L

    init {
        activeView.get()?.release()
        activeView = WeakReference(this)
        holder.addCallback(this)
        keepScreenOn = true
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        if (released) {
            return
        }
        if (!playerInitialized) {
            playerInitialized = createPlayer()
        }
        if (!playerInitialized) {
            emitError("MPV_INIT_FAILED")
            return
        }

        runCatching {
            MPVLib.attachSurface(holder.surface)
            surfaceAttached = true
            loadSourceIfReady()
        }.onFailure {
            emitError("MPV_SURFACE_FAILED")
        }
    }

    override fun surfaceChanged(
        holder: SurfaceHolder,
        format: Int,
        width: Int,
        height: Int,
    ) = Unit

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        detachSurface()
    }

    fun setSource(newSource: VideoSource?) {
        if (source == newSource) {
            return
        }
        source = newSource
        if (loadedSource != null && playerInitialized) {
            ignoredEndEvents += 1
        }
        loadedSource = null
        if (newSource == null && playerInitialized) {
            runCatching { MPVLib.command(arrayOf("stop")) }
        } else {
            loadSourceIfReady()
        }
    }

    fun setPaused(shouldPause: Boolean) {
        paused = shouldPause
        if (playerInitialized) {
            runCatching { MPVLib.setPropertyBoolean("pause", shouldPause) }
        }
    }

    fun seekTo(positionSeconds: Double) {
        if (!playerInitialized || !positionSeconds.isFinite() || positionSeconds < 0) {
            return
        }
        runCatching { MPVLib.setPropertyDouble("time-pos", positionSeconds) }
            .onFailure { emitError("MPV_SEEK_FAILED") }
    }

    fun release() {
        if (released) {
            return
        }
        released = true
        keepScreenOn = false
        holder.removeCallback(this)

        if (playerInitialized) {
            runCatching { MPVLib.command(arrayOf("stop")) }
            runCatching { MPVLib.removeObserver(this) }
            detachSurface()
            runCatching { MPVLib.setPropertyString("http-header-fields", "") }
            runCatching { MPVLib.destroy() }
        }
        playerInitialized = false
        source = null
        loadedSource = null

        if (activeView.get() === this) {
            activeView.clear()
        }
    }

    private fun createPlayer(): Boolean {
        return try {
            MPVLib.create(context.applicationContext)
            MPVLib.setOptionString("profile", "fast")
            MPVLib.setOptionString("vo", "gpu")
            MPVLib.setOptionString("gpu-context", "android")
            MPVLib.setOptionString("gpu-api", "opengl")
            MPVLib.setOptionString("hwdec", "mediacodec,mediacodec-copy")
            MPVLib.setOptionString("cache", "yes")
            MPVLib.setOptionString("cache-secs", "20")
            MPVLib.setOptionString("demuxer-max-bytes", "33554432")
            MPVLib.init()
            MPVLib.addObserver(this)
            MPVLib.observeProperty("time-pos", MPVLib.MPV_FORMAT_DOUBLE)
            MPVLib.observeProperty("duration", MPVLib.MPV_FORMAT_DOUBLE)
            MPVLib.observeProperty("eof-reached", MPVLib.MPV_FORMAT_FLAG)
            true
        } catch (_: Throwable) {
            runCatching { MPVLib.destroy() }
            false
        }
    }

    private fun loadSourceIfReady() {
        val targetSource = source ?: return
        if (
            released ||
            !playerInitialized ||
            !surfaceAttached ||
            loadedSource == targetSource
        ) {
            return
        }

        runCatching {
            val headerFields = targetSource.headers.entries.joinToString(",") {
                "${it.key}: ${it.value}"
            }
            MPVLib.setPropertyString("http-header-fields", headerFields)
            MPVLib.command(arrayOf("loadfile", targetSource.uri, "replace"))
            MPVLib.setPropertyBoolean("pause", paused)
            loadedSource = targetSource
            duration = 0.0
            position = 0.0
            eofReached = false
        }.onFailure {
            emitError("MPV_LOAD_FAILED")
        }
    }

    private fun detachSurface() {
        if (!playerInitialized || !surfaceAttached) {
            return
        }
        runCatching { MPVLib.detachSurface() }
        surfaceAttached = false
    }

    override fun eventProperty(property: String) = Unit

    override fun eventProperty(property: String, value: Long) = Unit

    override fun eventProperty(property: String, value: Double) {
        when (property) {
            "duration" -> duration = value.coerceAtLeast(0.0)
            "time-pos" -> {
                position = value.coerceAtLeast(0.0)
                val now = SystemClock.elapsedRealtime()
                if (now - lastProgressEventAt >= PROGRESS_EVENT_INTERVAL_MS) {
                    lastProgressEventAt = now
                    val event = Arguments.createMap().apply {
                        putDouble("currentTime", position)
                        putDouble("duration", duration)
                    }
                    emit("onProgress", event)
                }
            }
        }
    }

    override fun eventProperty(property: String, value: Boolean) {
        if (property == "eof-reached") {
            eofReached = value
        }
    }

    override fun eventProperty(property: String, value: String) = Unit

    override fun event(eventId: Int) {
        when (eventId) {
            MPVLib.MPV_EVENT_FILE_LOADED -> {
                duration = MPVLib.getPropertyDouble("duration") ?: duration
                eofReached = false
                val event = Arguments.createMap().apply {
                    putDouble("duration", duration.coerceAtLeast(0.0))
                }
                emit("onLoad", event)
            }
            MPVLib.MPV_EVENT_END_FILE -> {
                if (ignoredEndEvents > 0) {
                    ignoredEndEvents -= 1
                    return
                }
                val finishedPlayback =
                    eofReached || (duration > 0.0 && position >= duration - 1.5)
                if (finishedPlayback) {
                    emit("onEnd", Arguments.createMap())
                } else {
                    emitError("MPV_PLAYBACK_FAILED")
                }
            }
        }
    }

    private fun emitError(code: String) {
        emit(
            "onError",
            Arguments.createMap().apply { putString("code", code) },
        )
    }

    private fun emit(eventName: String, payload: WritableMap) {
        post {
            if (released || id == NO_ID) {
                return@post
            }
            val reactContext = context as? ReactContext ?: return@post
            if (!reactContext.hasActiveReactInstance()) {
                return@post
            }
            reactContext
                .getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(id, eventName, payload)
        }
    }
}
