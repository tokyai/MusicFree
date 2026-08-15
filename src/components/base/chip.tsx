import React, { ReactNode } from "react";
import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "./themeText";
import useColors from "@/hooks/useColors";
import IconButton from "./iconButton";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface IChipProps {
    containerStyle?: StyleProp<ViewStyle>;
    children?: ReactNode;
    onPress?: () => void;
    onClose?: () => void;
}
export default function Chip(props: IChipProps) {
    const { containerStyle, children, onPress, onClose } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.container,
                displayMetrics.isCarMode
                    ? {
                        height: displayMetrics.chipHeight,
                        paddingHorizontal: displayMetrics.horizontalPadding,
                        borderRadius: displayMetrics.chipHeight / 2,
                    }
                    : null,
                {
                    backgroundColor: colors.placeholder,
                },
                containerStyle,
            ]}>
            {typeof children === "string" ? (
                <ThemeText fontSize="subTitle" numberOfLines={1}>
                    {children}
                </ThemeText>
            ) : (
                children
            )}
            <IconButton
                onPress={onClose}
                name="x-mark"
                sizeType="small"
                style={styles.icon}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        height: rpx(56),
        paddingHorizontal: rpx(18),
        borderRadius: rpx(28),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    icon: {
        marginLeft: rpx(8),
    },
});
