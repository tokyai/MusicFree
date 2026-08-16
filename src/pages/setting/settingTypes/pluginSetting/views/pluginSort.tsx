import AppBar from "@/components/base/appBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import SortableFlatList from "@/components/base/SortableFlatList";
import ThemeText from "@/components/base/themeText";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import PluginManager, { Plugin, useSortedPlugins } from "@/core/pluginManager";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import IconTextButton from "@/components/base/iconTextButton";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";
import useOrientation from "@/hooks/useOrientation";
import React, { useState } from "react";
import { StatusBar, StyleSheet, TouchableOpacity, View } from "react-native";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

const ITEM_HEIGHT = rpx(96);
const marginTop = rpx(188) + (StatusBar.currentHeight ?? 0);

export default function PluginSort() {
    const plugins = useSortedPlugins();
    const [sortingPlugins, setSortingPlugins] = useState([...plugins]);

    const colors = useColors();
    const { t } = useI18N();
    const orientation = useOrientation();
    const displayMetrics = useDisplayMetrics();
    const itemHeight = displayMetrics.isCarMode
        ? Math.max(ITEM_HEIGHT, displayMetrics.minTouchTarget)
        : ITEM_HEIGHT;
    const resolvedMarginTop = displayMetrics.isCarMode
        ? displayMetrics.appBarHeight * 2 + (StatusBar.currentHeight ?? 0)
        : marginTop;

    function renderSortingItem({ item }: { item: Plugin }) {
        return (
            <View
                style={[
                    style.sortItem,
                    displayMetrics.isCarMode
                        ? {
                            height: itemHeight,
                            minHeight: displayMetrics.minTouchTarget,
                            paddingHorizontal:
                                displayMetrics.horizontalPadding,
                        }
                        : null,
                ]}>
                <ThemeText>{item.name}</ThemeText>
            </View>
        );
    }

    const saveSorting = async () => {
        PluginManager.setPluginOrder(sortingPlugins);
        Toast.success(t("toast.saveSuccess"));
    };

    const sortableList = (
        <SortableFlatList
            data={sortingPlugins}
            activeBackgroundColor={colors.placeholder}
            marginTop={orientation === "horizontal" ? 0 : resolvedMarginTop}
            renderItem={renderSortingItem}
            itemHeight={itemHeight}
            itemJustifyContent={"space-between"}
            onSortEnd={data => {
                setSortingPlugins(data);
            }}
        />
    );

    if (orientation === "horizontal") {
        return (
            <>
                <AppBar>{t("pluginSetting.menu.sort")}</AppBar>
                <HorizontalSafeAreaView style={globalStyle.flex1}>
                    <ResponsiveSplitView
                        carPreset="secondaryActions"
                        primary={sortableList}
                        secondary={
                            <View style={style.actionRail}>
                                <ThemeText fontWeight="bold">
                                    {t("pluginSetting.menu.sort")}
                                </ThemeText>
                                <IconTextButton
                                    icon="check"
                                    onPress={saveSorting}
                                    containerStyle={style.actionButton}>
                                    {t("common.done")}
                                </IconTextButton>
                            </View>
                        }
                        primaryWeight={62}
                        secondaryWeight={38}
                    />
                </HorizontalSafeAreaView>
            </>
        );
    }

    return (
        <>
            <AppBar>{t("pluginSetting.menu.sort")}</AppBar>
            <HorizontalSafeAreaView style={style.sortWrapper}>
                <>
                    <ThemeText fontWeight="bold">{t("pluginSetting.menu.sort")}</ThemeText>
                    <TouchableOpacity
                        onPress={saveSorting}>
                        <ThemeText>{t("common.done")}</ThemeText>
                    </TouchableOpacity>
                </>
            </HorizontalSafeAreaView>
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                {sortableList}
            </HorizontalSafeAreaView>
        </>
    );
}

const style = StyleSheet.create({
    sortWrapper: {
        marginHorizontal: rpx(24),
        marginTop: rpx(36),
        justifyContent: "space-between",
        height: rpx(64),
        alignItems: "center",
        flexDirection: "row",
    },
    sortItem: {
        height: ITEM_HEIGHT,
        width: "100%",
        minWidth: 0,
        paddingLeft: rpx(24),
        justifyContent: "center",
    },
    actionRail: {
        flex: 1,
        minWidth: 0,
        padding: rpx(24),
        alignItems: "flex-start",
    },
    actionButton: {
        width: "100%",
        marginTop: rpx(24),
    },
});
