import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import rpx from '@/utils/rpx';
import ThemeText from '@/components/base/themeText';
import {ImgAsset} from '@/constants/assetsConst';
import FastImage from '@/components/base/fastImage';
import PlayAllBar from '@/components/base/playAllBar';
import useColors from '@/hooks/useColors';

interface IHeaderProps {
    musicSheet: IMusic.IMusicSheetItem | null;
    musicList: IMusic.IMusicItem[] | null;
    canStar?: boolean;
    landscape?: boolean;
}
export default function Header(props: IHeaderProps) {
    const {musicSheet, musicList, canStar, landscape = false} = props;
    const colors = useColors();

    const [maxLines, setMaxLines] = useState<number | undefined>(6);

    const toggleShowMore = () => {
        if (maxLines) {
            setMaxLines(undefined);
        } else {
            setMaxLines(6);
        }
    };

    const metadata = (
        <View style={style.wrapper}>
            <View style={style.content}>
                <FastImage
                    style={style.coverImg}
                    source={musicSheet?.artwork ?? musicSheet?.coverImg}
                    placeholderSource={ImgAsset.albumDefault}
                />
                <View style={style.details}>
                    <ThemeText numberOfLines={3}>{musicSheet?.title}</ThemeText>
                    <ThemeText fontColor="textSecondary" fontSize="description">
                        共
                        {musicSheet?.worksNum ??
                            (musicList ? musicList.length ?? 0 : '-')}
                        首{' '}
                    </ThemeText>
                </View>
            </View>
            {musicSheet?.description ? (
                <Pressable onPress={toggleShowMore}>
                    <View style={style.albumDesc}>
                        <ThemeText
                            fontColor="textSecondary"
                            fontSize="description"
                            numberOfLines={maxLines}>
                            {musicSheet.description}
                        </ThemeText>
                    </View>
                </Pressable>
            ) : null}
        </View>
    );

    return (
        <View
            style={[
                style.container,
                landscape ? style.landscapeContainer : null,
                {backgroundColor: colors.card},
            ]}>
            {landscape ? (
                <ScrollView
                    style={style.metadataScroll}
                    showsVerticalScrollIndicator={false}>
                    {metadata}
                </ScrollView>
            ) : (
                metadata
            )}
            <PlayAllBar
                canStar={canStar}
                musicList={musicList}
                musicSheet={musicSheet}
            />
        </View>
    );
}

const style = StyleSheet.create({
    container: {
        width: '100%',
    },
    landscapeContainer: {
        flex: 1,
        minHeight: 0,
    },
    metadataScroll: {
        flex: 1,
        minHeight: 0,
    },
    wrapper: {
        width: '100%',
        padding: rpx(24),
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    coverImg: {
        width: rpx(210),
        height: rpx(210),
        borderRadius: rpx(24),
    },
    details: {
        flex: 1,
        height: rpx(140),
        paddingHorizontal: rpx(36),
        justifyContent: 'space-between',
    },
    divider: {
        marginVertical: rpx(18),
    },

    albumDesc: {
        width: '100%',
        marginTop: rpx(28),
    },
});
