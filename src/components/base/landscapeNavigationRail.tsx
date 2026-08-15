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
                            fontWeight="bold">
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
                                    {
                                        backgroundColor: selected
                                            ? colors.card
                                            : "transparent",
                                        borderLeftColor: selected
                                            ? colors.primary
                                            : "transparent",
                                    },
                                    item.disabled ? styles.disabled : null,
                                ]}>
                                <ThemeText
                                    numberOfLines={2}
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
        paddingHorizontal: rpx(16),
        paddingVertical: rpx(20),
    },
    section: {
        width: "100%",
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
        minHeight: rpx(72),
        borderLeftWidth: rpx(6),
        borderRadius: rpx(6),
        paddingHorizontal: rpx(18),
        paddingVertical: rpx(14),
        justifyContent: "center",
        marginBottom: rpx(8),
    },
    disabled: {
        opacity: 0.45,
    },
});
