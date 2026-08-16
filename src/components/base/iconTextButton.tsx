import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "./themeText";
import { iconSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import { TouchableOpacity } from "react-native-gesture-handler";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface IProps {
    icon: IIconName;
    onPress?: () => void;
    containerStyle?: StyleProp<ViewStyle>;
    children?: string;
}
export default function (props: IProps) {
    const { icon, children, onPress, containerStyle } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[
                style.container,
                displayMetrics.isCarMode
                    ? {
                        minHeight: displayMetrics.minTouchTarget,
                        paddingHorizontal: displayMetrics.horizontalPadding,
                        paddingVertical: displayMetrics.scaleRpx(8),
                    }
                    : null,
                containerStyle,
            ]}
            onPress={onPress}>
            <Icon
                name={icon}
                size={
                    displayMetrics.isCarMode
                        ? Math.max(
                            iconSizeConst.light,
                            displayMetrics.iconSizes.light,
                        )
                        : iconSizeConst.light
                }
                color={colors.text}
            />
            <ThemeText
                style={style.text}
                fontSize={"content"}
                numberOfLines={2}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.75}>
                {children}
            </ThemeText>
        </TouchableOpacity>
    );
}

const style = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        minWidth: 0,
        maxWidth: "100%",
        flexShrink: 1,
        paddingHorizontal: rpx(16),
        paddingVertical: rpx(8),
    },
    text: {
        marginLeft: rpx(8),
        minWidth: 0,
        flexShrink: 1,
    },
});
