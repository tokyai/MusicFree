import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import rpx from "@/utils/rpx";
import React from "react";
import { StyleSheet, View } from "react-native";
import ActionButton from "../ActionButton";

export default function Operations() {
    const navigate = useNavigate();
    const { t } = useI18N();
    const displayMetrics = useDisplayMetrics();

    const actionButtons = [
        {
            iconName: "fire",
            title: t("home.recommendSheet"),
            action() {
                navigate(ROUTE_PATH.RECOMMEND_SHEETS);
            },
        },
        {
            iconName: "trophy",
            title: t("home.topList"),
            action() {
                navigate(ROUTE_PATH.TOP_LIST);
            },
        },
        {
            iconName: "clock-outline",
            title: t("home.playHistory"),
            action() {
                navigate(ROUTE_PATH.HISTORY);
            },
        },
        {
            iconName: "folder-music-outline",
            title: t("home.localMusic"),
            action() {
                navigate(ROUTE_PATH.LOCAL);
            },
        },
    ] as const;

    return (
        <View
            style={[
                styles.container,
                displayMetrics.isCarMode ? styles.carContainer : null,
            ]}>
            {actionButtons.map((action, index) => (
                <ActionButton
                    style={[
                        styles.actionButtonStyle,
                        displayMetrics.isCarMode
                            ? styles.carActionButton
                            : index % 4
                                ? styles.actionMarginLeft
                                : null,
                    ]}
                    key={action.title}
                    {...action}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        minWidth: 0,
        paddingHorizontal: rpx(24),
        marginVertical: rpx(32),
        flexDirection: "row",
        flexWrap: "nowrap",
    },
    carContainer: {
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    actionButtonStyle: {
        width: rpx(157.5),
        height: rpx(160),
        borderRadius: rpx(18),
    },
    actionMarginLeft: {
        marginLeft: rpx(24),
    },
    carActionButton: {
        width: "48%",
        flexGrow: 0,
        flexShrink: 1,
        marginLeft: 0,
        marginBottom: rpx(24),
    },
});
