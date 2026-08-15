import FastImage from '@/components/base/fastImage';
import PlayAllBar from '@/components/base/playAllBar';
import ThemeText from '@/components/base/themeText';
import {ImgAsset} from '@/constants/assetsConst';
import {useI18N} from '@/core/i18n';
import {useSheetItem} from '@/core/musicSheet';
import {useParams} from '@/core/router';
import useColors from '@/hooks/useColors';
import rpx from '@/utils/rpx';
import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';

interface IHeaderProps {
    landscape?: boolean;
}

export default function Header(props: IHeaderProps) {
    const {landscape = false} = props;
    const {id = 'favorite'} = useParams<'local-sheet-detail'>();
    const sheet = useSheetItem(id);
    const colors = useColors();
    const {t} = useI18N();

    const metadata = (
        <View style={style.content}>
            <FastImage
                style={style.coverImg}
                source={sheet?.coverImg}
                placeholderSource={ImgAsset.albumDefault}
            />
            <View style={style.details}>
                <ThemeText fontSize="title" numberOfLines={3}>
                    {sheet?.title}
                </ThemeText>
                <ThemeText fontColor="textSecondary" fontSize="subTitle">
                    {t('sheetDetail.totalMusicCount', {
                        count: sheet?.musicList?.length ?? 0,
                    })}
                </ThemeText>
            </View>
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
                    contentContainerStyle={style.landscapeMetadataContent}
                    showsVerticalScrollIndicator={false}>
                    {metadata}
                </ScrollView>
            ) : (
                metadata
            )}
            <PlayAllBar musicList={sheet?.musicList} musicSheet={sheet} />
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
    landscapeMetadataContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    content: {
        width: '100%',
        height: rpx(300),
        paddingHorizontal: rpx(24),
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
        paddingHorizontal: rpx(36),
        flex: 1,
        height: rpx(140),
        justifyContent: 'space-between',
        gap: rpx(14),
    },
});
