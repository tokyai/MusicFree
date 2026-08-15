import React, { ReactNode, useEffect, useMemo, useRef } from "react";
import {
    BackHandler,
    NativeEventSubscription,
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from "react-native";
import rpx, { vh, vw } from "@/utils/rpx";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { timingConfig } from "@/constants/commonConst";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import Divider from "@/components/base/divider";
import { fontSizeConst } from "@/constants/uiConst";
import { ScrollView } from "react-native-gesture-handler";
import useOrientation from "@/hooks/useOrientation.ts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import { getDisplayOverlayWidth } from "@/utils/displayMetrics";

interface IDialogProps {
    onDismiss?: () => void;
    children?: ReactNode;
}

function Dialog(props: IDialogProps) {
    const { children, onDismiss } = props;

    const sharedShowValue = useSharedValue(0);
    const colors = useColors();
    const backHandlerRef = useRef<NativeEventSubscription>();
    const orientation = useOrientation();
    const safeAreaInsets = useSafeAreaInsets();
    const displayMetrics = useDisplayMetrics();
    const horizontalMargin = displayMetrics.isCarMode
        ? displayMetrics.horizontalPadding
        : rpx(36);
    const availableWidth = Math.max(
        1,
        displayMetrics.width -
            safeAreaInsets.left -
            safeAreaInsets.right -
            horizontalMargin * 2,
    );
    const availableHeight = displayMetrics.isCarMode
        ? displayMetrics.height -
          safeAreaInsets.top -
          safeAreaInsets.bottom -
          displayMetrics.horizontalPadding * 2
        : vh(100) - safeAreaInsets.top - safeAreaInsets.bottom - rpx(48);

    // 对话框宽度
    const dialogContainerStyle: ViewStyle = displayMetrics.isCarMode
        ? {
            width: getDisplayOverlayWidth("dialog", availableWidth),
        }
        : orientation === "vertical"
            ? {
                width: vw(100) - rpx(72),
            }
            : {
                width: "70%",
                maxWidth: rpx(960),
            };
    dialogContainerStyle.maxHeight = availableHeight;

    useEffect(() => {
        sharedShowValue.value = 1;
        if (backHandlerRef.current) {
            backHandlerRef.current?.remove();
            backHandlerRef.current = undefined;
        }
        backHandlerRef.current = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                onDismiss?.();
                return true;
            },
        );

        return () => {
            sharedShowValue.value = 0;
            if (backHandlerRef.current) {
                backHandlerRef.current?.remove();
                backHandlerRef.current = undefined;
            }
        };
    }, []);

    const containerStyle = useAnimatedStyle(() => {
        return {
            opacity: withTiming(
                sharedShowValue.value,
                timingConfig.animationFast,
            ),
        };
    });

    const scaleAnimationStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    scale: withTiming(
                        0.9 + sharedShowValue.value * 0.1,
                        timingConfig.animationFast,
                    ),
                },
            ],
        };
    });

    return (
        <View style={styles.backContainer}>
            <TouchableWithoutFeedback
                style={styles.container}
                onPress={onDismiss}>
                <Animated.View style={[styles.container, containerStyle]} />
            </TouchableWithoutFeedback>
            <Animated.View
                style={[
                    styles.dialogContainer,
                    dialogContainerStyle,
                    containerStyle,
                    scaleAnimationStyle,
                    {
                        backgroundColor: colors.backdrop,
                        shadowColor: colors.shadow,
                    },
                ]}>
                {children}
            </Animated.View>
        </View>
    );
}

interface IDialogTitleProps {
    children?: ReactNode;
    withDivider?: boolean;
    stringContent?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
}

function Title(props: IDialogTitleProps) {
    const { children, withDivider, stringContent, containerStyle } = props;
    const displayMetrics = useDisplayMetrics();

    return (
        <>
            <View
                style={[
                    styles.titleContainer,
                    containerStyle,
                    displayMetrics.isCarMode
                        ? {
                            minHeight: displayMetrics.appBarHeight,
                            height: displayMetrics.appBarHeight,
                            paddingHorizontal:
                                displayMetrics.horizontalPadding,
                        }
                        : null,
                ]}>
                {typeof children === "string" || stringContent ? (
                    <ThemeText
                        fontSize="title"
                        fontWeight="bold"
                        numberOfLines={1}>
                        {children}
                    </ThemeText>
                ) : (
                    children
                )}
            </View>
            {withDivider ? <Divider /> : null}
        </>
    );
}

interface IDialogContentProps {
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
    needScroll?: boolean;
}

