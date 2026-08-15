import React from "react";
import { StyleProp, StyleSheet, TextStyle, View, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "./themeText";
import useColors from "@/hooks/useColors";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface ITagProps {
    tagName: string;
    containerStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<TextStyle>;
}
export default function Tag(props: ITagProps) {
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();
    return (
        <View
            style={[
                styles.tag,
                displayMetrics.isCarMode
                    ? {
                        minHeight: displayMetrics.fontSizes.tag * 1.6,
                        paddingHorizontal: displayMetrics.scaleRpx(12),
                    }
                    : null,
                { backgroundColor: colors.card, borderColor: colors.divider },
                props.containerStyle,
            ]}>
            <ThemeText style={[styles.tagText, props.style]} fontSize="tag">
                {props.tagName}
            </ThemeText>
        </View>
    );
}

const styles = StyleSheet.create({
    tag: {
        height: rpx(32),
        marginLeft: rpx(12),
        paddingHorizontal: rpx(12),
        borderRadius: rpx(24),
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
        borderWidth: 1,
        borderStyle: "solid",
    },
    tagText: {
        textAlignVertical: "center",
    },
});
