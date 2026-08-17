import React, { memo, useCallback } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import MusicItem from "@/components/mediaItem/musicItem";
import { produce } from "immer";
import { useAtom, useSetAtom } from "jotai";
import {
    IEditorMusicItem,
    editingMusicListAtom,
    musicListChangedAtom,
} from "../store/atom";
import SortableFlatList from "@/components/base/SortableFlatList";

import CheckBox from "@/components/base/checkbox";
import useColors from "@/hooks/useColors";
import Empty from "@/components/base/empty";
import useOrientation from "@/hooks/useOrientation";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import { FlashList } from "@shopify/flash-list";
import globalStyle from "@/constants/globalStyle";
import { getMediaUniqueKey } from "@/utils/mediaUtils";

const ITEM_HEIGHT = rpx(120);

interface IMusicEditorItemProps {
    index: number;
    editorMusicItem: IEditorMusicItem;
    tableMode?: boolean;
    compactTable?: boolean;
    sortable?: boolean;
}
function _MusicEditorItem(props: IMusicEditorItemProps) {
    const {
        index,
        editorMusicItem,
        tableMode,
        compactTable,
        sortable = true,
    } = props;
    const setEditingMusicList = useSetAtom(editingMusicListAtom);

    const onPress = useCallback(() => {
        setEditingMusicList(
            produce(draft => {
                draft[index].checked = !draft[index].checked;
            }),
        );
    }, [index, setEditingMusicList]);

    return (
        <MusicItem
            musicItem={editorMusicItem.musicItem}
            left={() => (
                <View style={style.checkBox}>
                    <CheckBox checked={editorMusicItem.checked} />
                </View>
            )}
            showMoreIcon={false}
            itemPaddingRight={sortable ? rpx(100) : undefined}
            onItemPress={onPress}
            tableMode={tableMode}
            compactTable={compactTable}
        />
    );
}

const MusicEditorItem = memo(
    _MusicEditorItem,
    (prev, curr) =>
        prev.editorMusicItem === curr.editorMusicItem &&
        prev.index === curr.index &&
        prev.tableMode === curr.tableMode &&
        prev.compactTable === curr.compactTable &&
        prev.sortable === curr.sortable,
);

/** 音乐列表 */
const marginTop = rpx(88) * 2 + (StatusBar.currentHeight ?? 0);
interface IMusicListProps {
    sortable?: boolean;
}

export default function MusicList(props: IMusicListProps) {
    const { sortable = true } = props;
    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);
    const orientation = useOrientation();
    const displayMetrics = useDisplayMetrics();
    const itemHeight = displayMetrics.isCarMode
        ? displayMetrics.listItemHeights.big ?? ITEM_HEIGHT
        : ITEM_HEIGHT;
    const resolvedMarginTop = displayMetrics.isCarMode
        ? displayMetrics.appBarHeight * 2 + (StatusBar.currentHeight ?? 0)
        : marginTop;

    const renderItem = useCallback(
        ({ index, item }: any) => {
            return (
                <MusicEditorItem
                    editorMusicItem={item}
                    index={index!}
                    tableMode={orientation === "horizontal"}
                    compactTable={orientation === "horizontal"}
                    sortable={sortable}
                />
            );
        },
        [orientation, sortable],
    );
    const colors = useColors();

    if (!editingMusicList?.length) {
        return <Empty />;
    }

    return sortable ? (
        <SortableFlatList
            activeBackgroundColor={colors.placeholder}
            marginTop={orientation === "horizontal" ? 0 : resolvedMarginTop}
            data={editingMusicList}
            renderItem={renderItem}
            itemHeight={itemHeight}
            onSortEnd={newData => {
                setEditingMusicList(newData);
                setMusicListChanged(true);
            }}
        />
    ) : (
        <View style={globalStyle.fwflex1}>
            <FlashList
                data={editingMusicList}
                estimatedItemSize={itemHeight}
                keyExtractor={item => getMediaUniqueKey(item.musicItem)}
                renderItem={renderItem}
            />
        </View>
    );
}

const style = StyleSheet.create({
    checkBox: {
        height: "100%",
        justifyContent: "center",
        marginRight: rpx(16),
    },
});
