import React from "react";
import { StyleSheet } from "react-native";
import rpx from "@/utils/rpx";
import Mode from "./mode";
import Background from "./background";
import { ScrollView } from "react-native-gesture-handler";
import useOrientation from "@/hooks/useOrientation";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";

export default function ThemeSetting() {
    const orientation = useOrientation();

    if (orientation === "horizontal") {
        return (
            <ResponsiveSplitView
                carPreset="balanced"
                primary={
                    <ScrollView style={style.pane}>
                        <Mode />
                    </ScrollView>
                }
                secondary={
                    <ScrollView style={style.pane}>
                        <Background />
                    </ScrollView>
                }
            />
        );
    }

    return (
        <ScrollView style={style.wrapper}>
            <Mode />
            <Background />
        </ScrollView>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        marginVertical: rpx(24),
    },
    pane: {
        flex: 1,
        minWidth: 0,
        marginVertical: rpx(24),
    },
});
