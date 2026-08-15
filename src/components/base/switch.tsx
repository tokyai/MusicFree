import React, { useEffect } from "react";
import {
    StyleSheet,
    SwitchProps,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { timingConfig } from "@/constants/commonConst";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface ISwitchProps extends SwitchProps {}

export default function ThemeSwitch(props: ISwitchProps) {
    const { value, onValueChange } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();
    const containerWidth = displayMetrics.isCarMode
        ? Math.max(
            rpx(80),
            displayMetrics.minTouchTarget * 1.5,
        )
        : rpx(80);
    const containerHeight = displayMetrics.isCarMode
        ? Math.max(rpx(40), displayMetrics.minTouchTarget / 2)
        : rpx(40);
    const thumbSize = displayMetrics.isCarMode
        ? Math.max(rpx(34), displayMetrics.minTouchTarget * 0.55)
        : rpx(34);
    const thumbTravel = containerWidth - thumbSize - rpx(6);

    const sharedValue = useSharedValue(value ? 1 : 0);

    useEffect(() => {
        sharedValue.value = value ? 1 : 0;
    }, [value]);

    const thumbStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateX: withTiming(
                        sharedValue.value * thumbTravel,
                        timingConfig.animationNormal,
                    ),
                },
            ],
        };
    }, [thumbTravel]);

    const track = (
        <View
            style={[
                styles.container,
                displayMetrics.isCarMode
                    ? {
                        width: containerWidth,
                        height: containerHeight,
                        borderRadius: containerHeight / 2,
                    }
                    : null,
                {
                    backgroundColor: value
                        ? colors.primary
                        : colors.textSecondary,
                },
                props?.style,
            ]}>
            <Animated.View
                style={[
                    styles.thumb,
                    displayMetrics.isCarMode
                        ? {
                            width: thumbSize,
                            height: thumbSize,
                            borderRadius: thumbSize / 2,
                            left: rpx(3),
                        }
                        : null,
                    thumbStyle,
                ]}
            />
        </View>
    );

    return (
        <TouchableWithoutFeedback
            onPress={() => {
                onValueChange?.(!value);
            }}>
            {displayMetrics.isCarMode ? (
                <View
                    style={{
                        minWidth: displayMetrics.minTouchTarget,
                        minHeight: displayMetrics.minTouchTarget,
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                    {track}
                </View>
            ) : (
                track
            )}
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        width: rpx(80),
        height: rpx(40),
        borderRadius: rpx(40),
        justifyContent: "center",
    },
    thumb: {
        width: rpx(34),
        height: rpx(34),
        borderRadius: rpx(17),
        backgroundColor: "white",
        left: rpx(3),
    },
});
