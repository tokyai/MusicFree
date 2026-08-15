import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import SeekBar from "./seekBar";
import PlayControl from "./playControl";
import useOrientation from "@/hooks/useOrientation";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

export default function Bottom() {
    const orientation = useOrientation();
    const displayMetrics = useDisplayMetrics();
    const carHeight =
        displayMetrics.minTouchTarget * 2 + displayMetrics.scaleRpx(8);
    return (
        <View
            style={[
                style.wrapper,
                orientation === "horizontal"
                    ? {
                        height: displayMetrics.isCarMode
                            ? carHeight
                            : rpx(156),
                    }
                    : displayMetrics.isCarMode
                        ? { minHeight: carHeight }
                        : undefined,
            ]}>
            <SeekBar />
            <PlayControl />
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: rpx(240),
    },
});
