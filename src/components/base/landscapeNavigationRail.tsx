import React from "react";
import {
    Pressable,
    ScrollView,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

export interface ILandscapeNavigationRailItem {
    key: string;
    title: string;
    disabled?: boolean;
}

export interface ILandscapeNavigationRailSection {
    key: string;
    title?: string;
    items: ILandscapeNavigationRailItem[];
    selectedKey?: string;
    onSelect: (key: string) => void;
}

interface ILandscapeNavigationRailProps {
    sections: ILandscapeNavigationRailSection[];
    style?: StyleProp<ViewStyle>;
}

export default function LandscapeNavigationRail(
    props: ILandscapeNavigationRailProps,
) {
    const { sections, style } = props;
    const colors = useColors();
    const displayMetrics = useDisplayMetrics();
    const selectedItemStyle: ViewStyle = {
        backgroundColor: colors.card,
        borderLeftColor: colors.primary,
    };

    return (
        <ScrollView
            style={[styles.wrapper, style]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {sections.map((section, sectionIndex) => (
                <View
                    key={section.key}
                    style={[
                        styles.section,
                        sectionIndex ? styles.sectionSpacing : null,
                    ]}>
                    {section.title ? (
                        <ThemeText
                            style={styles.sectionTitle}
                            fontSize="subTitle"
                            fontColor="textSecondary"
                            fontWeight="bold"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}>
                            {section.title}
                        </ThemeText>
                    ) : null}
                    {section.items.map(item => {
                        const selected = section.selectedKey === item.key;
                        return (
                            <Pressable
                                key={item.key}
                                accessibilityRole="button"
                                accessibilityState={{
                                    selected,
                                    disabled: item.disabled,
                                }}
                                disabled={item.disabled}
                                onPress={() => section.onSelect(item.key)}
                                style={[
                                    styles.item,
                                    displayMetrics.isCarMode
                                        ? {
                                            minHeight:
                                                displayMetrics.navigationItemHeight,
                                            paddingHorizontal:
                                                displayMetrics.horizontalPadding,
                                            paddingVertical:
                                                displayMetrics.scaleRpx(14),
                                        }
                                        : null,
                                    selected
                                        ? selectedItemStyle
                                        : styles.unselectedItem,
                                    item.disabled ? styles.disabled : null,
                                ]}>
                                <ThemeText
                                    style={styles.itemText}
                                    numberOfLines={2}
                                    ellipsizeMode="tail"
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.8}
                                    fontColor={selected ? "primary" : "text"}
                                    fontWeight={selected ? "bold" : "regular"}>
                                    {item.title}
                                </ThemeText>
                            </Pressable>
                        );
                    })}
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        minWidth: 0,
    },
    content: {
        width: "100%",
        minWidth: 0,
        paddingHorizontal: rpx(16),
        paddingVertical: rpx(20),
    },
    section: {
        width: "100%",
        minWidth: 0,
    },
    sectionSpacing: {
        marginTop: rpx(28),
    },
    sectionTitle: {
        paddingHorizontal: rpx(16),
        marginBottom: rpx(12),
    },
    item: {
        width: "100%",
        minWidth: 0,
        minHeight: rpx(72),
        borderLeftWidth: rpx(6),
        borderRadius: rpx(6),
        paddingHorizontal: rpx(18),
        paddingVertical: rpx(14),
        justifyContent: "center",
        marginBottom: rpx(8),
    },
    itemText: {
        width: "100%",
        alignSelf: "stretch",
        minWidth: 0,
        flexShrink: 1,
    },
    unselectedItem: {
        backgroundColor: "transparent",
        borderLeftColor: "transparent",
    },
    disabled: {
        opacity: 0.45,
    },
});
