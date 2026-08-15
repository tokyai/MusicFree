/**
 * 搜索结果面板 一级页
 */
import React, { memo, useCallback, useState } from "react";
import { Text } from "react-native";
import rpx, { vw } from "@/utils/rpx";
import { TabBar, TabView } from "react-native-tab-view";
import ResultSubPanel, { SearchPluginResult } from "./resultSubPanel";
import results from "./results";
import { fontWeightConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import useOrientation from "@/hooks/useOrientation";
import PluginManager from "@/core/pluginManager";
import LandscapeNavigationRail from "@/components/base/landscapeNavigationRail";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";
import Empty from "@/components/base/empty";

const routes = results;

function ResultPanel() {
    const [index, setIndex] = useState(0);
    const [selectedPluginKeys, setSelectedPluginKeys] = useState<
        Partial<Record<ICommon.SupportMediaType, string>>
    >({});
    const colors = useColors();
    const { t } = useI18N();
    const orientation = useOrientation();

    const setSelectedPluginKey = useCallback(
        (tab: ICommon.SupportMediaType, pluginKey: string) => {
            setSelectedPluginKeys(prev =>
                prev[tab] === pluginKey
                    ? prev
                    : { ...prev, [tab]: pluginKey },
            );
        },
        [],
    );

    const activeRoute = routes[index] ?? routes[0];
    const pluginRoutes = PluginManager.getSortedSearchablePlugins(
        activeRoute.key,
    ).map(plugin => ({
        key: plugin.hash,
        title: plugin.name ?? `(${t("common.unknownName")})`,
    }));
    const selectedPluginKey = selectedPluginKeys[activeRoute.key];
    const activePluginRoute =
        pluginRoutes.find(route => route.key === selectedPluginKey) ??
        pluginRoutes[0];

    if (orientation === "horizontal") {
        return (
            <ResponsiveSplitView
                primary={
                    <LandscapeNavigationRail
                        sections={[
                            {
                                key: "media-types",
                                title: t("common.mediaType"),
                                items: routes.map(route => ({
                                    key: route.key,
                                    title: route.i18nKey
                                        ? t(route.i18nKey as any)
                                        : route.title,
                                })),
                                selectedKey: activeRoute.key,
                                onSelect: key => {
                                    const nextIndex = routes.findIndex(
                                        route => route.key === key,
                                    );
                                    if (nextIndex >= 0) {
                                        setIndex(nextIndex);
                                    }
                                },
                            },
                            {
                                key: "sources",
                                title: t("common.source"),
                                items: pluginRoutes,
                                selectedKey: activePluginRoute?.key,
                                onSelect: key => {
                                    setSelectedPluginKey(activeRoute.key, key);
                                },
                            },
                        ]}
                    />
                }
                secondary={
                    activePluginRoute ? (
                        <SearchPluginResult
                            key={`${activeRoute.key}-${activePluginRoute.key}`}
                            tab={activeRoute.key}
                            pluginHash={activePluginRoute.key}
                            pluginName={activePluginRoute.title}
                        />
                    ) : (
                        <Empty />
                    )
                }
            />
        );
    }

    return (
        <TabView
            lazy
            navigationState={{
                index,
                routes,
            }}
            renderTabBar={props => (
                <TabBar
                    {...props}
                    scrollEnabled
                    style={{
                        backgroundColor: colors.tabBar,
                        shadowColor: "transparent",
                        borderColor: "transparent",
                    }}
                    inactiveColor={colors.text}
                    activeColor={colors.primary}
                    tabStyle={{
                        width: "auto",
                    }}
                    renderLabel={({ route, focused, color }) => (
                        <Text
                            numberOfLines={1}
                            style={{
                                width: rpx(160),
                                fontWeight: focused
                                    ? fontWeightConst.bolder
                                    : fontWeightConst.medium,
                                color,
                                textAlign: "center",
                            }}>
                            {route.i18nKey ? t(route.i18nKey as any) : route.title}
                        </Text>
                    )}
                    indicatorStyle={{
                        backgroundColor: colors.primary,
                        height: rpx(4),
                    }}
                />
            )}
            renderScene={({ route }) => (
                <ResultSubPanel
                    tab={route.key}
                    selectedPluginKey={selectedPluginKeys[route.key]}
                    onPluginChange={key => {
                        setSelectedPluginKey(route.key, key);
                    }}
                />
            )}
            onIndexChange={setIndex}
            initialLayout={{ width: vw(100) }}
        />
    );
}

export default memo(ResultPanel);
