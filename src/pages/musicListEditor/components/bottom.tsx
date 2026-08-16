import Icon, { IIconName } from "@/components/base/icon.tsx";
import ThemeText from "@/components/base/themeText";
import { showPanel } from "@/components/panels/usePanel";
import { iconSizeConst } from "@/constants/uiConst";
import downloader from "@/core/downloader";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import { produce } from "immer";
import { useAtom, useSetAtom } from "jotai";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { editingMusicListAtom, musicListChangedAtom } from "../store/atom";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface IBottomProps {
    landscape?: boolean;
}

export default function Bottom(props: IBottomProps) {
    const { landscape = false } = props;
    const { musicSheet } = useParams<"music-list-editor">();
    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);
    const { t } = useI18N();

    const selectedEditorItems = useMemo(
        () => editingMusicList.filter(_ => _.checked),
        [editingMusicList],
    );

    const selectedItems = useMemo(
        () => selectedEditorItems.map(_ => _.musicItem),
        [selectedEditorItems],
    );

    function resetSelectedIndices() {
        setEditingMusicList(
            editingMusicList.map(_ => ({
                musicItem: _.musicItem,
                checked: false,
            })),
        );
    }

    return (
        <View style={[style.wrapper, landscape ? style.landscapeWrapper : null]}>
            <BottomIcon
                icon="motion-play"
                landscape={landscape}
                title={t("musicListEditor.addToNextPlay")}
                onPress={async () => {
                    TrackPlayer.addNext(selectedItems);
                    resetSelectedIndices();
                    Toast.success(t("toast.addToNextPlay"));
                }}
            />
            <BottomIcon
                icon="folder-plus"
                landscape={landscape}
                title={t("musicListEditor.addToSheet")}
                onPress={() => {
                    if (selectedItems.length) {
                        showPanel("AddToMusicSheet", {
                            musicItem: selectedItems,
                        });
                        resetSelectedIndices();
                    }
                }}
            />
            <BottomIcon
                icon="arrow-down-tray"
                landscape={landscape}
                title={t("common.download")}
                onPress={() => {
                    if (selectedItems.length) {
                        downloader.download(selectedItems);
                        Toast.success(
                            t("toast.beginDownload"),
                        );
                        resetSelectedIndices();
                    }
                }}
            />
            <BottomIcon
                icon="trash-outline"
                landscape={landscape}
                title={t("common.delete")}
                color={
                    selectedItems.length && musicSheet?.id
                        ? "text"
                        : "textSecondary"
                }
                onPress={() => {
                    if (selectedItems.length && musicSheet?.id) {
                        setEditingMusicList(
                            produce(prev => prev.filter(_ => !_.checked)),
                        );
                        setMusicListChanged(true);
                        Toast.warn(t("toast.rememberToSave"));
                    }
                }}
            />
        </View>
    );
}

interface IBottomIconProps {
    icon: IIconName;
    title: string;
    color?: "text" | "textSecondary";
    onPress: () => void;
    landscape?: boolean;
}
function BottomIcon(props: IBottomIconProps) {
    const { icon, title, onPress, color = "text", landscape = false } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();
    const carLandscape = landscape && displayMetrics.isCarMode;
    return (
        <Pressable
            onPress={onPress}
            style={[
                style.bottomIconWrapper,
                landscape ? style.landscapeIconWrapper : null,
                landscape && !carLandscape
                    ? style.landscapeFixedIconWrapper
                    : null,
                carLandscape ? style.carLandscapeIconWrapper : null,
                displayMetrics.isCarMode
                    ? {
                        minHeight: displayMetrics.minTouchTarget,
                        paddingVertical: displayMetrics.scaleRpx(8),
                    }
                    : null,
                { backgroundColor: colors.appBar },
            ]}>
            <Icon
                name={icon}
                color={colors.appBarText}
                style={color === "textSecondary" ? style.opacity_06 : undefined}
                size={
                    carLandscape
                        ? displayMetrics.iconSizes.light
                        : displayMetrics.isCarMode
                            ? displayMetrics.iconSizes.big
                            : iconSizeConst.big
                }
            />
            <ThemeText
                fontSize="subTitle"
                fontColor={"appBarText"}
                opacity={color === "textSecondary" ? 0.6 : undefined}
                numberOfLines={carLandscape ? 1 : landscape ? 2 : undefined}
                ellipsizeMode={landscape ? "tail" : undefined}
                adjustsFontSizeToFit={landscape}
                minimumFontScale={landscape ? 0.75 : undefined}
                style={[
                    style.bottomIconText,
                    landscape && !carLandscape
                        ? style.landscapeBottomIconText
                        : null,
                    carLandscape ? style.carLandscapeBottomIconText : null,
                ]}>
                {title}
            </ThemeText>
        </Pressable>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: rpx(144),
        flexDirection: "row",
    },
    landscapeWrapper: {
        height: "auto",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
    },

    bottomIconWrapper: {
        flex: 1,
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
    },
    landscapeIconWrapper: {
        flex: 0,
        width: "100%",
        minWidth: 0,
        minHeight: rpx(108),
    },
    landscapeFixedIconWrapper: {
        height: rpx(120),
    },
    carLandscapeIconWrapper: {
        flex: 1,
        height: "auto",
        minHeight: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
    },
    bottomIconText: {
        marginTop: rpx(12),
    },
    landscapeBottomIconText: {
        width: "100%",
        minWidth: 0,
        flexShrink: 1,
        textAlign: "center",
    },
    carLandscapeBottomIconText: {
        flex: 1,
        minWidth: 0,
        marginTop: 0,
        marginLeft: rpx(12),
        textAlign: "left",
    },
    opacity_06: {
        opacity: 0.6,
    },
});
