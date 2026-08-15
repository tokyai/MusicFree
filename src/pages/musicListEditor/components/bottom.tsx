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
    return (
        <Pressable
            onPress={onPress}
            style={[
                style.bottomIconWrapper,
                landscape ? style.landscapeIconWrapper : null,
                { backgroundColor: colors.appBar },
            ]}>
            <Icon
                name={icon}
                color={colors.appBarText}
                style={color === "textSecondary" ? style.opacity_06 : undefined}
                size={iconSizeConst.big}
                onPress={onPress}
            />
            <ThemeText
                fontSize="subTitle"
                fontColor={"appBarText"}
                opacity={color === "textSecondary" ? 0.6 : undefined}
                style={style.bottomIconText}>
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
        minHeight: rpx(108),
        height: rpx(120),
    },
    bottomIconText: {
        marginTop: rpx(12),
    },
    opacity_06: {
        opacity: 0.6,
    },
});
