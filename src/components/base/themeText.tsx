import React from "react";
import { StyleSheet, Text, TextProps, TextStyle } from "react-native";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import useColors, { CustomizedColors } from "@/hooks/useColors";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

type IThemeTextProps = TextProps & {
    color?: string;
    fontColor?: keyof CustomizedColors;
    fontSize?: keyof typeof fontSizeConst;
    fontWeight?: keyof typeof fontWeightConst;
    opacity?: number;
};

export default function ThemeText(props: IThemeTextProps) {
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();
    const {
        style,
        color,
        children,
        fontSize = "content",
        fontColor = "text",
        fontWeight = "regular",
        opacity,
    } = props;

    const flattenedStyle = StyleSheet.flatten(style) as TextStyle | undefined;
    const baseFontSize = displayMetrics.isCarMode
        ? displayMetrics.fontSizes[fontSize]
        : fontSizeConst[fontSize];
    const requestedFontSize =
        displayMetrics.isCarMode && typeof flattenedStyle?.fontSize === "number"
            ? flattenedStyle.fontSize
            : baseFontSize;
    const resolvedFontSize = displayMetrics.isCarMode
        ? Math.max(baseFontSize, requestedFontSize)
        : requestedFontSize;
    const resolvedLineHeight =
        displayMetrics.isCarMode &&
        typeof flattenedStyle?.lineHeight === "number" &&
        flattenedStyle.lineHeight < resolvedFontSize * 1.2
            ? Math.ceil(resolvedFontSize * 1.2)
            : undefined;

    const themeStyle = {
        color: color ?? colors[fontColor],
        fontSize: resolvedFontSize,
        fontWeight: fontWeightConst[fontWeight],
        includeFontPadding: false,
        opacity,
    };

    const carStyle = displayMetrics.isCarMode
        ? {
            fontSize: resolvedFontSize,
            ...(resolvedLineHeight ? { lineHeight: resolvedLineHeight } : null),
        }
        : null;
    const _style = Array.isArray(style)
        ? [themeStyle, ...style, carStyle]
        : [themeStyle, style, carStyle];

    return (
        <Text {...props} style={_style} allowFontScaling={false}>
            {children}
        </Text>
    );
}
