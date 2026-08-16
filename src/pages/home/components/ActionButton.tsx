import ThemeText from "@/components/base/themeText";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import Icon, { IIconName } from "@/components/base/icon.tsx";

export type ActionButtonVariant = "tile" | "rail";

interface IActionButtonProps {
    iconName: IIconName;
    iconColor?: string;
    title: string;
    action?: () => void;
    style?: StyleProp<ViewStyle>;
    variant?: ActionButtonVariant;
}

export default function ActionButton(props: IActionButtonProps) {
    const {
        iconName,
        iconColor,
        title,
        action,
        style,
        variant = "tile",
    } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();
    const isRail = variant === "rail";
    // rippleColor="rgba(0, 0, 0, .32)"
    return (
        <TouchableOpacity
            onPress={action}
            style={[
                styles.wrapper,
                isRail ? styles.railWrapper : styles.tileWrapper,
                isRail
                    ? {
                        minHeight: displayMetrics.navigationItemHeight,
                        paddingHorizontal: displayMetrics.horizontalPadding,
                        paddingVertical: displayMetrics.scaleRpx(10),
                    }
                    : null,
                {
                    backgroundColor: colors.card,
                },
                style,
            ]}>
            <Icon
                accessible={false}
                name={iconName}
                color={iconColor ?? colors.text}
                size={
                    isRail
                        ? Math.max(rpx(48), displayMetrics.iconSizes.light)
                        : rpx(48)
                }
            />
            <ThemeText
                accessible={false}
                fontSize="subTitle"
                fontWeight="semibold"
                numberOfLines={isRail ? 1 : undefined}
                ellipsizeMode={isRail ? "tail" : undefined}
                adjustsFontSizeToFit={isRail}
                minimumFontScale={isRail ? 0.75 : undefined}
                style={[
                    styles.text,
                    isRail ? styles.railText : styles.tileText,
                ]}>
                {title}
            </ThemeText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: rpx(12),
        minWidth: 0,
    },
    tileWrapper: {
        width: rpx(140),
        height: rpx(144),
        flexGrow: 1,
        flexShrink: 0,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
    railWrapper: {
        width: "100%",
        flexGrow: 0,
        flexShrink: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
    },
    text: {
        minWidth: 0,
        flexShrink: 1,
    },
    tileText: {
        width: "100%",
        marginTop: rpx(12),
        paddingHorizontal: rpx(8),
        textAlign: "center",
    },
    railText: {
        flex: 1,
        marginTop: 0,
        marginLeft: rpx(16),
    },
});
