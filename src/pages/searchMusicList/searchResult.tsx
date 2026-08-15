import React from "react";
import MusicItem from "@/components/mediaItem/musicItem";
import Empty from "@/components/base/empty";
import { FlashList } from "@shopify/flash-list";
import rpx from "@/utils/rpx.ts";
import useOrientation from "@/hooks/useOrientation";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

interface ISearchResultProps {
    result: IMusic.IMusicItem[];
    musicSheet?: IMusic.IMusicSheetItem;
}

const ITEM_HEIGHT = rpx(120);

export default function SearchResult(props: ISearchResultProps) {
    const { result, musicSheet } = props;
    const orientation = useOrientation();
    const displayMetrics = useDisplayMetrics();
    const itemHeight = displayMetrics.isCarMode
        ? displayMetrics.listItemHeights.big ?? ITEM_HEIGHT
        : ITEM_HEIGHT;
    return (
        <FlashList
            estimatedItemSize={itemHeight}
            ListEmptyComponent={<Empty />}
            data={result}
            renderItem={({ item }) => (
                <MusicItem
                    musicItem={item}
                    musicSheet={musicSheet}
                    tableMode={orientation === "horizontal"}
                />
            )}
        />
    );
}
