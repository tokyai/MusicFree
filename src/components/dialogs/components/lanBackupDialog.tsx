import Clipboard from "@react-native-clipboard/clipboard";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import type { ILanBackupTransferResult } from "@/native/lanBackup";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import { hideDialog } from "../useDialog";
import Dialog from "./base";

interface ILanBackupDialogProps {
    title: string;
    url: string;
    expiresAt: number;
    promise: Promise<ILanBackupTransferResult>;
    onResolve?: (result: ILanBackupTransferResult) => void;
    onReject?: (reason: unknown) => void;
    onCancel?: () => void;
}

export default function LanBackupDialog(props: ILanBackupDialogProps) {
    const {
        title,
        url,
        expiresAt,
        promise,
        onResolve,
        onReject,
        onCancel,
    } = props;
    const { t } = useI18N();
    const colors = useColors();
    const finishedRef = useRef(false);

    useEffect(() => {
        let mounted = true;
        promise.then(result => {
            if (!mounted || finishedRef.current) return;
            finishedRef.current = true;
            hideDialog();
            onResolve?.(result);
        }).catch(reason => {
            if (!mounted || finishedRef.current) return;
            finishedRef.current = true;
            hideDialog();
            onReject?.(reason);
        });

        return () => {
            mounted = false;
            if (!finishedRef.current) {
                finishedRef.current = true;
                onCancel?.();
            }
        };
    }, [onCancel, onReject, onResolve, promise]);

    const cancel = () => {
        if (!finishedRef.current) {
            finishedRef.current = true;
            onCancel?.();
        }
        hideDialog();
    };

    const expiryText = new Date(expiresAt).toLocaleTimeString();

    return (
        <Dialog onDismiss={cancel}>
            <Dialog.Title withDivider>{title}</Dialog.Title>
            <Dialog.Content needScroll>
                <ThemeText>
                    {t("backupAndResume.lanInstructions")}
                </ThemeText>
                <View
                    style={[
                        styles.urlContainer,
                        { backgroundColor: colors.placeholder },
                    ]}>
                    <ThemeText selectable style={styles.urlText}>
                        {url}
                    </ThemeText>
                </View>
                <ThemeText fontColor="textSecondary" style={styles.hint}>
                    {t("backupAndResume.lanTrustedNetworkWarning")}
                </ThemeText>
                <ThemeText fontColor="textSecondary" style={styles.hint}>
                    {t("backupAndResume.lanExpiresAt", {
                        time: expiryText,
                    })}
                </ThemeText>
                <View style={styles.waitingRow}>
                    <ActivityIndicator color={colors.primary} />
                    <ThemeText style={styles.waitingText}>
                        {t("backupAndResume.lanWaiting")}
                    </ThemeText>
                </View>
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("backupAndResume.copyLanAddress"),
                        onPress() {
                            Clipboard.setString(url);
                            Toast.success(t("toast.copiedToClipboard"));
                        },
                    },
                    {
                        title: t("common.cancel"),
                        type: "primary",
                        onPress: cancel,
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    urlContainer: {
        borderRadius: rpx(8),
        marginTop: rpx(24),
        paddingHorizontal: rpx(20),
        paddingVertical: rpx(18),
        width: "100%",
    },
    urlText: {
        lineHeight: rpx(40),
    },
    hint: {
        lineHeight: rpx(36),
        marginTop: rpx(16),
    },
    waitingRow: {
        alignItems: "center",
        flexDirection: "row",
        marginTop: rpx(24),
    },
    waitingText: {
        marginLeft: rpx(16),
    },
});
