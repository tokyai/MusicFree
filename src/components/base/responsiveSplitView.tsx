import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import useColors from "@/hooks/useColors";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import {
    DisplaySplitPreset,
    resolveDisplaySplitWeights,
} from "@/utils/displayMetrics";

interface IResponsiveSplitViewProps {
    primary: ReactNode;
    secondary: ReactNode;
    primaryWeight?: number;
    secondaryWeight?: number;
    carPreset?: DisplaySplitPreset;
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
        carPreset,
        showDivider = true,
        style,
        primaryStyle,
        secondaryStyle,
    } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();
    const weights = resolveDisplaySplitWeights(
        carPreset,
        displayMetrics.isCarMode,
        primaryWeight,
        secondaryWeight,
    );

    return (
        <View style={[styles.wrapper, style]}>
            <View style={[styles.pane, { flex: weights.primary }, primaryStyle]}>
                {primary}
            </View>
            <View
                style={[
                    styles.pane,
                    showDivider ? styles.secondaryWithDivider : null,
                    showDivider ? { borderLeftColor: colors.divider } : null,
                    { flex: weights.secondary },
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
