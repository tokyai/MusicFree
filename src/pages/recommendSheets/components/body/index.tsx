import NoPlugin from "@/components/base/noPlugin";
import { fontWeightConst } from "@/constants/uiConst";
import { useI18N } from "@/core/i18n";
import PluginManager from "@/core/pluginManager";
import useColors from "@/hooks/useColors";
import rpx, { vw } from "@/utils/rpx";
import React, { useCallback, useMemo, useState } from "react";
import { Text } from "react-native";
import { TabBar, TabView } from "react-native-tab-view";
import SheetBody from "./sheetBody";
import useOrientation from "@/hooks/useOrientation";

interface ITagSelection {
    selectedTag: ICommon.IUnique;
    firstTag: ICommon.IUnique;
}

export default function Body() {
    const [index, setIndex] = useState(0);
    const colors = useColors();
    const routes = PluginManager.getSortedPluginsWithAbility("getRecommendSheetsByTag").map(
        _ => ({
            key: _.hash,
            title: _.name,
        }),
    );
    const { t } = useI18N();
    const orientation = useOrientation();
    const defaultTag = useMemo<ICommon.IUnique>(
        () => ({
            title: t("common.default"),
            id: "",
        }),
        [t],
    );
    const [tagSelections, setTagSelections] = useState<
        Record<string, ITagSelection>
    >({});

    const selectTag = useCallback(
        (hash: string, tag: ICommon.IUnique, showAsFirstTag: boolean) => {
            setTagSelections(prev => {
                const previous = prev[hash] ?? {
                    selectedTag: defaultTag,
                    firstTag: defaultTag,
                };
                return {
                    ...prev,
                    [hash]: {
                        selectedTag: tag,
                        firstTag: showAsFirstTag
                            ? tag
                            : previous.firstTag,
                    },
                };
            });
        },
        [defaultTag],
    );

    const renderTabBar = (_: any) => (
        <TabBar
            {..._}
            scrollEnabled
            style={{
                backgroundColor: "transparent",
                shadowColor: "transparent",
                borderColor: "transparent",
            }}
            tabStyle={{
                width: "auto",
            }}
            pressColor="transparent"
            inactiveColor={colors.text}
            activeColor={colors.primary}
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
                    {route.title ?? `(${t("common.unknownName")})`}
                </Text>
            )}
            indicatorStyle={{
                backgroundColor: colors.primary,
                height: rpx(4),
            }}
        />
    );

    if (!routes?.length) {
        return <NoPlugin notSupportType={t("recommendSheet.title")} />;
    }

    const activeRoute = routes[index] ?? routes[0];
    const activeTagSelection = tagSelections[activeRoute.key] ?? {
        selectedTag: defaultTag,
        firstTag: defaultTag,
    };

    if (orientation === "horizontal") {
        return (
            <SheetBody
                key={activeRoute.key}
                hash={activeRoute.key}
                defaultTag={defaultTag}
                selectedTag={activeTagSelection.selectedTag}
                firstTag={activeTagSelection.firstTag}
                onTagSelect={(tag, showAsFirstTag) => {
                    selectTag(activeRoute.key, tag, showAsFirstTag);
                }}
                landscapeSource={{
                    items: routes.map(route => ({
                        key: route.key,
                        title:
                            route.title ?? `(${t("common.unknownName")})`,
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
                }}
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
            renderTabBar={renderTabBar}
            renderScene={props => {
                const selection = tagSelections[props.route.key] ?? {
                    selectedTag: defaultTag,
                    firstTag: defaultTag,
                };
                return (
                    <SheetBody
                        hash={props.route.key}
                        defaultTag={defaultTag}
                        selectedTag={selection.selectedTag}
                        firstTag={selection.firstTag}
                        onTagSelect={(tag, showAsFirstTag) => {
                            selectTag(
                                props.route.key,
                                tag,
                                showAsFirstTag,
                            );
                        }}
                    />
                );
            }}
            onIndexChange={setIndex}
            initialLayout={{ width: vw(100) }}
        />
    );
}
