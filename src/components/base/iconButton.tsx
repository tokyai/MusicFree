import React from "react";
import { ColorKey, colorMap, iconSizeConst } from "@/constants/uiConst";
import { TapGestureHandler } from "react-native-gesture-handler";
import { StyleSheet, View } from "react-native";
import useColors from "@/hooks/useColors";
import { SvgProps } from "react-native-svg";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface IIconButtonProps extends SvgProps {
    name: IIconName;
    style?: SvgProps["style"];
    sizeType?: keyof typeof iconSizeConst;
    fontColor?: ColorKey;
    color?: string;
    onPress?: () => void;
    accessibilityLabel?: string;
}
export function IconButtonWithGesture(props: IIconButtonProps) {
    const {
        name,
        sizeType: size = "normal",
        fontColor = "normal",
        onPress,
        style,
        accessibilityLabel,
    } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();
    const legacySize = iconSizeConst[size];
    const textSize = displayMetrics.isCarMode
        ? Math.max(legacySize, displayMetrics.iconSizes[size])
        : legacySize;
    const touchTarget = displayMetrics.isCarMode
        ? displayMetrics.minTouchTarget
        : undefined;
    const color = colors[colorMap[fontColor]];
    return (
        <TapGestureHandler onActivated={onPress}>
            <View style={touchTarget ? { minWidth: touchTarget, minHeight: touchTarget } : null}>
                <Icon
                    accessible
                    accessibilityLabel={accessibilityLabel}
                    name={name}
                    color={color}
                    style={[
                        {
                            minWidth: Math.max(textSize, touchTarget ?? 0),
                            minHeight: touchTarget,
                        },
                        styles.textCenter,
                        style,
                    ]}
                    size={textSize}
                />
            </View>
        </TapGestureHandler>
    );
}

export default function IconButton(props: IIconButtonProps) {
    const { sizeType = "normal", fontColor = "normal", style, color } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();
    const legacySize = iconSizeConst[sizeType];
    const size = displayMetrics.isCarMode
        ? Math.max(legacySize, displayMetrics.iconSizes[sizeType])
        : legacySize;
    const touchTarget = displayMetrics.isCarMode
        ? displayMetrics.minTouchTarget
        : undefined;

    return (
        <Icon
            {...props}
            color={color ?? colors[colorMap[fontColor]]}
            style={[
                {
                    minWidth: Math.max(size, touchTarget ?? 0),
                    minHeight: touchTarget,
                },
                styles.textCenter,
                style,
            ]}
            size={size}
        />
    );
}

const styles = StyleSheet.create({
    textCenter: {
        height: "100%",
        textAlignVertical: "center",
    },
});
