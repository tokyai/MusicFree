import Image from "@/components/base/image";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";
import ThemeText from "@/components/base/themeText";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import Theme from "@/core/theme";
import useOrientation from "@/hooks/useOrientation";
import rpx from "@/utils/rpx";
import Slider from "@react-native-community/slider";
import Color from "color";
import React from "react";
import { StyleSheet, View } from "react-native";
import { ScrollView, TouchableOpacity } from "react-native-gesture-handler";

export default function Body() {
    const theme = Theme.useTheme();
    const backgroundInfo = Theme.useBackground();
    const { t } = useI18N();
    const orientation = useOrientation();

    const preview = (
        <View>
            <Image
                style={styles.image}
                uri={backgroundInfo?.url}
                emptySrc={ImgAsset.addBackground}
            />
        </View>
    );

    const controls = (
        <>
            <View style={styles.sliderWrapper}>
                <ThemeText>{t("setCustomTheme.blur")}</ThemeText>
                <Slider
                    style={styles.slider}
                    minimumTrackTintColor={theme.colors.primary}
                    maximumTrackTintColor={theme.colors.text ?? "#999999"}
                    thumbTintColor={theme.colors.primary}
                    minimumValue={0}
                    step={1}
                    maximumValue={30}
                    onSlidingComplete={val => {
                        Theme.setBackground({
                            blur: val,
                        });
                    }}
                    value={backgroundInfo?.blur ?? 20}
                />
            </View>
            <View style={styles.sliderWrapper}>
                <ThemeText>{t("setCustomTheme.opacity")}</ThemeText>
                <Slider
                    style={styles.slider}
                    minimumTrackTintColor={theme.colors.primary}
                    maximumTrackTintColor={theme.colors.text ?? "#999999"}
                    thumbTintColor={theme.colors.primary}
                    minimumValue={0.3}
                    step={0.01}
                    maximumValue={1}
                    onSlidingComplete={val => {
                        Theme.setBackground({
                            opacity: val,
                        });
                    }}
                    value={backgroundInfo?.opacity ?? 0.7}
                />
            </View>
            <View style={styles.colorsContainer}>
                {Theme.configableColorKey.map(key => (
                    <View key={key} style={styles.colorItem}>
                        <ThemeText>{t("setCustomTheme." + key + "Color" as any)}</ThemeText>
                        <TouchableOpacity
                            onPress={() => {
                                showPanel("ColorPicker", {
                                    // @ts-ignore
                                    defaultColor: theme.colors[key],
                                    onSelected(color) {
                                        Theme.setColors({
                                            [key]: color.hexa().toString(),
                                        });
                                    },
                                });
                            }}
                            style={styles.colorItemBlockContainer}>
                            <View style={[styles.colorBlockContainer]}>
                                <Image
                                    resizeMode="repeat"
                                    emptySrc={ImgAsset.transparentBg}
                                    style={styles.transparentBg}
                                />
                                <View
                                    style={[
                                        {
                                            /** @ts-ignore */
                                            backgroundColor: theme.colors[key],
                                        },
                                        styles.colorBlock,
                                    ]}
                                />
                            </View>
                            <ThemeText
                                fontSize="subTitle"
                                style={styles.colorText}>
                                {
                                    /** @ts-ignore */
                                    Color(theme.colors[key]).hexa().toString()
                                }
                            </ThemeText>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </>
    );

    if (orientation === "horizontal") {
        return (
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                <ResponsiveSplitView
                    carPreset="balanced"
                    primary={<ScrollView style={styles.previewPane}>{preview}</ScrollView>}
                    secondary={
                        <ScrollView style={styles.controlsPane}>
                            {controls}
                        </ScrollView>
                    }
                />
            </HorizontalSafeAreaView>
        );
    }

    return (
        <ScrollView style={globalStyle.fwflex1}>
            {preview}
            {controls}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        flex: 1,
    },
    previewPane: {
        flex: 1,
        minWidth: 0,
        paddingHorizontal: rpx(12),
    },
    controlsPane: {
        flex: 1,
        minWidth: 0,
        paddingVertical: rpx(12),
    },
    image: {
        marginTop: rpx(36),
        borderRadius: rpx(12),
        width: "100%",
        maxWidth: rpx(460),
        aspectRatio: 2 / 3,
        alignSelf: "center",
    },
    sliderWrapper: {
        marginTop: rpx(48),
        width: "100%",
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    slider: {
        flex: 1,
        height: rpx(40),
    },
    colorsContainer: {
        width: "100%",
        flex: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: rpx(48),
        paddingHorizontal: rpx(24),
        justifyContent: "space-between",
    },
    colorItem: {
        flex: 1,
        flexBasis: "40%",
        marginBottom: rpx(36),
    },
    colorBlockContainer: {
        width: rpx(76),
        height: rpx(50),
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "#ccc",
    },
    colorBlock: {
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 2,
    },
    colorItemBlockContainer: {
        marginTop: rpx(18),
        flexDirection: "row",
        alignItems: "center",
    },
    colorText: {
        marginLeft: rpx(8),
    },
    transparentBg: {
        position: "absolute",
        zIndex: -1,
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
    },
});
