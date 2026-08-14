import { NativeModules, Platform } from "react-native";

export interface IAudioClip {
    uri: string;
    path: string;
    mimeType: string;
    fileName: string;
    sourceStartTime: number;
    duration: number;
}

interface IAudioClipper {
    clipRemoteAudio(
        url: string,
        headers: Record<string, string>,
        startSeconds: number,
        durationSeconds: number,
    ): Promise<IAudioClip>;
    cancelPendingClips(): void;
}

const nativeAudioClipper = NativeModules.AudioClipper as
    | IAudioClipper
    | undefined;

const AudioClipper = {
    isSupported: Platform.OS === "android" && !!nativeAudioClipper,

    clipRemoteAudio(
        url: string,
        headers: Record<string, string>,
        startSeconds: number,
        durationSeconds: number,
    ) {
        if (!nativeAudioClipper || Platform.OS !== "android") {
            return Promise.reject(
                new Error("Audio clipping is not supported on this platform"),
            );
        }
        return nativeAudioClipper.clipRemoteAudio(
            url,
            headers,
            startSeconds,
            durationSeconds,
        );
    },
    cancelPendingClips() {
        nativeAudioClipper?.cancelPendingClips();
    },
};

export default AudioClipper;
