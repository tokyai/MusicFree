import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import ListItem from "../base/listItem";

import LocalMusicSheet from "@/core/localMusicSheet";
import { showPanel } from "../panels/usePanel";
import TitleAndTag from "./titleAndTag";
import ThemeText from "../base/themeText";
import TrackPlayer from "@/core/trackPlayer";
import Icon from "@/components/base/icon.tsx";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import { ImgAsset } from "@/constants/assetsConst";

interface IMusicItemProps {
    index?: string | number;
    showMoreIcon?: boolean;
    musicItem: IMusic.IMusicItem;
    musicSheet?: IMusic.IMusicSheetItem;
    onItemPress?: (musicItem: IMusic.IMusicItem) => void;
    onItemLongPress?: () => void;
    itemPaddingRight?: number;
    left?: () => JSX.Element;
    containerStyle?: StyleProp<ViewStyle>;
    highlight?: boolean;
    /** 横屏列表的表格式行展示 */
    tableMode?: boolean;
    /** 在较窄的横屏窗格中隐藏次要列 */
    compactTable?: boolean;
    /** 展示歌曲封面 */
    showArtwork?: boolean;
}
export default function MusicItem(props: IMusicItemProps) {
    const {
        musicItem,
        index,
        onItemPress,
        onItemLongPress,
        musicSheet,
        itemPaddingRight,
        showMoreIcon = true,
        left: Left,
        containerStyle,
        highlight = false,
        tableMode = false,
        compactTable = false,
        showArtwork = false,
    } = props;
    const displayMetrics = useDisplayMetrics();
    const checkIconSize = displayMetrics.isCarMode
        ? displayMetrics.iconSizes.small
        : rpx(22);

    const handlePress = () => {
        if (onItemPress) {
            onItemPress(musicItem);
        } else {
            TrackPlayer.play(musicItem);
        }
    };

    const handleMorePress = () => {
        showPanel("MusicItemOptions", {
            musicItem,
            musicSheet,
        });
    };

    const artwork = showArtwork ? (
        <ListItem.ListItemImage
            uri={musicItem.artwork}
            fallbackImg={ImgAsset.albumDefault}
            imageSize={compactTable ? rpx(64) : rpx(72)}
            containerStyle={compactTable ? styles.compactArtwork : undefined}
            contentStyle={
                displayMetrics.isCarMode
                    ? undefined
                    : compactTable
                        ? styles.compactArtworkImage
                        : styles.artworkImage
            }
        />
    ) : null;

    if (tableMode) {
        return (
            <ListItem
                heightType="big"
                style={[styles.tableItem, containerStyle]}
                withHorizontalPadding
                leftPadding={index !== undefined ? 0 : undefined}
                onLongPress={onItemLongPress}
                onPress={handlePress}>
                {Left ? <Left /> : null}
                {index !== undefined ? (
                    <ListItem.ListItemText
                        width={rpx(64)}
                        position="none"
                        fixedWidth
                        fontColor={highlight ? "primary" : "text"}
                        contentStyle={styles.indexText}>
                        {index}
                    </ListItem.ListItemText>
                ) : null}
                {artwork}
                <ListItem.Content
                    containerStyle={[
                        styles.tableTitle,
                        compactTable ? styles.compactTableTitle : null,
                    ]}
                    title={
                        <TitleAndTag
                            title={musicItem.title}
                            titleFontColor={highlight ? "primary" : "text"}
                        />
                    }
                />
                <View
                    style={[
                        styles.tableCell,
                        compactTable ? styles.compactTableCell : null,
                    ]}>
                    {LocalMusicSheet.isLocalMusic(musicItem) && (
                        <Icon
                            style={styles.icon}
                            color="#11659a"
                            name="check-circle"
                            size={checkIconSize}
                        />
                    )}
                    <ThemeText
                        numberOfLines={1}
                        fontSize="description"
                        fontColor={highlight ? "primary" : "textSecondary"}>
                        {musicItem.artist || ""}
                    </ThemeText>
                </View>
                {!compactTable ? (
                    <ThemeText
                        numberOfLines={1}
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.tableCell}>
                        {musicItem.album || ""}
                    </ThemeText>
                ) : null}
                <ThemeText
                    numberOfLines={1}
                    fontSize="description"
                    fontColor="textSecondary"
                    style={[
                        styles.tableSource,
                        compactTable && showArtwork
                            ? styles.artworkCompactSource
                            : null,
                    ]}>
                    {musicItem.platform || ""}
                </ThemeText>
                {showMoreIcon ? (
                    <ListItem.ListItemIcon
                        width={rpx(48)}
                        fixedWidth
                        position="none"
                        icon="ellipsis-vertical"
                        onPress={handleMorePress}
                    />
                ) : null}
            </ListItem>
        );
    }

    return (
        <ListItem
            heightType="big"
            style={containerStyle}
            withHorizontalPadding
            leftPadding={index !== undefined ? 0 : undefined}
            rightPadding={itemPaddingRight}
            onLongPress={onItemLongPress}
            onPress={handlePress}>
            {Left ? <Left /> : null}
            {index !== undefined ? (
                <ListItem.ListItemText
                    width={rpx(82)}
                    position="none"
                    fixedWidth
                    fontColor={highlight ? "primary" : "text"}
                    contentStyle={styles.indexText}>
                    {index}
                </ListItem.ListItemText>
            ) : null}
            {artwork}
            <ListItem.Content
                title={
                    <TitleAndTag
                        title={musicItem.title}
                        titleFontColor={highlight ? "primary": "text"}
                        tag={musicItem.platform}
                    />
                }
                description={
                    <View style={styles.descContainer}>
                        {LocalMusicSheet.isLocalMusic(musicItem) && (
                            <Icon
                                style={styles.icon}
                                color="#11659a"
                                name="check-circle"
                                size={checkIconSize}
                            />
                        )}
                        <ThemeText
                            numberOfLines={1}
                            fontSize="description"
                            fontColor={highlight ? "primary" : "textSecondary"}>
                            {musicItem.artist}
                            {musicItem.album ? ` - ${musicItem.album}` : ""}
                        </ThemeText>
                    </View>
                }
            />
            {showMoreIcon ? (
                <ListItem.ListItemIcon
                    width={rpx(48)}
                    position="none"
                    icon="ellipsis-vertical"
                    onPress={() => {
                        handleMorePress();
                    }}
                />
            ) : null}
        </ListItem>
    );
}

const styles = StyleSheet.create({
    icon: {
        marginRight: rpx(6),
    },
    descContainer: {
        flexDirection: "row",
        marginTop: rpx(16),
    },

    tableItem: {
        minWidth: 0,
    },
    tableTitle: {
        flex: 3,
        minWidth: rpx(180),
        marginRight: rpx(12),
    },
    compactTableTitle: {
        flex: 2,
        minWidth: rpx(140),
    },
    tableCell: {
        flex: 2,
        minWidth: rpx(108),
        marginRight: rpx(12),
        justifyContent: "center",
    },
    compactTableCell: {
        flex: 1,
        minWidth: rpx(84),
    },
    compactArtwork: {
        marginRight: rpx(12),
    },
    artworkImage: {
        width: rpx(72),
        height: rpx(72),
        borderRadius: rpx(14.4),
    },
    compactArtworkImage: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(12.8),
    },
    tableSource: {
        width: rpx(108),
        flexShrink: 1,
        marginRight: rpx(8),
    },
    artworkCompactSource: {
        width: rpx(80),
    },

    indexText: {
        fontStyle: "italic",
        textAlign: "center",
        padding: rpx(2),
    },
});
