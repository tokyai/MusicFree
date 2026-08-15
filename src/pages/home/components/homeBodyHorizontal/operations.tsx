import {useI18N} from '@/core/i18n';
import {ROUTE_PATH, useNavigate} from '@/core/router';
import rpx from '@/utils/rpx';
import React from 'react';
import {StyleSheet} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import ActionButton from '../ActionButton';

export default function Operations() {
    const navigate = useNavigate();
    const {t} = useI18N();

    const actionButtons = [
        {
            iconName: 'fire',
            title: t('home.recommendSheet'),
            action() {
                navigate(ROUTE_PATH.RECOMMEND_SHEETS);
            },
        },
        {
            iconName: 'trophy',
            title: t('home.topList'),
            action() {
                navigate(ROUTE_PATH.TOP_LIST);
            },
        },
        {
            iconName: 'clock-outline',
            title: t('home.playHistory'),
            action() {
                navigate(ROUTE_PATH.HISTORY);
            },
        },
        {
            iconName: 'folder-music-outline',
            title: t('home.localMusic'),
            action() {
                navigate(ROUTE_PATH.LOCAL);
            },
        },
    ] as const;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {actionButtons.map(action => (
                <ActionButton
                    style={styles.actionButtonStyle}
                    key={action.title}
                    {...action}
                />
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        flex: 1,
    },
    content: {
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(24),
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: rpx(16),
    },
    actionButtonStyle: {
        width: '46%',
        height: rpx(160),
        borderRadius: rpx(18),
        flexGrow: 0,
    },
});
