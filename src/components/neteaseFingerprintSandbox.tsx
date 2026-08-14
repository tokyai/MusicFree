import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import {
    resolveNeteaseFingerprint,
    useNeteaseFingerprintRequest,
    cancelNeteaseFingerprint,
} from "@/core/neteaseFingerprint";

interface IResultMessage {
    type?: string;
    id?: number;
    fingerprint?: string;
    queryOffsetSeconds?: number;
    error?: string;
}

export default function NeteaseFingerprintSandbox() {
    const request = useNeteaseFingerprintRequest();
    const webViewRef = useRef<WebView>(null);
    const [readyRequestId, setReadyRequestId] = useState<number | null>(null);

    useEffect(() => {
        setReadyRequestId(null);
    }, [request?.id]);

    useEffect(() => () => cancelNeteaseFingerprint(), []);

    useEffect(() => {
        if (!request || readyRequestId !== request.id) return;
        webViewRef.current?.postMessage(
            JSON.stringify({
                type: "fingerprint",
                id: request.id,
                audioBase64: request.audioBase64,
            }),
        );
    }, [request, readyRequestId]);

    if (Platform.OS !== "android" || !request) return null;

    const onMessage = (event: WebViewMessageEvent) => {
        let message: IResultMessage;
        try {
            message = JSON.parse(event.nativeEvent.data);
        } catch {
            return;
        }

        if (message.type === "ready") {
            setReadyRequestId(request.id);
            return;
        }
        if (message.type === "result" && message.id === request.id) {
            resolveNeteaseFingerprint(request.id, {
                fingerprint: message.fingerprint || "",
                queryOffsetSeconds: Number(message.queryOffsetSeconds) || 0,
            });
            return;
        }
        if (message.type === "error" && message.id === request.id) {
            resolveNeteaseFingerprint(request.id, undefined, message.error);
        }
    };

    return (
        <View pointerEvents="none" style={styles.container}>
            <WebView
                key={request.id}
                ref={webViewRef}
                source={{
                    uri: "file:///android_asset/netease-fingerprint/index.html",
                }}
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
                allowFileAccess
                allowFileAccessFromFileURLs
                allowUniversalAccessFromFileURLs
                onMessage={onMessage}
                onError={() =>
                    resolveNeteaseFingerprint(
                        request.id,
                        undefined,
                        "Netease fingerprint sandbox failed to load",
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        opacity: 0.01,
    },
});
