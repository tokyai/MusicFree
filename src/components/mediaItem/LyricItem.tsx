import React from "react";
import ListItem from "@/components/base/listItem";
import { ImgAsset } from "@/constants/assetsConst";
import TitleAndTag from "./titleAndTag";
import { ActivityIndicator } from "react-native";

interface IAlbumResultsProps {
    lyricItem: ILyric.ILyricItem;
    onPress?: (musicItem: ILyric.ILyricItem) => void;
    sourceName?: string;
    disabled?: boolean;
    loading?: boolean;
}
export default function LyricItem(props: IAlbumResultsProps) {
    const { lyricItem, onPress, sourceName, disabled, loading } = props;

    return (
        <ListItem
            heightType="big"
            withHorizontalPadding
            onPress={disabled ? undefined : () => onPress?.(lyricItem)}>
            <ListItem.ListItemImage
                uri={lyricItem.artwork}
                fallbackImg={ImgAsset.albumDefault}
            />
            <ListItem.Content
                description={`${lyricItem.artist ?? ""}${
                    lyricItem.album ? ` - ${lyricItem.album}` : ""
                }`}
                title={
                    <TitleAndTag
                        title={lyricItem.title}
                        tag={sourceName ?? lyricItem.platform}
                    />
                }
            />
            {loading ? <ActivityIndicator /> : null}
        </ListItem>
    );
}
