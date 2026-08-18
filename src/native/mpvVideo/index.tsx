import React, { forwardRef, useImperativeHandle, useRef } from "react";
import {
    findNodeHandle,
    NativeSyntheticEvent,
    Platform,
    requireNativeComponent,
    UIManager,
    ViewProps,
} from "react-native";

interface IMpvNativeSource {
    uri: string;
    headers?: Record<string, string>;
}

interface IMpvNativeEventProps extends ViewProps {
    source: IMpvNativeSource;
    paused: boolean;
    onLoad?: (event: NativeSyntheticEvent<{ duration: number }>) => void;
    onProgress?: (
        event: NativeSyntheticEvent<{
            currentTime: number;
            duration: number;
        }>,
    ) => void;
    onEnd?: (event: NativeSyntheticEvent<Record<string, never>>) => void;
    onError?: (event: NativeSyntheticEvent<{ code: string }>) => void;
}

export interface IMpvVideoViewProps extends ViewProps {
    source: IPlugin.IMusicVideoSource;
    paused: boolean;
    onLoad?: (data: { duration: number }) => void;
    onProgress?: (data: { currentTime: number; duration: number }) => void;
    onEnd?: () => void;
    onError?: (data: { code: string }) => void;
}

export interface IMpvVideoViewHandle {
    seek(positionSeconds: number): void;
}

const VIEW_NAME = "MpvVideoView";

export function isMpvVideoSupported(): boolean {
    return (
        Platform.OS === "android" &&
        Number(Platform.Version) >= 26 &&
        !!UIManager.getViewManagerConfig(VIEW_NAME)
    );
}

const NativeMpvVideoView =
    Platform.OS === "android"
        ? requireNativeComponent<IMpvNativeEventProps>(VIEW_NAME)
        : null;

const MpvVideoView = forwardRef<IMpvVideoViewHandle, IMpvVideoViewProps>(
    function MpvVideoView(props, ref) {
        const nativeRef = useRef<any>(null);

        useImperativeHandle(ref, () => ({
            seek(positionSeconds: number) {
                const node = findNodeHandle(nativeRef.current);
                if (node === null) {
                    return;
                }
                UIManager.dispatchViewManagerCommand(
                    node,
                    "seekTo",
                    [positionSeconds],
                );
            },
        }));

        if (!NativeMpvVideoView) {
            return null;
        }

        return (
            <NativeMpvVideoView
                ref={nativeRef}
                style={props.style}
                source={{
                    uri: props.source.url,
                    headers: props.source.headers,
                }}
                paused={props.paused}
                onLoad={event => props.onLoad?.(event.nativeEvent)}
                onProgress={event => props.onProgress?.(event.nativeEvent)}
                onEnd={() => props.onEnd?.()}
                onError={event => props.onError?.(event.nativeEvent)}
            />
        );
    },
);

export default MpvVideoView;
