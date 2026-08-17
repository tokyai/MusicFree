import Button from "@/components/base/textButton";
import { showDialog } from "@/components/dialogs/useDialog";
import { useI18N } from "@/core/i18n";
import MusicSheet from "@/core/musicSheet";
import {
    batchSwitchMusicSources,
    getSourceSwitchPlugins,
} from "@/core/musicSourceSwitcher";
import { useParams } from "@/core/router";
import { devLog } from "@/utils/log";
import Toast from "@/utils/toast";
import { useAtom } from "jotai";
import React, { useMemo } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { editingMusicListAtom } from "../store/atom";

interface ISourceSwitchButtonProps {
    style?: StyleProp<ViewStyle>;
}

export default function SourceSwitchButton(
    props: ISourceSwitchButtonProps,
) {
    const { style } = props;
    const { musicSheet } = useParams<"music-list-editor">();
    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const { t } = useI18N();
    const selectedItems = useMemo(
        () =>
            editingMusicList
                .filter(item => item.checked)
                .map(item => item.musicItem),
        [editingMusicList],
    );

    return (
        <Button
            style={style}
            fontColor={selectedItems.length ? "primary" : "textSecondary"}
            onPress={() => {
                if (!selectedItems.length) {
                    Toast.warn(t("toast.sourceSwitchNoSelection"));
                    return;
                }
                const sheetId = musicSheet?.id;
                if (!sheetId) {
                    Toast.warn(t("toast.sourceSwitchFailed"));
                    return;
                }

                const plugins = getSourceSwitchPlugins();
                if (!plugins.length) {
                    Toast.warn(t("toast.sourceSwitchNoPlugin"));
                    return;
                }

                const selectedSnapshot = [...selectedItems];
                const existingSnapshot = editingMusicList.map(
                    item => item.musicItem,
                );
                showDialog("RadioDialog", {
                    title: t("musicListEditor.sourceSwitchTarget"),
                    content: plugins.map(plugin => ({
                        label: plugin.name,
                        value: plugin.hash,
                    })),
                    onOk(value) {
                        const targetPlugin = plugins.find(
                            plugin => plugin.hash === value,
                        );
                        if (!targetPlugin) {
                            Toast.warn(t("toast.sourceSwitchNoPlugin"));
                            return;
                        }

                        // RadioDialog closes after onOk; defer opening the
                        // loading dialog so it is not closed at the same time.
                        Promise.resolve().then(() => {
                            const abortController = new AbortController();
                            showDialog("LoadingDialog", {
                                title: t("musicListEditor.sourceSwitch"),
                                loadingText: t(
                                    "musicListEditor.sourceSwitching",
                                ),
                                cancelOnDismiss: true,
                                task: () =>
                                    batchSwitchMusicSources({
                                        musicItems: selectedSnapshot,
                                        existingMusicItems: existingSnapshot,
                                        targetPlugin,
                                        signal: abortController.signal,
                                    }),
                                onCancel(closeDialog) {
                                    abortController.abort();
                                    closeDialog();
                                },
                                async onResolve(result, closeDialog) {
                                    if (
                                        result.cancelled ||
                                        abortController.signal.aborted
                                    ) {
                                        return;
                                    }

                                    // The search phase is complete and no
                                    // longer cancellable before persistence.
                                    closeDialog();
                                    try {
                                        const replacedCount =
                                            await MusicSheet.replaceMusicItems(
                                                sheetId,
                                                result.replacements,
                                            );
                                        const latestMusicList =
                                            MusicSheet.getSortedMusicListBySheetId(
                                                sheetId,
                                            ).musicList;
                                        setEditingMusicList(
                                            latestMusicList.map(musicItem => ({
                                                musicItem,
                                                checked: false,
                                            })),
                                        );
                                        const skippedCount =
                                            result.skipped.length +
                                            Math.max(
                                                0,
                                                result.replacements.length -
                                                    replacedCount,
                                            );
                                        Toast.success(
                                            t("toast.sourceSwitchSummary", {
                                                success: replacedCount,
                                                failed: result.failures.length,
                                                skipped: skippedCount,
                                            }),
                                        );
                                    } catch (error) {
                                        devLog(
                                            "error",
                                            "批量换源提交失败",
                                            error,
                                        );
                                        Toast.warn(
                                            t("toast.sourceSwitchFailed"),
                                        );
                                    }
                                },
                                onReject(error, closeDialog) {
                                    closeDialog();
                                    if (!abortController.signal.aborted) {
                                        devLog(
                                            "error",
                                            "批量换源执行失败",
                                            error,
                                        );
                                        Toast.warn(
                                            t("toast.sourceSwitchFailed"),
                                        );
                                    }
                                },
                            });
                        });
                    },
                });
            }}>
            {t("musicListEditor.sourceSwitch")}
        </Button>
    );
}
