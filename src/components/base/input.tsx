import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import React from "react";
import { StyleSheet, TextInput, TextInputProps } from "react-native";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface IInputProps extends TextInputProps {
    fontColor?: string;
    hasHorizontalPadding?: boolean;
}

export default function Input(props: IInputProps) {
    const { fontColor, hasHorizontalPadding = true } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();

    const currentColor = fontColor ?? colors.text;

    const defaultStyle = {
        color: currentColor,
    };

    return (
        <TextInput
            placeholderTextColor={Color(currentColor).alpha(0.7).toString()}
            {...props}
            style={[
                hasHorizontalPadding
                    ? styles.container
                    : styles.containerWithoutPadding,
                defaultStyle,
                props?.style,
                displayMetrics.isCarMode
                    ? {
                        minHeight: displayMetrics.minTouchTarget,
                        fontSize: displayMetrics.fontSizes.content,
                    }
                    : null,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 0,
        paddingHorizontal: rpx(24),
    },
    containerWithoutPadding: {
        padding: 0,
    },
});
