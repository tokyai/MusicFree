import MpvVideoView, {
    IMpvVideoViewHandle,
} from "@/native/mpvVideo";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import {
    IMusicVideoPlayerHandle,
    IMusicVideoPlayerProps,
} from "./playerTypes";

const MpvPlayer = forwardRef<
    IMusicVideoPlayerHandle,
    IMusicVideoPlayerProps
>(function MpvPlayer(props, ref) {
    const videoRef = useRef<IMpvVideoViewHandle>(null);

    useImperativeHandle(ref, () => ({
        seek(positionSeconds: number) {
            videoRef.current?.seek(positionSeconds);
        },
    }));

    return (
        <MpvVideoView
            ref={videoRef}
            style={styles.video}
            source={props.source}
            paused={props.paused}
            onLoad={props.onLoad}
            onProgress={props.onProgress}
            onEnd={props.onEnd}
            onError={props.onError}
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

export default MpvPlayer;
