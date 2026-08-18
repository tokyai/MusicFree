import React, { useCallback, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";

import LocalMusicSheet from "@/core/localMusicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { ImgAsset } from "@/constants/assetsConst";
import Toast from "@/utils/toast";
import useOrientation from "@/hooks/useOrientation";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useCurrentMusic, useMusicQuality } from "@/core/trackPlayer";
import { iconSizeConst } from "@/constants/uiConst";
import PersistStatus from "@/utils/persistStatus";
import HeartIcon from "../heartIcon";
import Icon from "@/components/base/icon.tsx";
import PluginManager from "@/core/pluginManager";
import downloader from "@/core/downloader";
import i18n from "@/core/i18n";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import musicVideoManager from "@/core/musicVideoManager";

export default function Operations() {
    const musicItem = useCurrentMusic();
    const currentQuality = useMusicQuality();
    const isDownloaded = LocalMusicSheet.useIsLocal(musicItem);
    const navigate = useNavigate();
    const isPreparingMusicVideoRef = useRef(false);
    const [isPreparingMusicVideo, setIsPreparingMusicVideo] = useState(false);

    const rate = PersistStatus.useValue("music.rate", 100);
    const orientation = useOrientation();
    const displayMetrics = useDisplayMetrics();
    const operationSize = displayMetrics.isCarMode
        ? displayMetrics.iconSizes.normal
        : iconSizeConst.normal;
    const qualitySize = displayMetrics.isCarMode
        ? Math.max(displayMetrics.scaleRpx(52), operationSize)
        : rpx(52);
    const operationButtonStyle = displayMetrics.isCarMode
        ? {
            minWidth: displayMetrics.minTouchTarget,
            minHeight: displayMetrics.minTouchTarget,
            alignItems: "center" as const,
            justifyContent: "center" as const,
        }
        : null;

    const supportComment = useMemo(() => {
        return !musicItem
            ? false
            : !!PluginManager.getByMedia(musicItem)?.supportedMethods.has("getMusicComments");
    }, [musicItem]);

    const supportMusicVideo = useMemo(() => {
        return !musicItem
            ? false
            : !!PluginManager.getByMedia(musicItem)?.supportedMethods.has(
                "getMusicVideo",
            );
    }, [musicItem]);

    const openMusicVideo = useCallback(async () => {
        if (!musicItem || isPreparingMusicVideoRef.current) {
            return;
        }
        isPreparingMusicVideoRef.current = true;
        setIsPreparingMusicVideo(true);
        try {
            const result = await musicVideoManager.prepareSession(musicItem);
            switch (result.status) {
            case "ready":
                navigate(ROUTE_PATH.MUSIC_VIDEO, {
                    sessionId: result.session.id,
                });
                break;
            case "unsupported":
                Toast.warn(i18n.t("musicVideo.unsupported"));
                break;
            case "unavailable":
                Toast.warn(i18n.t("musicVideo.unavailable"));
                break;
            case "stale":
                Toast.warn(i18n.t("musicVideo.stale"));
                break;
            }
        } catch {
            Toast.warn(i18n.t("musicVideo.prepareFailed"));
        } finally {
            isPreparingMusicVideoRef.current = false;
            setIsPreparingMusicVideo(false);
        }
    }, [musicItem, navigate]);

    return (
        <View
            style={[
                styles.wrapper,
                orientation === "horizontal" ? styles.horizontalWrapper : null,
                displayMetrics.isCarMode
                    ? {
                        height: Math.max(
                            rpx(80),
                            displayMetrics.minTouchTarget,
                        ),
                    }
                    : null,
            ]}>
            <HeartIcon />
            <Pressable
                style={operationButtonStyle}
                onPress={() => {
                    if (!musicItem) {
                        return;
                    }
                    showPanel("MusicQuality", {
                        musicItem,
                        async onQualityPress(quality) {
                            const changeResult =
                                await TrackPlayer.changeQuality(quality);
                            if (!changeResult) {
                                Toast.warn(i18n.t("toast.currentQualityNotAvailableForCurrentMusic"));
                            }
                        },
                    });
                }}>
                <Image
                    source={ImgAsset.quality[currentQuality]}
                    style={[
                        styles.quality,
                        displayMetrics.isCarMode
                            ? { width: qualitySize, height: qualitySize }
                            : null,
                    ]}
                />
            </Pressable>
            <Icon
                name={isDownloaded ? "check-circle-outline" : "arrow-down-tray"}
                size={operationSize}
                style={operationButtonStyle}
                color="white"
                onPress={() => {
                    if (musicItem && !isDownloaded) {
                        showPanel("MusicQuality", {
                            type: "download",
                            musicItem,
                            async onQualityPress(quality) {
                                downloader.download(musicItem, quality);
                            },
                        });
                    }
                }}
            />
            <Pressable
                style={operationButtonStyle}
                onPress={() => {
                    if (!musicItem) {
                        return;
                    }
                    showPanel("PlayRate", {
                        async onRatePress(newRate) {
                            if (rate !== newRate) {
                                try {
                                    await TrackPlayer.setRate(newRate / 100);
                                    PersistStatus.set("music.rate", newRate);
                                } catch { }
                            }
                        },
                    });
                }}>
                <Image
                    source={ImgAsset.rate[rate!]}
                    style={[
                        styles.quality,
                        displayMetrics.isCarMode
                            ? { width: qualitySize, height: qualitySize }
                            : null,
                    ]}
                />
            </Pressable>
            <Icon
                name="chat-bubble-oval-left-ellipsis"
                size={operationSize}
                style={operationButtonStyle}
                color="white"
                opacity={supportComment ? 1 : 0.2}
                onPress={() => {
                    if (!supportComment) {
                        Toast.warn(i18n.t("toast.commmentNotAvaliableForCurrentMusic"));
                        return;
                    }
                    if (musicItem) {
                        showPanel("MusicComment", {
                            musicItem,
                        });
                    }
                }}
            />
            <Icon
                accessibilityLabel={i18n.t("musicVideo.title")}
                name="motion-play"
                size={operationSize}
                style={operationButtonStyle}
                color="white"
                opacity={
                    supportMusicVideo && !isPreparingMusicVideo ? 1 : 0.2
                }
                onPress={openMusicVideo}
            />
            <Icon
                name="ellipsis-vertical"
                size={operationSize}
                style={operationButtonStyle}
                color="white"
                onPress={() => {
                    if (musicItem) {
                        showPanel("MusicItemOptions", {
                            musicItem: musicItem,
                            from: ROUTE_PATH.MUSIC_DETAIL,
                        });
                    }
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: rpx(80),
        marginBottom: rpx(24),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
    },
    horizontalWrapper: {
        marginBottom: 0,
    },
    quality: {
        width: rpx(52),
        height: rpx(52),
    },
});
