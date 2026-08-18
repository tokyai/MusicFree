import ListEmpty from "@/components/base/listEmpty";
import LyricItem from "@/components/mediaItem/LyricItem";
import { RequestStateCode } from "@/constants/commonConst";
import type { ILyricSearchCandidate } from "@/core/lyricSearch";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import rpx from "@/utils/rpx";
import { FlashList } from "@shopify/flash-list";
import React from "react";

interface ILyricListProps {
    data: ILyricSearchCandidate[];
    state: RequestStateCode;
    applyingKey?: string | null;
    onPress: (candidate: ILyricSearchCandidate) => void;
}

const ITEM_HEIGHT = rpx(120);

export default function LyricList(props: ILyricListProps) {
    const displayMetrics = useDisplayMetrics();
    const itemHeight = displayMetrics.isCarMode
        ? Math.max(
            ITEM_HEIGHT,
            displayMetrics.listItemHeights.big ?? ITEM_HEIGHT,
        )
        : ITEM_HEIGHT;

    return (
        <FlashList
            data={props.data}
            estimatedItemSize={itemHeight}
            keyExtractor={item =>
                `${item.pluginHash}@${item.musicItem.platform}@${item.musicItem.id}`
            }
            renderItem={({ item }) => {
                const itemKey = `${item.pluginHash}@${item.musicItem.platform}@${item.musicItem.id}`;
                return (
                    <LyricItem
                        lyricItem={item.musicItem}
                        sourceName={item.pluginName}
                        disabled={!!props.applyingKey}
                        loading={props.applyingKey === itemKey}
                        onPress={() => props.onPress(item)}
                    />
                );
            }}
            ListEmptyComponent={<ListEmpty state={props.state} />}
        />
    );
}
