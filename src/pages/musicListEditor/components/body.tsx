import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import Button from "@/components/base/textButton.tsx";
import { useAtom } from "jotai";
import { editingMusicListAtom, musicListChangedAtom } from "../store/atom";
import Toast from "@/utils/toast";
import MusicList from "./musicList";
import { useParams } from "@/core/router";
import { localMusicSheetId, musicHistorySheetId } from "@/constants/commonConst";
import LocalMusicSheet from "@/core/localMusicSheet";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import musicHistory from "@/core/musicHistory";
import MusicSheet from "@/core/musicSheet";
import { useI18N } from "@/core/i18n";
import useOrientation from "@/hooks/useOrientation";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";
import Bottom from "./bottom";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

export default function Body() {
    const { musicSheet } = useParams<"music-list-editor">();

    const { t } = useI18N();
    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const [musicListChanged, setMusicListChanged] =
        useAtom(musicListChangedAtom);
    const orientation = useOrientation();
    const displayMetrics = useDisplayMetrics();
    const carLandscape =
        orientation === "horizontal" && displayMetrics.isCarMode;
    const selectedItems = useMemo(
        () => editingMusicList.filter(_ => _.checked),
        [editingMusicList],
    );
    const selectActionTitle =
        selectedItems.length !== editingMusicList.length &&
        editingMusicList.length
            ? t("common.selectAll")
            : t("common.unselectAll");
    const header = (
        <View
            style={[
                style.header,
                orientation === "horizontal" ? style.landscapeHeader : null,
                carLandscape ? style.carLandscapeHeader : null,
                displayMetrics.isCarMode
                    ? {
                        minHeight: displayMetrics.minTouchTarget,
                        paddingHorizontal: carLandscape
                            ? displayMetrics.scaleRpx(8)
                            : displayMetrics.horizontalPadding,
                    }
                    : null,
                displayMetrics.isCarMode && !carLandscape
                    ? {
                        paddingVertical: displayMetrics.scaleRpx(12),
                    }
                    : null,
            ]}>
            <Button
                style={carLandscape ? style.carHeaderSelectButton : null}
                onPress={() => {
                    if (
                        selectedItems.length !== editingMusicList.length &&
                            editingMusicList.length
                    ) {
                        setEditingMusicList(
                            editingMusicList.map(_ => ({
                                musicItem: _.musicItem,
                                checked: true,
                            })),
                        );
                    } else {
                        setEditingMusicList(
                            editingMusicList.map(_ => ({
                                musicItem: _.musicItem,
                                checked: false,
                            })),
                        );
                    }
                }}>
                {carLandscape
                    ? `${selectActionTitle} (${selectedItems.length})`
                    : `${selectActionTitle} (${t(
                        "musicListEditor.selectMusicCount",
                        { count: selectedItems.length },
                    )})`}
            </Button>
            <Button
                style={carLandscape ? style.carHeaderSaveButton : null}
                fontColor={
                    musicListChanged && musicSheet?.id
                        ? "primary"
                        : "textSecondary"
                }
                onPress={async () => {
                    if (musicListChanged && musicSheet?.id) {
                        if (musicSheet.id === localMusicSheetId) {
                            await LocalMusicSheet.updateMusicList(
                                editingMusicList.map(_ => _.musicItem),
                            );
                        } else if (musicSheet.id === musicHistorySheetId) {
                            await musicHistory.setHistory(
                                editingMusicList.map(_ => _.musicItem),
                            );
                        } else {
                            await MusicSheet.manualSort(
                                musicSheet.id,
                                editingMusicList.map(_ => _.musicItem),
                            );
                        }

                        Toast.success(t("toast.saveSuccess"));
                        setMusicListChanged(false);
                    }
                }}>
                {t("common.save")}
            </Button>
        </View>
    );

    if (orientation === "horizontal") {
        return (
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                <ResponsiveSplitView
                    carPreset="secondaryActions"
                    primary={<MusicList />}
                    secondary={
                        <View style={style.actionRail}>
                            {header}
                            <Bottom landscape />
                        </View>
                    }
                    primaryWeight={62}
                    secondaryWeight={38}
                />
            </HorizontalSafeAreaView>
        );
    }

    return (
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            {header}
            <MusicList />
        </HorizontalSafeAreaView>
    );
}

const style = StyleSheet.create({
    header: {
        flexDirection: "row",
        height: rpx(88),
        paddingHorizontal: rpx(24),
        alignItems: "center",
        justifyContent: "space-between",
    },
    landscapeHeader: {
        height: "auto",
        width: "100%",
        flexDirection: "column",
        alignItems: "stretch",
        gap: rpx(16),
        paddingVertical: rpx(24),
    },
    carLandscapeHeader: {
        flexDirection: "row",
        alignItems: "stretch",
        gap: rpx(8),
        paddingVertical: 0,
    },
    carHeaderSelectButton: {
        flex: 2,
        minWidth: 0,
        alignItems: "center",
    },
    carHeaderSaveButton: {
        flex: 1,
        minWidth: 0,
        alignItems: "center",
    },
    actionRail: {
        flex: 1,
        minWidth: 0,
    },
});
