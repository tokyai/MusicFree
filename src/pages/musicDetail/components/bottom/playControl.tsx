import repeatModeConst from "@/constants/repeatModeConst";
import rpx from "@/utils/rpx";
import React from "react";
import {
    InteractionManager,
    Pressable,
    StyleSheet,
    View,
} from "react-native";

import Icon from "@/components/base/icon.tsx";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useMusicState, useRepeatMode } from "@/core/trackPlayer";
import useOrientation from "@/hooks/useOrientation";
import delay from "@/utils/delay";
import { musicIsPaused } from "@/utils/trackUtils";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

export default function () {
    const repeatMode = useRepeatMode();
    const musicState = useMusicState();

    const orientation = useOrientation();
    const displayMetrics = useDisplayMetrics();
    const sideIconSize = displayMetrics.isCarMode
        ? Math.max(displayMetrics.scaleRpx(56), displayMetrics.iconSizes.big)
        : rpx(56);
    const primaryIconSize = displayMetrics.isCarMode
        ? Math.max(
            displayMetrics.scaleRpx(96),
            displayMetrics.iconSizes.large,
        )
        : rpx(96);
    const buttonStyle = displayMetrics.isCarMode
        ? {
            minWidth: displayMetrics.minTouchTarget,
            minHeight: displayMetrics.minTouchTarget,
            alignItems: "center" as const,
            justifyContent: "center" as const,
        }
        : null;

    return (
        <>
            <View
                style={[
                    style.wrapper,
                    orientation === "horizontal"
                        ? {
                            marginTop: 0,
                        }
                        : null,
                    displayMetrics.isCarMode
                        ? {
                            height: Math.max(
                                rpx(100),
                                displayMetrics.minTouchTarget,
                            ),
                        }
                        : null,
                ]}>
                <Pressable
                    style={buttonStyle}
                    onPress={async () => {
                        InteractionManager.runAfterInteractions(async () => {
                            await delay(20, false);
                            TrackPlayer.toggleRepeatMode();
                        });
                    }}>
                    <Icon
                        color="white"
                        name={repeatModeConst[repeatMode].icon}
                        size={sideIconSize}
                    />
                </Pressable>
                <Pressable
                    style={buttonStyle}
                    onPress={() => {
                        TrackPlayer.skipToPrevious();
                    }}>
                    <Icon
                        color="white"
                        name="skip-left"
                        size={sideIconSize}
                    />
                </Pressable>
                <Pressable
                    style={buttonStyle}
                    onPress={() => {
                        if (musicIsPaused(musicState)) {
                            TrackPlayer.play();
                        } else {
                            TrackPlayer.pause();
                        }
                    }}>
                    <Icon
                        color="white"
                        name={musicIsPaused(musicState) ? "play" : "pause"}
                        size={primaryIconSize}
                    />
                </Pressable>
                <Pressable
                    style={buttonStyle}
                    onPress={() => {
                        TrackPlayer.skipToNext();
                    }}>
                    <Icon
                        color="white"
                        name="skip-right"
                        size={sideIconSize}
                    />
                </Pressable>
                <Pressable
                    style={buttonStyle}
                    onPress={() => {
                        showPanel("PlayList");
                    }}>
                    <Icon
                        color="white"
                        name="playlist"
                        size={sideIconSize}
                    />
                </Pressable>
            </View>
        </>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        marginTop: rpx(36),
        height: rpx(100),
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },
});
