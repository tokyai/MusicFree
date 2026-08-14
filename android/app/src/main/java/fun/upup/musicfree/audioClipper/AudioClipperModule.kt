package `fun`.upup.musicfree.audioClipper

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import java.io.File
import java.nio.ByteBuffer
import java.util.concurrent.CancellationException
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.max

class AudioClipperModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
    private val executor = Executors.newSingleThreadExecutor()
    private val requestGeneration = AtomicLong(0)
    @Volatile
    private var activeTask: Future<*>? = null

    override fun getName() = "AudioClipper"

    @ReactMethod
    fun clipRemoteAudio(
        url: String,
        headers: ReadableMap?,
        startSeconds: Double,
        durationSeconds: Double,
        promise: Promise,
    ) {
        val generation = requestGeneration.incrementAndGet()
        activeTask?.cancel(true)
        activeTask = executor.submit {
            var outputFile: File? = null
            try {
                require(url.startsWith("http://") || url.startsWith("https://")) {
                    "Only remote HTTP audio can be clipped"
                }
                require(startSeconds >= 0) { "Clip start must not be negative" }
                require(durationSeconds in 5.0..30.0) {
                    "Clip duration must be between 5 and 30 seconds"
                }

                val clipFile = File.createTempFile(
                    "music-recognition-",
                    ".m4a",
                    reactContext.cacheDir,
                )
                outputFile = clipFile
                val result = createClip(
                    url,
                    readableMapToHeaders(headers),
                    startSeconds,
                    durationSeconds,
                    clipFile,
                    generation,
                )
                ensureRequestActive(generation)
                promise.resolve(
                    Arguments.createMap().apply {
                        putString("uri", Uri.fromFile(clipFile).toString())
                        putString("path", clipFile.absolutePath)
                        putString("mimeType", result.mimeType)
                        putString("fileName", result.fileName)
                        putDouble("sourceStartTime", result.sourceStartTime)
                        putDouble("duration", result.duration)
                    },
                )
            } catch (error: Exception) {
                outputFile?.delete()
                if (error is CancellationException || generation != requestGeneration.get()) {
                    promise.reject("AUDIO_CLIP_CANCELLED", "Audio clipping was cancelled")
                } else {
                    promise.reject("AUDIO_CLIP_FAILED", error.message, error)
                }
            }
        }
    }

    @ReactMethod
    fun cancelPendingClips() {
        requestGeneration.incrementAndGet()
        activeTask?.cancel(true)
        activeTask = null
    }

    private fun createClip(
        url: String,
        headers: Map<String, String>,
        requestedStartSeconds: Double,
        durationSeconds: Double,
        outputFile: File,
        generation: Long,
    ): ClipResult {
        val extractor = MediaExtractor()
        var muxer: MediaMuxer? = null
        try {
            extractor.setDataSource(url, headers)
            val audioTrackIndex = (0 until extractor.trackCount).firstOrNull { index ->
                extractor.getTrackFormat(index)
                    .getString(MediaFormat.KEY_MIME)
                    ?.startsWith("audio/") == true
            } ?: throw IllegalStateException("No audio track found in media source")

            val format = extractor.getTrackFormat(audioTrackIndex)
            val audioMime = format.getString(MediaFormat.KEY_MIME)
                ?: throw IllegalStateException("Audio track has no MIME type")
            if (audioMime != MediaFormat.MIMETYPE_AUDIO_AAC) {
                throw IllegalStateException(
                    "Unsupported audio codec for recognition clip: $audioMime",
                )
            }
            val outputFormat = MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4
            extractor.selectTrack(audioTrackIndex)

            val requestedStartUs = (requestedStartSeconds * 1_000_000).toLong()
            val requestedEndUs = requestedStartUs + (durationSeconds * 1_000_000).toLong()
            extractor.seekTo(requestedStartUs, MediaExtractor.SEEK_TO_CLOSEST_SYNC)

            val firstSampleTimeUs = extractor.sampleTime
            if (firstSampleTimeUs < 0) {
                throw IllegalStateException("Media source contains no readable audio samples")
            }

            muxer = MediaMuxer(
                outputFile.absolutePath,
                outputFormat,
            )
            val outputTrackIndex = muxer.addTrack(format)
            muxer.start()

            val maxInputSize = if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
                format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)
            } else {
                1024 * 1024
            }
            val buffer = ByteBuffer.allocateDirect(max(maxInputSize, 64 * 1024))
            val bufferInfo = MediaCodec.BufferInfo()
            var lastSampleTimeUs = firstSampleTimeUs
            var sampleCount = 0

            while (true) {
                ensureRequestActive(generation)
                val sampleTimeUs = extractor.sampleTime
                if (sampleTimeUs < 0 || sampleTimeUs >= requestedEndUs) break

                buffer.clear()
                val sampleSize = extractor.readSampleData(buffer, 0)
                if (sampleSize < 0) break

                bufferInfo.set(
                    0,
                    sampleSize,
                    sampleTimeUs - firstSampleTimeUs,
                    extractor.sampleFlags,
                )
                muxer.writeSampleData(outputTrackIndex, buffer, bufferInfo)
                lastSampleTimeUs = sampleTimeUs
                sampleCount += 1
                if (!extractor.advance()) break
            }

            if (sampleCount == 0) {
                throw IllegalStateException("No audio samples found in requested range")
            }

            return ClipResult(
                sourceStartTime = firstSampleTimeUs / 1_000_000.0,
                duration = max(0L, lastSampleTimeUs - firstSampleTimeUs) / 1_000_000.0,
                mimeType = "audio/mp4",
                fileName = "music-recognition.m4a",
            )
        } finally {
            try {
                muxer?.stop()
            } catch (_: Exception) {
            }
            try {
                muxer?.release()
            } catch (_: Exception) {
            }
            extractor.release()
        }
    }

    private fun ensureRequestActive(generation: Long) {
        if (generation != requestGeneration.get() || Thread.currentThread().isInterrupted) {
            throw CancellationException("Audio clipping was cancelled")
        }
    }

    private fun readableMapToHeaders(headers: ReadableMap?): Map<String, String> {
        if (headers == null) return emptyMap()
        val result = mutableMapOf<String, String>()
        val iterator = headers.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            if (headers.getType(key) == ReadableType.String) {
                headers.getString(key)?.let { result[key] = it }
            }
        }
        return result
    }

    override fun invalidate() {
        cancelPendingClips()
        executor.shutdownNow()
        super.invalidate()
    }

    private data class ClipResult(
        val sourceStartTime: Double,
        val duration: Double,
        val mimeType: String,
        val fileName: String,
    )
}
