import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import Config, { useAppConfig } from "@/core/appConfig";
import { FlatList } from "react-native-gesture-handler";
import Empty from "@/components/base/empty";
import ListItem from "@/components/base/listItem";
import Toast from "@/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import { showDialog } from "@/components/dialogs/useDialog";
import AppBar from "@/components/base/appBar";
import Fab from "@/components/base/fab";
import IconTextButton from "@/components/base/iconTextButton";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";
import useOrientation from "@/hooks/useOrientation";
import { useI18N } from "@/core/i18n";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface ISubscribeItem {
    name: string;
    url: string;
}

const ITEM_HEIGHT = rpx(108);

export default function PluginSubscribe() {
    const urls = useAppConfig("plugin.subscribeUrl") ?? "";
    const [subscribes, setSubscribes] = useState<Array<ISubscribeItem>>([]);

    const { t } = useI18N();
    const orientation = useOrientation();
    const displayMetrics = useDisplayMetrics();
    const itemHeight = displayMetrics.isCarMode
        ? displayMetrics.listItemHeights.normal ?? ITEM_HEIGHT
        : ITEM_HEIGHT;

    useEffect(() => {
        try {
            const parsed = JSON.parse(urls);
            if (Array.isArray(parsed)) {
                setSubscribes(parsed);
            } else {
                throw new Error();
            }
        } catch {
            if (urls.length) {
                setSubscribes([
                    {
                        name: t("common.default"),
                        url: urls,
                    },
                ]);
            } else {
                setSubscribes([]);
            }
        }
    }, [urls]);

    const onSubmit = (
        subscribeItem: ISubscribeItem,
        hideDialog: () => void,
        editingIndex?: number,
    ) => {
        if (
            subscribeItem.url.endsWith(".js") ||
            subscribeItem.url.endsWith(".json")
        ) {
            if (editingIndex !== undefined) {
                Config.setConfig(
                    "plugin.subscribeUrl",
                    JSON.stringify([
                        ...subscribes.slice(0, editingIndex),
                        subscribeItem,
                        ...subscribes.slice(editingIndex + 1),
                    ]),
                );
            } else {
                Config.setConfig(
                    "plugin.subscribeUrl",
                    JSON.stringify([...subscribes, subscribeItem]),
                );
            }
            hideDialog();
        } else {
            Toast.warn(t("toast.subscriptionHaveToEndWithJs"));
        }
    };

    const openAddDialog = () => {
        showDialog("SubscribePluginDialog", {
            onSubmit,
        });
    };

    const subscribeList = (
        <View style={globalStyle.flex1}>
            <FlatList
                style={style.listWrapper}
                ListEmptyComponent={Empty}
                data={subscribes}
                renderItem={({ item, index }) => {
                    return (
                        <ListItem
                            withHorizontalPadding
                            onPress={() => {
                                showDialog("SubscribePluginDialog", {
                                    subscribeItem: item,
                                    onSubmit,
                                    editingIndex: index,
                                    onDelete(editingIndex, hideDialog) {
                                        Config.setConfig(
                                            "plugin.subscribeUrl",
                                            JSON.stringify([
                                                ...subscribes.slice(
                                                    0,
                                                    editingIndex,
                                                ),
                                                ...subscribes.slice(
                                                    editingIndex + 1,
                                                ),
                                            ]),
                                        );
                                        hideDialog();
                                        Toast.success(
                                            t("toast.deleteSuccess"),
                                        );
                                    },
                                });
                            }}>
                            <ListItem.Content
                                title={item.name}
                                description={item.url}
                            />
                            <ListItem.ListItemIcon
                                icon="share"
                                position="right"
                                onPress={() => {
                                    Clipboard.setString(item.url);
                                    Toast.success(
                                        t("toast.copiedToClipboard"),
                                    );
                                }}
                            />
                        </ListItem>
                    );
                }}
                getItemLayout={(_, index) => ({
                    length: itemHeight,
                    offset: itemHeight * index,
                    index,
                })}
            />
        </View>
    );

    if (orientation === "horizontal") {
        return (
            <>
                <AppBar>{t("pluginSetting.menu.subscriptionSetting")}</AppBar>
                <HorizontalSafeAreaView style={globalStyle.flex1}>
                    <ResponsiveSplitView
                        carPreset="secondaryActions"
                        primary={subscribeList}
                        secondary={
                            <View style={style.actionRail}>
                                <IconTextButton
                                    icon="plus"
                                    onPress={openAddDialog}
                                    containerStyle={style.actionButton}>
                                    {t("pluginSetting.menu.subscriptionSetting")}
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
            <AppBar>{t("pluginSetting.menu.subscriptionSetting")}</AppBar>
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                {subscribeList}
            </HorizontalSafeAreaView>
            <Fab
                icon="plus"
                onPress={openAddDialog}
            />
        </>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    listWrapper: {
        marginTop: rpx(24),
    },
    actionRail: {
        flex: 1,
        minWidth: 0,
        padding: rpx(24),
    },
    actionButton: {
        width: "100%",
    },
    fab: {
        position: "absolute",
        right: rpx(36),
        bottom: rpx(36),
    },
});
