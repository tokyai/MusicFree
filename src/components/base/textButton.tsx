import React from "react";
import { Pressable } from "react-native";
import ThemeText from "./themeText";
import rpx from "@/utils/rpx";
import { CustomizedColors } from "@/hooks/useColors";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface IButtonProps {
    withHorizontalPadding?: boolean;
    style?: any;
    hitSlop?: number;
    children: string;
    fontColor?: keyof CustomizedColors;
    onPress?: () => void;
}
export default function (props: IButtonProps) {
    const { children, onPress, fontColor, hitSlop, withHorizontalPadding } =
        props;
    const displayMetrics = useDisplayMetrics();
    return (
        <Pressable
            {...props}
            style={[
                withHorizontalPadding
                    ? {
                        paddingHorizontal: rpx(24),
                    }
                    : null,
                displayMetrics.isCarMode
                    ? {
                        minHeight: displayMetrics.minTouchTarget,
                        justifyContent: "center",
                    }
                    : null,
                props.style,
            ]}
            hitSlop={
                hitSlop ??
                (withHorizontalPadding
                    ? 0
                    : displayMetrics.isCarMode
                        ? displayMetrics.minTouchTarget / 2
                        : rpx(28))
            }
            onPress={onPress}
            accessible
            accessibilityLabel={children}>
            <ThemeText fontColor={fontColor}>{children}</ThemeText>
        </Pressable>
    );
}
