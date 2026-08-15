import React, { useMemo } from "react";
import rpx from "@/utils/rpx";
import { ImgAsset } from "@/constants/assetsConst";
import FastImage from "@/components/base/fastImage";
import useOrientation from "@/hooks/useOrientation";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useCurrentMusic } from "@/core/trackPlayer";
import globalStyle from "@/constants/globalStyle";
import { View } from "react-native";
import Operations from "./operations";
import { showPanel } from "@/components/panels/usePanel.ts";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface IProps {
    onTurnPageClick?: () => void;
}

export default function AlbumCover(props: IProps) {
    const { onTurnPageClick } = props;

    const musicItem = useCurrentMusic();
    const orientation = useOrientation();
    const displayMetrics = useDisplayMetrics();
    const safeAreaInsets = useSafeAreaInsets();

    const artworkStyle = useMemo(() => {
        if (orientation === "vertical") {
            return {
                width: rpx(500),
                height: rpx(500),
            };
        } else {
            const legacySize = displayMetrics.isCarMode
                ? displayMetrics.scaleRpx(260)
                : rpx(260);
            const availableSize =
                displayMetrics.height -
                safeAreaInsets.top -
                safeAreaInsets.bottom -
                displayMetrics.appBarHeight -
                displayMetrics.minTouchTarget * 3 -
                displayMetrics.scaleRpx(32);
            const artworkSize = displayMetrics.isCarMode
                ? Math.min(
                    legacySize,
                    Math.max(displayMetrics.minTouchTarget, availableSize),
                )
                : legacySize;
            return {
                width: artworkSize,
                height: artworkSize,
            };
        }
    }, [
        displayMetrics,
        orientation,
        safeAreaInsets.bottom,
        safeAreaInsets.top,
    ]);

    const longPress = Gesture.LongPress()
        .onStart(() => {
            if (musicItem?.artwork) {
                showPanel("ImageViewer", {
                    url: musicItem.artwork,
                });
            }
        })
        .runOnJS(true);

    const tap = Gesture.Tap()
        .onStart(() => {
            onTurnPageClick?.();
        })
        .runOnJS(true);

    const combineGesture = Gesture.Race(tap, longPress);

    return (
        <>
            <GestureDetector gesture={combineGesture}>
                <View style={globalStyle.fullCenter}>
                    <FastImage
                        style={artworkStyle}
                        source={musicItem?.artwork}
                        placeholderSource={ImgAsset.albumDefault}
                    />
                </View>
            </GestureDetector>
            <Operations />
        </>
    );
}
