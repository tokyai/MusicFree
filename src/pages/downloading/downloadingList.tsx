import React from "react";
import { StyleSheet, View } from "react-native";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { sizeFormatter } from "@/utils/fileUtils";
import { DownloadFailReason, DownloadStatus, useDownloadQueue, useDownloadTask } from "@/core/downloader";
import { FlashList } from "@shopify/flash-list";
import { useI18N } from "@/core/i18n";
import useOrientation from "@/hooks/useOrientation";
import rpx from "@/utils/rpx";


interface DownloadingListItemProps {
    musicItem: IMusic.IMusicItem;
    index?: number;
    tableMode?: boolean;
}
function DownloadingListItem(props: DownloadingListItemProps) {
    const { musicItem, index, tableMode = false } = props;
    const taskInfo = useDownloadTask(musicItem);
    const { t } = useI18N();

    const status = taskInfo?.status ?? DownloadStatus.Error;

    let description = "";

    if (status === DownloadStatus.Error) {
        const reason = taskInfo?.errorReason;

        if (reason === DownloadFailReason.NoWritePermission) {
            description = t("downloading.downloadFailReason.noWritePermission");
        } else if (reason === DownloadFailReason.FailToFetchSource) {
            description = t("downloading.downloadFailReason.failToFetchSource");
        } else {
            description = t("downloading.downloadFailReason.unknown");
        }
    } else if (status === DownloadStatus.Completed) {
        description = t("downloading.downloadStatus.completed");
    } else if (status === DownloadStatus.Downloading) {
        const progress = taskInfo?.downloadedSize ? sizeFormatter(taskInfo.downloadedSize) : "-";
        const totalSize = taskInfo?.fileSize ? sizeFormatter(taskInfo.fileSize) : "-";

        description = t("downloading.downloadStatus.downloadProgress", {
            progress,
            totalSize,
        });
    } else if (status === DownloadStatus.Pending) {
        description = t("downloading.downloadStatus.pending");
    } else if (status === DownloadStatus.Preparing) {
        description = t("downloading.downloadStatus.preparing");
    }

    if (tableMode) {
        return (
            <ListItem withHorizontalPadding heightType="big">
                <ListItem.ListItemText
                    width={rpx(64)}
                    fixedWidth
                    position="none"
                    contentStyle={style.index}>
                    {index}
                </ListItem.ListItemText>
                <ListItem.Content
                    title={musicItem.title}
                    containerStyle={style.title}
                />
                <ThemeText
                    numberOfLines={1}
                    fontSize="description"
                    fontColor="textSecondary"
                    style={style.cell}>
                    {musicItem.artist || ""}
                </ThemeText>
                <ThemeText
                    numberOfLines={1}
                    fontSize="description"
                    fontColor="textSecondary"
                    style={style.cell}>
                    {musicItem.album || ""}
                </ThemeText>
                <ThemeText
                    numberOfLines={1}
                    fontSize="description"
                    fontColor="textSecondary"
                    style={style.source}>
                    {musicItem.platform || ""}
                </ThemeText>
                <ThemeText
                    numberOfLines={1}
                    fontSize="description"
                    style={style.status}>
                    {description}
                </ThemeText>
            </ListItem>
        );
    }

    return (
        <ListItem withHorizontalPadding>
            <ListItem.Content title={musicItem.title} description={description} />
        </ListItem>
    );

}

export default function DownloadingList() {
    const downloadQueue = useDownloadQueue();
    const orientation = useOrientation();


    return (
        <View style={style.wrapper}>
            <FlashList
                style={style.downloading}
                data={downloadQueue}
                keyExtractor={_ => `dl${_.platform}.${_.id}`}
                renderItem={({ item, index }) => {
                    return (
                        <DownloadingListItem
                            musicItem={item}
                            index={index + 1}
                            tableMode={orientation === "horizontal"}
                        />
                    );
                }}
            />
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    downloading: {
        flexGrow: 0,
    },
    index: {
        textAlign: "center",
        fontStyle: "italic",
    },
    title: {
        flex: 3,
        minWidth: rpx(180),
        marginRight: rpx(12),
    },
    cell: {
        flex: 2,
        minWidth: rpx(108),
        marginRight: rpx(12),
    },
    source: {
        width: rpx(108),
        marginRight: rpx(12),
    },
    status: {
        flex: 2,
        minWidth: rpx(140),
    },
});
