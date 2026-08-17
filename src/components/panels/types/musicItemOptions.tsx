import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import Clipboard from "@react-native-clipboard/clipboard";

import { getMediaUniqueKey } from "@/utils/mediaUtils";
import FastImage from "@/components/base/fastImage";
import Toast from "@/utils/toast";
import LocalMusicSheet from "@/core/localMusicSheet";
import { localMusicSheetId, musicHistorySheetId } from "@/constants/commonConst";
import { ROUTE_PATH, useNavigate } from "@/core/router";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import PanelBase from "../base/panelBase";
import { FlatList } from "react-native-gesture-handler";
import musicHistory from "@/core/musicHistory";
import { showDialog } from "@/components/dialogs/useDialog";
import { hidePanel, showPanel } from "../usePanel";
import Divider from "@/components/base/divider";
import { iconSizeConst } from "@/constants/uiConst";
import Config from "@/core/appConfig";
import TrackPlayer from "@/core/trackPlayer";
import mediaCache from "@/core/mediaCache";
import { IIconName } from "@/components/base/icon.tsx";
import MusicSheet from "@/core/musicSheet";
import downloader from "@/core/downloader";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import lyricManager from "@/core/lyricManager";
import { useI18N } from "@/core/i18n";
import pluginManager from "@/core/pluginManager";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import { nanoid } from "nanoid";

interface IMusicItemOptionsProps {
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
    /** 歌曲所在歌单 */
    musicSheet?: IMusic.IMusicSheetItem;
    /** 来源 */
    from?: string;
}

const ITEM_HEIGHT = rpx(96);

interface IOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
    show?: boolean;
}

