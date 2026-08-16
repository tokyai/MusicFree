import React, { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import Loading from "@/components/base/loading";

import PluginManager, { useSortedPlugins } from "@/core/pluginManager";

import Toast from "@/utils/toast";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import Config from "@/core/appConfig";
import Empty from "@/components/base/empty";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import AppBar from "@/components/base/appBar";
import Fab from "@/components/base/fab";
import IconTextButton from "@/components/base/iconTextButton";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";
import useOrientation from "@/hooks/useOrientation";
import PluginItem from "../components/pluginItem";
import { IIconName } from "@/components/base/icon.tsx";
import { IInstallPluginResult } from "@/types/core/pluginManager";
import { useI18N } from "@/core/i18n";

interface IOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
}

export default function PluginList() {
    const plugins = useSortedPlugins();
    const { t } = useI18N();

    const [loading, setLoading] = useState(false);

    const navigator = useNavigation<any>();
    const orientation = useOrientation();

    const menuOptions: IOption[] = [
        {
            icon: "bookmark-square",
            title: t("pluginSetting.menu.subscriptionSetting"),
            async onPress() {
                navigator.navigate("/pluginsetting/subscribe");
            },
        },
        {
            icon: "bars-3",
            title: t("pluginSetting.menu.sort"),
            onPress() {
                navigator.navigate("/pluginsetting/sort");
            },
        },
        {
            icon: "trash-outline",
            title: t("pluginSetting.menu.uninstallAll"),
            onPress() {
                showDialog("SimpleDialog", {
                    title: t("pluginSetting.menu.uninstallAll"),
                    content: t("pluginSetting.menu.uninstallAllContent"),
                    async onOk() {
                        setLoading(true);
                        await PluginManager.uninstallAllPlugins();
                        setLoading(false);
                    },
                });
            },
        },
    ];

    async function onInstallFromNetworkClick() {
        showPanel("SimpleInput", {
            title: t("pluginSetting.menu.installPlugin"),
            placeholder: t("pluginSetting.menu.installPluginDialogPlaceholder"),
            maxLength: 200,
            async onOk(text, closePanel) {
                setLoading(true);
                closePanel();

                const result = await installPluginFromUrl(text.trim());

                // 检查是否全部安装成功
                const successResults: IInstallPluginResult[] = [];
                const failResults: IInstallPluginResult[] = [];
                for (let i = 0; i < result.length; ++i) {
                    if (result[i].success) {
                        successResults.push(result[i]);
                    } else {
                        failResults.push(result[i]);
                    }
                }

                if (!failResults.length) {
                    Toast.success(t("toast.installPluginSuccess"));
                } else {
                    Toast.warn(successResults.length ? t("toast.partialPluginInstallFailed") : t("toast.allPluginInstallFailed"), {
                        "type": "warn",
                        "actionText": t("common.view"),
                        "onActionClick": () => {
                            showDialog("SimpleDialog", {
                                title: t("pluginSetting.menu.pluginInstallFailedDialogTitle"),
                                content: t("pluginSetting.pluginInstallFailedDialogContent", {
                                    detail: failResults.map(it => (it.pluginUrl ?? "") + "\n" + t("pluginSetting.failReason", {
                                        reason: it.message ?? "",
                                    })).join("\n-----\n"),
                                }),
                            });
                        },
                    });
                }


                setLoading(false);
            },
        });
    }

    async function onSubscribeClick() {
        const urls = Config.getConfig("plugin.subscribeUrl");
        if (!urls) {
            Toast.warn(t("toast.noSubscription"));
        }
        setLoading(true);

        const successResults: IInstallPluginResult[] = [];
        const failResults: IInstallPluginResult[] = [];

        try {
            const urlItems = JSON.parse(urls!);
            if (Array.isArray(urlItems)) {
                for (let i = 0; i < urlItems.length; ++i) {
                    const result = await installPluginFromUrl(urlItems[i].url);
                    if (result[0]) {
                        if (result[0].success) {
                            successResults.push(result[0]);
                        } else {
                            failResults.push(result[0]);
                        }
                    }
                }
            } else {
                throw new Error();
            }

            if (!failResults.length) {
                Toast.success(t("toast.installPluginSuccess"));
            } else {
                Toast.warn((successResults.length ? t("toast.partialPluginInstallFailed") : t("toast.allPluginInstallFailed")), {
                    "type": "warn",
                    "actionText": t("common.view"),
                    "onActionClick": () => {
                        showDialog("SimpleDialog", {
                            title: t("pluginSetting.menu.pluginInstallFailedDialogTitle"),
                            content: t("pluginSetting.pluginInstallFailedDialogContent", {
                                detail: failResults.map(it => (it.pluginUrl ?? "") + "\n" + t("pluginSetting.failReason", {
                                    reason: it.message ?? "",
                                })).join("\n-----\n"),
                            }),
                        });
                    },
                });
            }

        } catch {
            if (urls?.length) {
                const result = await installPluginFromUrl(urls);
                if (result[0]) {
                    if (result[0].success) {
                        Toast.success(t("toast.installPluginSuccess"));
                    } else {
                        Toast.warn(t("toast.partialPluginInstallFailedWithReason", {
                            reason: result[0].message ?? "",
                        }));
                    }
                } else {
                    Toast.warn(t("toast.subscriptionInvalid"));
                }
            }
        }
        setLoading(false);
    }

    async function onUpdateAllClick() {
        const plugins = PluginManager.getEnabledPlugins();
        setLoading(true);

        const successResults: IInstallPluginResult[] = [];
        const failResults: IInstallPluginResult[] = [];

        try {
            for (let i = 0; i < plugins.length; ++i) {
                const srcUrl = plugins[i].instance.srcUrl;
                if (srcUrl) {
                    const result = await installPluginFromUrl(srcUrl);
                    if (result[0]) {
                        if (result[0].success) {
                            successResults.push(result[0]);
                        } else {
                            failResults.push(result[0]);
                        }
                    }
                }
            }

            if (!failResults.length) {
                Toast.success(t("toast.updatePluginSuccess"));
            } else {
                Toast.warn((successResults.length ? t("toast.partialPluginUpdateFailed") : t("toast.allPluginUpdateFailed")), {
                    "type": "warn",
                    "actionText": t("common.view"),
                    "onActionClick": () => {
                        showDialog("SimpleDialog", {
                            title: t("pluginSetting.menu.pluginUpdateFailedDialogTitle"),
                            content: t("pluginSetting.pluginUpdateFailedDialogContent", {
                                detail: failResults.map(it => (it.pluginUrl ?? "") + "\n" + t("pluginSetting.failReason", {
                                    reason: it.message ?? "",
                                })).join("\n-----\n"),
                            }),
                        });
                    },
                });
            }

        } catch (e: any) {
            Toast.warn(t("toast.unknownError", {
                reason: e?.message ?? e,
            }));
        }
        setLoading(false);
    }

    const openInstallOptions = () => {
        showPanel("SimpleSelect", {
            header: t("pluginSetting.menu.installPlugin"),
            candidates: [
                {
                    value: "从网络安装插件",
                    title: t("pluginSetting.fabOptions.installFromNetwork"),
                },
                {
                    value: "更新全部插件",
                    title: t("pluginSetting.fabOptions.updateAllPlugins"),
                },
                {
                    value: "更新订阅",
                    title: t("pluginSetting.fabOptions.updateSubscription"),
                },
            ],
            onPress(item) {
                if (item.value === "从网络安装插件") {
                    onInstallFromNetworkClick();
                } else if (item.value === "更新订阅") {
                    onSubscribeClick();
                } else if (item.value === "更新全部插件") {
                    onUpdateAllClick();
                }
            },
        });
    };

    const pluginList = (
        <View style={style.wrapper}>
            {loading ? (
                <Loading />
            ) : (
                <FlatList
                    ListEmptyComponent={Empty}
                    ListFooterComponent={<View style={style.blank} />}
                    data={plugins ?? []}
                    keyExtractor={_ => _.hash}
                    renderItem={({ item: plugin }) => (
                        <PluginItem key={plugin.hash} plugin={plugin} />
                    )}
                />
            )}
        </View>
    );

    if (orientation === "horizontal") {
        return (
            <>
                <AppBar menu={menuOptions}>
                    {t("sidebar.pluginManagement")}
                </AppBar>
                <HorizontalSafeAreaView style={style.wrapper}>
                    <ResponsiveSplitView
                        carPreset="secondaryActions"
                        primary={pluginList}
                        secondary={
                            <View style={style.actionRail}>
                                <IconTextButton
                                    icon="plus"
                                    onPress={openInstallOptions}
                                    containerStyle={style.actionButton}>
                                    {t("pluginSetting.menu.installPlugin")}
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
            <AppBar menu={menuOptions}>{t("sidebar.pluginManagement")}</AppBar>
            <HorizontalSafeAreaView style={style.wrapper}>
                {pluginList}
            </HorizontalSafeAreaView>
            <Fab icon="plus" onPress={openInstallOptions} />
        </>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    blank: {
        height: rpx(200),
    },
    actionRail: {
        flex: 1,
        minWidth: 0,
        padding: rpx(24),
    },
    actionButton: {
        width: "100%",
    },
});



async function installPluginFromUrl(text: string): Promise<IInstallPluginResult[]> {
    try {
        let urls: string[] = [];
        const inputUrl = text.trim();
        if (text.endsWith(".json")) {
            const jsonFile = (
                await axios.get(inputUrl, {
                    headers: {
                        "Cache-Control": "no-cache",
                        Pragma: "no-cache",
                        Expires: "0",
                    },
                })
            ).data;
            /**
             * {
             *     plugins: [{
             *          version: xxx,
             *          url: xxx
             *      }]
             * }
             */
            urls = (jsonFile?.plugins ?? []).map((_: any) => _.url);
        } else {
            urls = [inputUrl];
        }
        return await Promise.all(
            urls.map(url =>
                PluginManager.installPluginFromUrl(url, {
                    notCheckVersion: Config.getConfig(
                        "basic.notCheckPluginVersion",
                    ),
                }),
            ),
        );
    } catch (e: any) {
        return [{ success: false, message: e?.message, pluginUrl: text }];
    }
}
