import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import Video, { VideoRef } from "react-native-video";
import {
    IMusicVideoPlayerHandle,
    IMusicVideoPlayerProps,
} from "./playerTypes";

const ExoPlayer = forwardRef<
    IMusicVideoPlayerHandle,
    IMusicVideoPlayerProps
>(function ExoPlayer(props, ref) {
    const videoRef = useRef<VideoRef>(null);

    useImperativeHandle(ref, () => ({
        seek(positionSeconds: number) {
            videoRef.current?.seek(positionSeconds);
        },
    }));

    return (
        <Video
            ref={videoRef}
            style={styles.video}
            source={{
                uri: props.source.url,
                headers: props.source.headers,
            }}
            resizeMode="contain"
            paused={props.paused}
            controls={false}
            playInBackground={false}
            playWhenInactive={false}
            preventsDisplaySleepDuringVideoPlayback
            progressUpdateInterval={250}
            onLoadStart={props.onLoadStart}
            onLoad={data => props.onLoad?.({ duration: data.duration })}
            onProgress={data =>
                props.onProgress?.({
                    currentTime: data.currentTime,
                    duration: 0,
                })
            }
            onBuffer={data => props.onBuffer?.(data.isBuffering)}
            onEnd={props.onEnd}
            onError={() =>
                props.onError?.({ code: "EXO_PLAYBACK_FAILED" })
            }
        />
    );
});

const styles = StyleSheet.create({
    video: {
        width: "100%",
        height: "100%",
        backgroundColor: "#000000",
    },
});

export default ExoPlayer;
