import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import useTextColor from "@/hooks/useTextColor";
import Checkbox from "@/components/base/checkbox";
import { TouchableOpacity } from "react-native-gesture-handler";
import Icon from "@/components/base/icon.tsx";
import { iconSizeConst } from "@/constants/uiConst.ts";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";

const ITEM_HEIGHT = rpx(96);

interface IProps {
    type: "folder" | "file";
    path: string;
    parentPath: string;
    checked?: boolean;
    onItemPress: (currentChecked?: boolean) => void;
    onCheckedChange: (checked: boolean) => void;
}
function FileItem(props: IProps) {
    const {
        type,
        path,
        parentPath,
        checked,
        onItemPress,
        onCheckedChange: onCheckChange,
    } = props;

    const textColor = useTextColor();
    const displayMetrics = useDisplayMetrics();
    const itemHeight = displayMetrics.isCarMode
        ? Math.max(ITEM_HEIGHT, displayMetrics.minTouchTarget)
        : ITEM_HEIGHT;

    // 返回逻辑

    return (
        <View
            style={[
                styles.container,
                displayMetrics.isCarMode
                    ? {
                        height: itemHeight,
                        minHeight: displayMetrics.minTouchTarget,
                        paddingHorizontal: displayMetrics.horizontalPadding,
                    }
                    : null,
            ]}>
            <Pressable
                onPress={() => {
                    onItemPress(checked);
                }}
                style={[
                    styles.pathWrapper,
                    displayMetrics.isCarMode
                        ? { minHeight: displayMetrics.minTouchTarget }
                        : null,
                ]}>
                <Icon
                    name={
                        type === "folder"
                            ? "folder-outline"
                            : "document-outline"
                    }
                    color={textColor}
                    style={styles.folderIcon}
                    size={
                        displayMetrics.isCarMode
                            ? displayMetrics.iconSizes.light
                            : iconSizeConst.light
                    }
                />
                <ThemeText
                    style={styles.path}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {path.substring(
                        parentPath === "/" ? 1 : parentPath.length + 1,
                    )}
                </ThemeText>
            </Pressable>
            <TouchableOpacity
                onPress={() => {
                    onCheckChange(!checked);
                }}
                style={[
                    styles.checkIcon,
                    displayMetrics.isCarMode
                        ? {
                            minWidth: displayMetrics.minTouchTarget,
                            minHeight: displayMetrics.minTouchTarget,
                            alignItems: "center",
                            justifyContent: "center",
                        }
                        : null,
                ]}>
                <Checkbox checked={checked} />
            </TouchableOpacity>
        </View>
    );
}

export default memo(
    FileItem,
    (prev, curr) =>
        prev.checked === curr.checked &&
        prev.parentPath === curr.parentPath &&
        prev.path === curr.path,
);

const styles = StyleSheet.create({
    container: {
        width: "100%",
        height: ITEM_HEIGHT,
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    folderIcon: {
        fontSize: rpx(32),
        marginRight: rpx(14),
    },
    pathWrapper: {
        flexDirection: "row",
        flex: 1,
        alignItems: "center",
        height: "100%",
        marginRight: rpx(60),
    },
    path: {
        height: "100%",
        textAlignVertical: "center",
    },
    checkIcon: {
        padding: rpx(14),
    },
});
