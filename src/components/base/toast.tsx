import { timingConfig } from "@/constants/commonConst";
import { fontSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { GlobalState } from "@/utils/stateMapper";
import { nanoid } from "nanoid";
import React, { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
    Directions,
    Gesture,
    GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
    cancelAnimation,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from "react-native-reanimated";
import Icon from "@/components/base/icon.tsx";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

export interface IToastConfig {
    /** 类型 */
    type: "success" | "warn";
    /** 消息内容 */
    message?: string;
    /** 行动点 */
    actionText?: string;
    /** 行动点按钮行为 */
    onActionClick?: () => void;
    /** 展示时间 */
    duration?: number;
}

type IToastConfigInner = IToastConfig & {
    id: string;
};

const toastQueue: IToastConfigInner[] = [];

const fixedTop = rpx(250);

const activeToastStore = new GlobalState<IToastConfigInner | null>(null);

const typeConfig = {
    success: {
        name: "check-circle",
        color: "#457236",
    },
    warn: {
        name: "exclamation-circle",
        color: "#de7622",
    },
} as const;

export function ToastBaseComponent() {
    const activeToast = activeToastStore.useValue();
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();

    const toastAnim = useSharedValue(0);

    const setNextToast = useCallback(() => {
        activeToastStore.setValue(toastQueue.shift() || null);
    }, []);

    useEffect(() => {
        if (activeToast) {
            toastAnim.value = withTiming(1, timingConfig.animationSlow, () => {
                toastAnim.value = withDelay(
                    activeToast.duration || 1200,
                    withTiming(0, timingConfig.animationSlow, finished => {
                        if (finished) {
                            runOnJS(setNextToast)();
                        }
                    }),
                );
            });
        }
    }, [activeToast]);

    function removeCurrentToast() {
        if (toastAnim.value === 1) {
            cancelAnimation(toastAnim);
            toastAnim.value = withTiming(
                0,
                timingConfig.animationSlow,
                finished => {
                    if (finished) {
                        runOnJS(setNextToast)();
                    }
                },
            );
        }
    }

    const flingGesture = Gesture.Fling()
        .direction(Directions.UP)
        .onEnd(() => {
            removeCurrentToast();
        })
        .runOnJS(true);

    const toastAnimStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateY: (toastAnim.value - 1) * fixedTop,
                },
            ],
            opacity: toastAnim.value,
        };
    });

    return activeToast ? (
        <GestureDetector gesture={flingGesture}>
            <View
                style={[
                    styles.container,
                    displayMetrics.isCarMode
                        ? {
                            top: displayMetrics.appBarHeight +
                                displayMetrics.horizontalPadding,
                            height: Math.max(
                                displayMetrics.scaleRpx(100),
                                displayMetrics.minTouchTarget,
                            ),
                        }
                        : null,
                ]}>
                <Animated.View
                    style={[
                        styles.contentContainer,
                        displayMetrics.isCarMode
                            ? {
                                width: Math.min(
                                    Math.max(
                                        displayMetrics.scaleRpx(688),
                                        displayMetrics.minTouchTarget * 6,
                                    ),
                                    displayMetrics.width -
                                        displayMetrics.horizontalPadding * 2,
                                ),
                                minHeight: displayMetrics.minTouchTarget,
                                height: Math.max(
                                    displayMetrics.scaleRpx(100),
                                    displayMetrics.minTouchTarget,
                                ),
                                paddingHorizontal:
                                    displayMetrics.horizontalPadding,
                            }
                            : null,
                        {
                            backgroundColor: colors.notification,
                            shadowColor: colors.shadow,
                        },
                        toastAnimStyle,
                    ]}>
                    <Icon
                        size={
                            displayMetrics.isCarMode
                                ? displayMetrics.iconSizes.normal
                                : fontSizeConst.appbar
                        }
                        name={typeConfig[activeToast.type].name}
                        color={typeConfig[activeToast.type].color}
                    />
                    <Text
                        numberOfLines={2}
                        style={[
                            styles.text,
                            displayMetrics.isCarMode
                                ? {
                                    fontSize:
                                        displayMetrics.fontSizes.content,
                                    marginLeft:
                                        displayMetrics.horizontalPadding,
                                }
                                : null,
                            { color: colors.text },
                        ]}>
                        {activeToast.message}
                    </Text>
                    {activeToast.actionText && activeToast.onActionClick ? (
                        <Pressable
                            style={[
                                styles.actionTextContainer,
                                displayMetrics.isCarMode
                                    ? {
                                        minWidth:
                                            displayMetrics.minTouchTarget * 2,
                                        width:
                                            displayMetrics.minTouchTarget * 2,
                                        height:
                                            displayMetrics.minTouchTarget,
                                        marginLeft:
                                            displayMetrics.horizontalPadding,
                                    }
                                    : null,
                                { backgroundColor: colors.primary },
                            ]}
                            onPress={activeToast.onActionClick}>
                            <Text
                                style={[
                                    styles.actionText,
                                    displayMetrics.isCarMode
                                        ? {
                                            fontSize:
                                                displayMetrics.fontSizes.content,
                                        }
                                        : null,
                                ]}
                                numberOfLines={1}>
                                {activeToast.actionText}
                            </Text>
                        </Pressable>
                    ) : null}
                </Animated.View>
            </View>
        </GestureDetector>
    ) : null;
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: rpx(128),
        width: "100%",
        alignItems: "center",
        height: rpx(100),
        zIndex: 20000,
    },
    contentContainer: {
        width: rpx(688),
        height: "100%",
        borderRadius: rpx(12),
        backgroundColor: "blue",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(24),
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,

        elevation: 2,
    },
    text: {
        fontSize: fontSizeConst.content,
        includeFontPadding: false,
        flex: 1,
        marginLeft: rpx(24),
    },
    actionText: {
        fontSize: fontSizeConst.content,
        includeFontPadding: false,
        color: "white",
    },
    actionTextContainer: {
        marginLeft: rpx(24),
        width: rpx(120),
        paddingHorizontal: rpx(12),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: rpx(30),
        height: rpx(58),
    },
});

export function showToast(config: IToastConfig) {
    const id = nanoid();
    const _config = {
        ...config,
        id,
    };
    const activeToast = activeToastStore.getValue();
    if (!activeToast) {
        activeToastStore.setValue(_config);
    } else {
        toastQueue.push(_config);
    }

    return id;
}
