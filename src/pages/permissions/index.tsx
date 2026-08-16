import AppBar from "@/components/base/appBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import ListItem from "@/components/base/listItem";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";
import StatusBar from "@/components/base/statusBar";
import ThemeSwitch from "@/components/base/switch";
import ThemeText from "@/components/base/themeText";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import LyricUtil from "@/native/lyricUtil";
import NativeUtils from "@/native/utils";
import rpx from "@/utils/rpx";
import useOrientation from "@/hooks/useOrientation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, StyleSheet, View } from "react-native";

type IPermissionTypes = "floatingWindow" | "fileStorage";

export default function Permissions() {
    const appState = useRef(AppState.currentState);
    const [permissions, setPermissions] = useState<
        Record<IPermissionTypes, boolean>
    >({
        floatingWindow: false,
        fileStorage: false,
        // background: false,
    });
    const { t } = useI18N();

    const orientation = useOrientation();

    const checkPermission = useCallback(async (type?: IPermissionTypes) => {
        const newPermission: Partial<Record<IPermissionTypes, boolean>> = {};
        if (!type || type === "floatingWindow") {
            const hasPermission = await LyricUtil.checkSystemAlertPermission();
            newPermission.floatingWindow = hasPermission;
        }
        if (!type || type === "fileStorage") {
            const hasPermission = await NativeUtils.checkStoragePermission();
            console.log("HAS", hasPermission);
            newPermission.fileStorage = hasPermission;
        }
        // if (!type || type === 'background') {

        // }

        setPermissions(prev => ({ ...prev, ...newPermission }));
    }, []);

    useEffect(() => {
        checkPermission();
        const subscription = AppState.addEventListener(
            "change",
            nextAppState => {
                if (
                    appState.current.match(/inactive|background/) &&
                    nextAppState === "active"
                ) {
                    checkPermission();
                }

                appState.current = nextAppState;
            },
        );

        return () => {
            subscription.remove();
        };
    }, [checkPermission]);

    const description = (
        <ThemeText style={styles.description}>
            {t("permissionSetting.description")}
        </ThemeText>
    );

    const permissionItems = (
        <View style={styles.permissionItems}>
            <ListItem
                withHorizontalPadding
                heightType="big"
                onPress={() => {
                    LyricUtil.requestSystemAlertPermission();
                }}>
                <ListItem.Content
                    title={t("permissionSetting.floatWindowPermission")}
                    description={t("permissionSetting.floatWindowPermissionDescription")}
                />
                <ThemeSwitch value={permissions.floatingWindow} />
            </ListItem>
            <ListItem
                withHorizontalPadding
                heightType="big"
                onPress={() => {
                    NativeUtils.requestStoragePermission();
                }}>
                <ListItem.Content
                    title={t("permissionSetting.fileReadWritePermission")}
                    description={t("permissionSetting.fileReadWritePermissionDescription")}
                />
                <ThemeSwitch value={permissions.fileStorage} />
            </ListItem>
        </View>
    );

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar>{t("permissionSetting.title")}</AppBar>
            {orientation === "horizontal" ? (
                <HorizontalSafeAreaView style={globalStyle.flex1}>
                    <ResponsiveSplitView
                        carPreset="metadata"
                        primary={
                            <ScrollView style={globalStyle.flex1}>
                                {description}
                            </ScrollView>
                        }
                        secondary={
                            <ScrollView style={globalStyle.flex1}>
                                {permissionItems}
                            </ScrollView>
                        }
                    />
                </HorizontalSafeAreaView>
            ) : (
                <>
                    {description}
                    {permissionItems}
                </>
            )}
            {/* <ListItem withHorizontalPadding heightType="big">
                <ListItem.Content
                    title="后台运行"
                    description="用以在后台播放音乐"></ListItem.Content>
                <ThemeSwitch value={permissions.background}></ThemeSwitch>
            </ListItem> */}
        </VerticalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    description: {
        width: "100%",
        paddingHorizontal: rpx(24),
        marginVertical: rpx(36),
    },
    permissionItems: {
        width: "100%",
    },
});
