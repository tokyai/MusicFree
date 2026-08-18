package `fun`.upup.musicfree.musicVideo

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class MpvVideoViewManager : SimpleViewManager<MpvVideoView>() {
    override fun getName(): String = "MpvVideoView"

    override fun createViewInstance(reactContext: ThemedReactContext): MpvVideoView {
        return MpvVideoView(reactContext)
    }

    @ReactProp(name = "source")
    fun setSource(view: MpvVideoView, value: ReadableMap?) {
        val uri = value?.getString("uri")
        if (uri == null || (!uri.startsWith("http://") && !uri.startsWith("https://"))) {
            view.setSource(null)
            return
        }

        val headers = mutableMapOf<String, String>()
        if (value.hasKey("headers") && value.getType("headers") == ReadableType.Map) {
            val headerMap = value.getMap("headers")
            val iterator = headerMap?.keySetIterator()
            while (iterator?.hasNextKey() == true) {
                val key = iterator.nextKey()
                if (headerMap.getType(key) == ReadableType.String) {
                    headerMap.getString(key)?.let { headers[key] = it }
                }
            }
        }
        view.setSource(MpvVideoView.VideoSource(uri, headers))
    }

    @ReactProp(name = "paused", defaultBoolean = false)
    fun setPaused(view: MpvVideoView, paused: Boolean) {
        view.setPaused(paused)
    }

    override fun receiveCommand(
        root: MpvVideoView,
        commandId: String?,
        args: ReadableArray?,
    ) {
        super.receiveCommand(root, commandId, args)
        if (commandId == "seekTo" && args != null && args.size() > 0) {
            root.seekTo(args.getDouble(0))
        }
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
        listOf("onLoad", "onProgress", "onEnd", "onError").associateWith {
            mapOf("registrationName" to it)
        }

    override fun onDropViewInstance(view: MpvVideoView) {
        view.release()
        super.onDropViewInstance(view)
    }
}
