import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import Tag from "@/components/base/tag";
import ThemeText from "@/components/base/themeText";
import { fontSizeConst } from "@/constants/uiConst";
import { isSameMediaItem } from "@/utils/mediaUtils";
import IconButton from "@/components/base/iconButton";
import Loading from "@/components/base/loading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useColors from "@/hooks/useColors";
import TrackPlayer, { useCurrentMusic, usePlayList } from "@/core/trackPlayer";
import { FlashList } from "@shopify/flash-list";
import Icon from "@/components/base/icon.tsx";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

const ITEM_HEIGHT = rpx(108);

interface IPlayListProps {
    item: IMusic.IMusicItem;
    isCurrentMusic: boolean;
}

function _PlayListItem(props: IPlayListProps) {
    const colors = useColors();
    const { item, isCurrentMusic } = props;
    const displayMetrics = useDisplayMetrics();
    const itemHeight = displayMetrics.isCarMode
        ? Math.max(ITEM_HEIGHT, displayMetrics.minTouchTarget)
        : ITEM_HEIGHT;

    return (
        <Pressable
            onPress={() => {
                TrackPlayer.play(item);
            }}
            style={[
                style.musicItem,
                displayMetrics.isCarMode
                    ? {
                        height: itemHeight,
                        minHeight: displayMetrics.minTouchTarget,
                        paddingHorizontal: displayMetrics.horizontalPadding,
                    }
                    : null,
            ]}>
            {isCurrentMusic && (
                <Icon
                    name="musical-note"
                    color={colors.textHighlight ?? colors.primary}
                    size={
                        displayMetrics.isCarMode
                            ? displayMetrics.iconSizes.normal
                            : fontSizeConst.content
                    }
                    style={style.currentPlaying}
                />
            )}
            <ThemeText
                style={[
                    style.musicItemTitle,
                    {
                        color: isCurrentMusic
                            ? colors.textHighlight ?? colors.primary
                            : colors.text,
                    },
                ]}
                ellipsizeMode="tail"
                numberOfLines={1}>
                {item.title}
                {item.artist && (
                    <Text
                        style={
                            displayMetrics.isCarMode
                                ? {
                                    fontSize:
                                        displayMetrics.fontSizes.description,
                                }
                                : { fontSize: fontSizeConst.description }
                        }>
                        {" "}
                        - {item.artist}
                    </Text>
                )}
            </ThemeText>
            <Tag tagName={item.platform} />
            <IconButton
                style={{ marginLeft: rpx(14) }}
                name="x-mark"
                sizeType="small"
                onPress={() => {
                    TrackPlayer.remove(item);
                }}
            />
        </Pressable>
    );
}

const PlayListItem = React.memo(
    _PlayListItem,
    (prev, next) =>
        !!isSameMediaItem(prev.item, next.item) &&
        prev.isCurrentMusic === next.isCurrentMusic,
);

interface IBodyProps {
    loading?: boolean;
}
export default function Body(props: IBodyProps) {
    const { loading } = props;
    const playList = usePlayList();
    const currentMusicItem = useCurrentMusic();
    const listRef = useRef<FlashList<IMusic.IMusicItem> | null>();
    const safeAreaInsets = useSafeAreaInsets();
    const displayMetrics = useDisplayMetrics();
    const itemHeight = displayMetrics.isCarMode
        ? Math.max(ITEM_HEIGHT, displayMetrics.minTouchTarget)
        : ITEM_HEIGHT;

    const initIndex = useMemo(() => {
        const id = playList.findIndex(_ =>
            isSameMediaItem(currentMusicItem, _),
        );

        if (id !== -1) {
            return id;
        }
        return undefined;
    }, []);

    const renderItem = ({ item }: { item: IMusic.IMusicItem; index: number }) => {
        return (
            <PlayListItem
                item={item}
                isCurrentMusic={!!isSameMediaItem(item, currentMusicItem)}
            />
        );
    };

    return loading ? (
        <Loading />
    ) : (
        <View
            style={[
                style.playList,
                {
                    paddingBottom: safeAreaInsets.bottom,
                },
            ]}>
            <FlashList
                ref={_ => {
                    listRef.current = _;
                }}
                extraData={{ currentMusicItem }}
                estimatedItemSize={itemHeight}
                data={playList}
                initialScrollIndex={initIndex}
                renderItem={renderItem}
            />
        </View>
    );
}

const style = StyleSheet.create({
    playList: {
        width: "100%",
        flex: 1,
    },
    currentPlaying: {
        marginRight: rpx(6),
    },
    musicItem: {
        width: "100%",
        minWidth: 0,
        height: ITEM_HEIGHT,
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
    },
    musicItemTitle: {
        flex: 1,
    },
});