export default function MusicItemOptions(props: IMusicItemOptionsProps) {
    const { musicItem, musicSheet, from } = props ?? {};
    const { t } = useI18N();
    const navigate = useNavigate();
    const artist = musicItem?.artist?.toString().trim();
    const album = musicItem?.album?.toString().trim();

    const safeAreaInsets = useSafeAreaInsets();
    const displayMetrics = useDisplayMetrics();
    const itemHeight = displayMetrics.isCarMode
        ? displayMetrics.listItemHeights.small ?? ITEM_HEIGHT
        : ITEM_HEIGHT;

    const downloaded = LocalMusicSheet.isLocalMusic(musicItem);
    const associatedLrc = getMediaExtraProperty(musicItem, "associatedLrc");

    const options: IOption[] = [
        {
            icon: "identification",
            title: `ID: ${getMediaUniqueKey(musicItem)}`,
            onPress: () => {
                mediaCache.setMediaCache(musicItem);
                Clipboard.setString(
                    JSON.stringify(
                        {
                            platform: musicItem.platform,
                            id: musicItem.id,
                        },
                        null,
                        "",
                    ),
                );
                Toast.success(t("toast.copiedToClipboard"));
            },
        },
        {
            icon: "user",
            show: !!artist,
            title: t("panel.musicItemOptions.author", { artist }),
            onPress: () => {
                if (!artist) {
                    return;
                }
                hidePanel();
                navigate(ROUTE_PATH.SEARCH_PAGE, {
                    initialQuery: artist,
                    searchRequestId: nanoid(),
                }, { push: true });
            },
        },
        {
            icon: "album-outline",
            show: !!album,
            title: t("panel.musicItemOptions.album", { album }),
            onPress: () => {
                if (!album) {
                    return;
                }
                hidePanel();
                navigate(ROUTE_PATH.SEARCH_PAGE, {
                    initialQuery: album,
                    searchRequestId: nanoid(),
                }, { push: true });
            },
        },
        {
            icon: "motion-play",
            title: t("musicListEditor.addToNextPlay"),
            onPress: () => {
                TrackPlayer.addNext(musicItem);
                hidePanel();
            },
        },
        {
            icon: "folder-plus",
            title: t("musicListEditor.addToSheet"),
            onPress: () => {
                showPanel("AddToMusicSheet", { musicItem });
            },
        },
        {
            icon: "arrow-down-tray",
            title: t("common.download"),
            show: !downloaded,
            onPress: async () => {
                showPanel("MusicQuality", {
                    musicItem,
                    type: "download",
                    async onQualityPress(quality) {
                        downloader.download(musicItem, quality);
                    },
                });
            },
        },
        {
            icon: "check-circle-outline",
            title: t("panel.musicItemOptions.downloaded"),
            show: !!downloaded,
        },
        {
            icon: "trash-outline",
            title: t("common.delete"),
            show: !!musicSheet,
            onPress: async () => {
                if (musicSheet?.id === localMusicSheetId) {
                    await LocalMusicSheet.removeMusic(musicItem);
                } else if (musicSheet?.id === musicHistorySheetId) {
                    await musicHistory.removeMusic(musicItem);
                } else {
                    await MusicSheet.removeMusic(musicSheet!.id, musicItem);
                }
                Toast.success(t("toast.deleteSuccess"));
                hidePanel();
            },
        },
        {
            icon: "trash-outline",
            title: t("panel.musicItemOptions.deleteLocalDownload"),
            show: !!downloaded,
            onPress: () => {
                showDialog("SimpleDialog", {
                    title: t("panel.musicItemOptions.deleteLocalDownload"),
                    content: t("panel.musicItemOptions.deleteLocalDownloadConfirm"),
                    async onOk() {
                        try {
                            await LocalMusicSheet.removeMusic(musicItem, true);
                            Toast.success(t("toast.deleteSuccess"));
                        } catch (e: any) {
                            Toast.warn(`${t("panel.musicItemOptions.deleteFailed")} ${e?.message ?? e}`);
                        }
                    },
                });
                hidePanel();
            },
        },
        {
            icon: "chat-bubble-oval-left-ellipsis",
            title: t("panel.musicItemOptions.readComment"),
            show: !!pluginManager.getByMedia(musicItem)?.supportedMethods.has("getMusicComments"),
            onPress: () => {
                if (!musicItem) {
                    return;
                }
                showPanel("MusicComment", {
                    musicItem: musicItem,
                });
            },
        },
        {
            icon: "link",
            title: associatedLrc
                ? t("panel.musicItemOptions.associatedLyric", { platform: associatedLrc.platform, id: associatedLrc.id })
                : t("panel.musicItemOptions.associateLyric"),
            onPress: async () => {
                if (
                    Config.getConfig("basic.associateLyricType") === "input"
                ) {
                    showPanel("AssociateLrc", {
                        musicItem,
                    });
                } else {
                    showPanel("SearchLrc", {
                        musicItem,
                    });
                }
            },
        },
        {
            icon: "link-slash",
            title: t("panel.musicItemOptions.unassociateLyric"),
            show: !!associatedLrc,
            onPress: async () => {
                lyricManager.unassociateLyric(musicItem);
                Toast.success(t("panel.musicItemOptions.unassociateLyricSuccess"));
                hidePanel();
            },
        },
        {
            icon: "alarm-outline",
            title: t("panel.musicItemOptions.timingClose"),
            show: from === ROUTE_PATH.MUSIC_DETAIL,
            onPress: () => {
                showPanel("TimingClose");
            },
        },
        {
            icon: "archive-box-x-mark",
            title: t("panel.musicItemOptions.clearPluginCache"),
            onPress: () => {
                mediaCache.removeMediaCache(musicItem);
                Toast.success(t("panel.musicItemOptions.cacheCleared"));
            },
        },
    ];

    return (
        <PanelBase
            renderBody={() => (
                <>
                    <View style={style.header}>
                        <FastImage
                            style={style.artwork}
                            source={musicItem?.artwork}
                            placeholderSource={ImgAsset.albumDefault}
                        />
                        <View style={style.content}>
                            <ThemeText numberOfLines={2} style={style.title}>
                                {musicItem?.title}
                            </ThemeText>
                            <ThemeText
                                fontColor="textSecondary"
                                numberOfLines={2}
                                fontSize="description">
                                {musicItem?.artist}{" "}
                                {musicItem?.album ? `- ${musicItem.album}` : ""}
                            </ThemeText>
                        </View>
                    </View>
                    <Divider />
                    <View style={style.wrapper}>
                        <FlatList
                            data={options}
                            getItemLayout={(_, index) => ({
                                length: itemHeight,
                                offset: itemHeight * index,
                                index,
                            })}
                            ListFooterComponent={<View style={style.footer} />}
                            style={[
                                style.listWrapper,
                                {
                                    marginBottom: safeAreaInsets.bottom,
                                },
                            ]}
                            keyExtractor={_ => _.title}
                            renderItem={({ item }) =>
                                item.show !== false ? (
                                    <ListItem
                                        withHorizontalPadding
                                        heightType="small"
                                        onPress={item.onPress}>
                                        <ListItem.ListItemIcon
                                            width={rpx(48)}
                                            icon={item.icon}
                                            iconSize={iconSizeConst.light}
                                        />
                                        <ListItem.Content title={item.title} />
                                    </ListItem>
                                ) : null
                            }
                        />
                    </View>
                </>
            )}
        />
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    header: {
        width: "100%",
        height: rpx(200),
        flexDirection: "row",
        padding: rpx(24),
    },
    listWrapper: {
        paddingTop: rpx(12),
    },
    artwork: {
        width: rpx(140),
        height: rpx(140),
        borderRadius: rpx(16),
    },
    content: {
        marginLeft: rpx(36),
        flex: 1,
        minWidth: 0,
        height: rpx(140),
        justifyContent: "space-around",
    },
    title: {
        paddingRight: rpx(24),
    },
    footer: {
        width: "100%",
        height: rpx(30),
    },
});
