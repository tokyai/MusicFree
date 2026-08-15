import React from "react";
import { StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import Tag from "@/components/base/tag";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import Share from "react-native-share";
import { B64Asset } from "@/constants/assetsConst";
import IconButton from "@/components/base/iconButton";
import { useCurrentMusic } from "@/core/trackPlayer";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

export default function NavBar() {
    const navigation = useNavigation();
    const musicItem = useCurrentMusic();
    const displayMetrics = useDisplayMetrics();
    const navBarHeight = displayMetrics.isCarMode
        ? displayMetrics.appBarHeight
        : rpx(150);
    // const {showShare} = useShare();

    return (
        <View
            style={[
                styles.container,
                displayMetrics.isCarMode
                    ? { height: navBarHeight }
                    : null,
            ]}>
            <IconButton
                name="arrow-left"
                sizeType={"normal"}
                color="white"
                style={styles.button}
                onPress={() => {
                    navigation.goBack();
                }}
            />
            <View
                style={[
                    styles.headerContent,
                    displayMetrics.isCarMode
                        ? { height: navBarHeight }
                        : null,
                ]}>
                <Text
                    numberOfLines={1}
                    style={[
                        styles.headerTitleText,
                        displayMetrics.isCarMode
                            ? {
                                fontSize: displayMetrics.fontSizes.title,
                            }
                            : null,
                    ]}>
                    {musicItem?.title ?? "--"}
                </Text>
                <View
                    style={[
                        styles.headerDesc,
                        displayMetrics.isCarMode
                            ? {
                                minHeight:
                                    displayMetrics.fontSizes.subTitle * 1.35,
                                paddingHorizontal:
                                    displayMetrics.horizontalPadding,
                            }
                            : null,
                    ]}>
                    <Text
                        style={[
                            styles.headerArtistText,
                            displayMetrics.isCarMode
                                ? {
                                    fontSize:
                                        displayMetrics.fontSizes.subTitle,
                                }
                                : null,
                        ]}
                        numberOfLines={1}>
                        {musicItem?.artist}
                    </Text>
                    {musicItem?.platform ? (
                        <Tag
                            tagName={musicItem.platform}
                            containerStyle={styles.tagBg}
                            style={styles.tagText}
                        />
                    ) : null}
                </View>
            </View>
            <IconButton
                name="share"
                color="white"
                sizeType="normal"
                style={styles.button}
                onPress={async () => {
                    try {
                        await Share.open({
                            type: "image/jpeg",
                            title: "MusicFree-一个插件化的免费音乐播放器",
                            message: "MusicFree-一个插件化的免费音乐播放器",
                            url: B64Asset.share,
                            subject: "MusicFree分享",
                        });
                    } catch {}
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        height: rpx(150),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    button: {
        marginHorizontal: rpx(24),
    },
    headerContent: {
        flex: 1,
        height: rpx(150),
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitleText: {
        color: "white",
        fontWeight: fontWeightConst.semibold,
        fontSize: fontSizeConst.title,
        marginBottom: rpx(12),
        includeFontPadding: false,
    },
    headerDesc: {
        height: rpx(32),
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(40),
    },
    headerArtistText: {
        color: "white",
        fontSize: fontSizeConst.subTitle,
        includeFontPadding: false,
    },
    tagBg: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    tagText: {
        color: "white",
    },
});
