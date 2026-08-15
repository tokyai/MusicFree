import React from "react";
import { StyleSheet, Text } from "react-native";
import rpx from "@/utils/rpx";
import timeformat from "@/utils/timeformat";
import { fontSizeConst } from "@/constants/uiConst";
import { useProgress } from "@/core/trackPlayer";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

export default function DraggingTime(props: { time: number }) {
    const progress = useProgress();
    const displayMetrics = useDisplayMetrics();

    return (
        <Text
            style={[
                style.draggingTimeText,
                displayMetrics.isCarMode
                    ? {
                        fontSize: displayMetrics.fontSizes.description,
                        paddingHorizontal: displayMetrics.scaleRpx(8),
                        paddingVertical: displayMetrics.scaleRpx(6),
                    }
                    : null,
            ]}>
            {timeformat(
                Math.max(Math.min(props.time, progress.duration ?? 0), 0),
            )}
        </Text>
    );
}

const style = StyleSheet.create({
    draggingTimeText: {
        color: "#dddddd",
        paddingHorizontal: rpx(8),
        paddingVertical: rpx(6),
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.1)",
        fontSize: fontSizeConst.description,
    },
});
