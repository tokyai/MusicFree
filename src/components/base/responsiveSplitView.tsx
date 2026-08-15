import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import useColors from "@/hooks/useColors";

interface IResponsiveSplitViewProps {
    primary: ReactNode;
    secondary: ReactNode;
    primaryWeight?: number;
    secondaryWeight?: number;
    showDivider?: boolean;
    style?: StyleProp<ViewStyle>;
    primaryStyle?: StyleProp<ViewStyle>;
    secondaryStyle?: StyleProp<ViewStyle>;
}

export default function ResponsiveSplitView(props: IResponsiveSplitViewProps) {
    const {
        primary,
        secondary,
        primaryWeight = 38,
        secondaryWeight = 62,
        showDivider = true,
        style,
        primaryStyle,
        secondaryStyle,
    } = props;
    const colors = useColors();

    return (
        <View style={[styles.wrapper, style]}>
            <View style={[styles.pane, { flex: primaryWeight }, primaryStyle]}>
                {primary}
            </View>
            <View
                style={[
                    styles.pane,
                    showDivider ? styles.secondaryWithDivider : null,
                    showDivider ? { borderLeftColor: colors.divider } : null,
                    { flex: secondaryWeight },
                    secondaryStyle,
                ]}>
                {secondary}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
        flexDirection: "row",
        minWidth: 0,
        minHeight: 0,
    },
    pane: {
        minWidth: 0,
        minHeight: 0,
    },
    secondaryWithDivider: {
        borderLeftWidth: StyleSheet.hairlineWidth,
    },
});