function Content(props: IDialogContentProps) {
    const { children, style, needScroll } = props;
    const orientation = useOrientation();
    const safeAreaInsets = useSafeAreaInsets();
    const displayMetrics = useDisplayMetrics();
    const maxContentHeight = displayMetrics.isCarMode
        ? Math.max(
            displayMetrics.minTouchTarget,
            displayMetrics.height -
                safeAreaInsets.top -
                safeAreaInsets.bottom -
                displayMetrics.appBarHeight -
                displayMetrics.buttonHeight -
                displayMetrics.horizontalPadding * 4,
        )
        : orientation === "horizontal"
            ? Math.max(
                rpx(160),
                vh(100) -
                      safeAreaInsets.top -
                      safeAreaInsets.bottom -
                      rpx(224),
            )
            : vh(50);

    const content =
        typeof children === "string" ? (
            <ThemeText fontSize="content" style={styles.defaultFontStyle}>
                {children}
            </ThemeText>
        ) : (
            children
        );

    return (
        <View
            style={[
                styles.contentContainer,
                {
                    maxHeight: maxContentHeight,
                    paddingHorizontal: displayMetrics.isCarMode
                        ? displayMetrics.horizontalPadding
                        : undefined,
                },
                style,
            ]}>
            {needScroll ? <ScrollView>{content}</ScrollView> : content}
        </View>
    );
}

interface IDialogActionsProps {
    children?: ReactNode;
    actions?: Array<{
        title: string;
        type?: "normal" | "primary";
        show?: boolean;
        onPress?: () => void;
    }>;
    style?: StyleProp<ViewStyle>;
}

function Actions(props: IDialogActionsProps) {
    const { children, style, actions } = props;
    const displayMetrics = useDisplayMetrics();

    const validActions = useMemo(
        () => actions?.filter(it => it.show !== false),
        [actions],
    );

    const _children = validActions?.length ? (
        <>
            {validActions.map((it, index) =>
                it.show === false ? null : (
                    <BottomButton
                        key={index}
                        style={index === 0 ? null : styles.actionButton}
                        onPress={it.onPress}
                        text={it.title}
                        type={it.type}
                    />
                ),
            )}
        </>
    ) : (
        children
    );

    return (
        <View
            style={[
                styles.actionsContainer,
                style,
                displayMetrics.isCarMode
                    ? {
                        minHeight:
                            displayMetrics.buttonHeight +
                            displayMetrics.scaleRpx(12),
                        height:
                            displayMetrics.buttonHeight +
                            displayMetrics.scaleRpx(12),
                        paddingHorizontal:
                            displayMetrics.horizontalPadding,
                    }
                    : null,
            ]}>
            {typeof children === "string" ? (
                <ThemeText fontSize="content" numberOfLines={1}>
                    {children}
                </ThemeText>
            ) : (
                _children
            )}
        </View>
    );
}

function BottomButton(props: {
    type?: "normal" | "primary";
    text: string;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
}) {
    const { type = "normal", text, style, onPress } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();

    return (
        <TouchableOpacity
            activeOpacity={0.6}
            onPress={onPress}
            style={[
                styles.bottomBtn,
                displayMetrics.isCarMode
                    ? {
                        height: displayMetrics.buttonHeight,
                        minHeight: displayMetrics.minTouchTarget,
                    }
                    : null,
                {
                    backgroundColor:
                        type === "normal" ? colors.placeholder : colors.primary,
                },
                style,
            ]}>
            <ThemeText color={type === "normal" ? undefined : "white"}>
                {text}
            </ThemeText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    bottomBtn: {
        borderRadius: rpx(8),
        flex: 1,
        flexShrink: 0,
        justifyContent: "center",
        alignItems: "center",
        height: rpx(72),
    },
    backContainer: {
        position: "absolute",
        zIndex: 16299,
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    container: {
        zIndex: 16300,
        position: "absolute",
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    dialogContainer: {
        position: "absolute",
        width: "80%",
        zIndex: 16310,
        borderRadius: rpx(16),
        backgroundColor: "red",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.5,
        shadowRadius: 4,

        elevation: 5,
    },

    defaultFontStyle: {
        lineHeight: fontSizeConst.content * 1.5,
    },

    /**** title */
    titleContainer: {
        height: rpx(88),
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        paddingHorizontal: rpx(24),
    },
    /** content */
    contentContainer: {
        width: "100%",
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(36),
    },
    /** actions */
    actionsContainer: {
        width: "100%",
        height: rpx(88),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingHorizontal: rpx(24),
        marginBottom: rpx(12),
        flexWrap: "nowrap",
    },
    actionButton: {
        marginLeft: rpx(24),
    },
});

Dialog.Title = Title;
Dialog.Content = Content;
Dialog.Actions = Actions;

export default Dialog;
