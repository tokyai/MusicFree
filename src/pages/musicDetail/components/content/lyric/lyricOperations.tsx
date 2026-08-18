import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { iconSizeConst } from "@/constants/uiConst";
import TranslationIcon from "@/assets/icons/translation.svg";
import { useAppConfig } from "@/core/appConfig";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import { hidePanel, showPanel } from "@/components/panels/usePanel";
import TrackPlayer from "@/core/trackPlayer";
import PersistStatus from "@/utils/persistStatus";
import useOrientation from "@/hooks/useOrientation";
import HeartIcon from "../heartIcon";
import Icon from "@/components/base/icon.tsx";
import lyricManager, { useLyricState } from "@/core/lyricManager";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface ILyricOperationsProps {
    scrollToCurrentLrcItem: () => void;
}

export default function LyricOperations(props: ILyricOperationsProps) {
    const { scrollToCurrentLrcItem } = props;

    const detailFontSize = useAppConfig("lyric.detailFontSize");

    const { hasTranslation } = useLyricState();
    const showTranslation = PersistStatus.useValue(
        "lyric.showTranslation",
        false,
    );
    const colors = useColors();
    const orientation = useOrientation();
    const displayMetrics = useDisplayMetrics();
    const operationSize = displayMetrics.isCarMode
        ? displayMetrics.iconSizes.normal
        : iconSizeConst.normal;
    const operationButtonStyle = displayMetrics.isCarMode
        ? {
            minWidth: displayMetrics.minTouchTarget,
            minHeight: displayMetrics.minTouchTarget,
            alignItems: "center" as const,
            justifyContent: "center" as const,
        }
        : null;

    return (
        <View
            style={[
                styles.container,
                displayMetrics.isCarMode
                    ? {
                        height: Math.max(
                            rpx(80),
                            displayMetrics.minTouchTarget,
                        ),
                        marginBottom: displayMetrics.scaleRpx(24),
                    }
                    : null,
            ]}>
            {orientation === "vertical" ? (
                <View style={operationButtonStyle}>
                    <HeartIcon />
                </View>
            ) : null}
            <Pressable
                style={operationButtonStyle}
                onPress={() => {
                    showPanel("SetFontSize", {
                        defaultSelect: detailFontSize ?? 1,
                        onSelectChange(value) {
                            PersistStatus.set("lyric.detailFontSize", value);
                            scrollToCurrentLrcItem();
                        },
                    });
                }}>
                <Icon name="font-size" size={operationSize} color="white" />
            </Pressable>
            <Pressable
                style={operationButtonStyle}
                onPress={() => {
                    const currentMusicItem = TrackPlayer.currentMusic;

                    if (currentMusicItem) {
                        showPanel("SetLyricOffset", {
                            musicItem: currentMusicItem,
                            onSubmit(offset) {
                                lyricManager.updateLyricOffset(currentMusicItem, offset);
                                scrollToCurrentLrcItem();
                                hidePanel();
                            },
                        });
                    }
                }}>
                <Icon
                    name="arrows-left-right"
                    size={operationSize}
                    color="white"
                />
            </Pressable>

            <Pressable
                style={operationButtonStyle}
                onPress={() => {
                    const currentMusic = TrackPlayer.currentMusic;
                    if (!currentMusic) {
                        return;
                    }
                    showPanel("SearchLrc", {
                        musicItem: currentMusic,
                    });
                }}>
                <Icon
                    name="magnifying-glass"
                    size={operationSize}
                    color="white"
                />
            </Pressable>
            <Pressable
                style={operationButtonStyle}
                onPress={() => {
                    if (!hasTranslation) {
                        Toast.warn("当前歌曲无翻译");
                        return;
                    }

                    PersistStatus.set(
                        "lyric.showTranslation",
                        !showTranslation,
                    );
                    scrollToCurrentLrcItem();
                }}>
                <TranslationIcon
                    width={operationSize}
                    height={operationSize}
                    opacity={!hasTranslation ? 0.2 : showTranslation ? 1 : 0.5}
                    color={
                        showTranslation && hasTranslation
                            ? colors.primary
                            : "white"
                    }
                />
            </Pressable>
            <Pressable
                style={operationButtonStyle}
                onPress={() => {
                    const currentMusic = TrackPlayer.currentMusic;
                    if (currentMusic) {
                        showPanel("MusicItemLyricOptions", {
                            musicItem: currentMusic,
                        });
                    }
                }}>
                <Icon
                    name="ellipsis-vertical"
                    size={operationSize}
                    color="white"
                />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: rpx(80),
        marginBottom: rpx(24),
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
    },
});
