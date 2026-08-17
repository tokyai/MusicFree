import ListItem, { ListItemHeader } from "@/components/base/listItem";
import Backup from "@/core/backup";
import Toast from "@/utils/toast";
import React from "react";
import { ScrollView, StyleSheet } from "react-native";

import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import axios from "axios";

import { ResumeMode } from "@/constants/commonConst.ts";
import Config, { useAppConfig } from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import { AuthType, createClient } from "webdav";
import useOrientation from "@/hooks/useOrientation";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";
import FtpBackupService, {
    type FtpConfigField,
    type IFtpBackupError,
    normalizeFtpBackupOptions,
} from "@/core/ftpBackup";
import LanBackupService, {
    type ILanBackupError,
    type ILanBackupSession,
} from "@/core/lanBackup";

export default function BackupSetting() {
    const { t } = useI18N();

    const resumeMode = useAppConfig("backup.resumeMode");
    const webdavUrl = useAppConfig("webdav.url");
    const webdavUsername = useAppConfig("webdav.username");
    const webdavPassword = useAppConfig("webdav.password");
    const ftpMode = useAppConfig("ftp.mode") === "ftp" ? "ftp" : "ftps";
    const ftpHost = useAppConfig("ftp.host");
    const ftpPort = useAppConfig("ftp.port");
    const ftpUsername = useAppConfig("ftp.username");
    const ftpPassword = useAppConfig("ftp.password");
    const ftpRemoteDirectory = useAppConfig("ftp.remoteDirectory");
    const orientation = useOrientation();

    const getErrorReason = (reason: unknown) => {
        const configField = reason instanceof Error
            ? (reason as IFtpBackupError).configField
            : undefined;
        const errorCode = reason instanceof Error
            ? (reason as IFtpBackupError).code
            : undefined;
        const localizedField: Record<FtpConfigField, string> = {
            mode: t("backupAndResume.ftpInvalidMode"),
            host: t("backupAndResume.ftpInvalidHost"),
            port: t("backupAndResume.ftpInvalidPort"),
            credentials: t("backupAndResume.ftpCredentialsRequired"),
            directory: t("backupAndResume.ftpInvalidDirectory"),
        };
        const localizedCode: Record<string, string> = {
            FTP_UNSUPPORTED: t("backupAndResume.ftpError.unsupported"),
            FTP_INVALID_CONFIG: t("backupAndResume.ftpError.invalidConfig"),
            FTP_DNS_FAILED: t("backupAndResume.ftpError.dnsFailed"),
            FTP_CONNECT_TIMEOUT: t("backupAndResume.ftpError.timeout"),
            FTP_NETWORK_FAILED: t("backupAndResume.ftpError.networkFailed"),
            FTP_AUTH_FAILED: t("backupAndResume.ftpError.authFailed"),
            FTP_TLS_FAILED: t("backupAndResume.ftpError.tlsFailed"),
            FTP_DIRECTORY_NOT_FOUND: t(
                "backupAndResume.ftpError.directoryNotFound",
            ),
            FTP_FILE_NOT_FOUND: t("backupAndResume.ftpError.fileNotFound"),
            FTP_UPLOAD_FAILED: t("backupAndResume.ftpError.uploadFailed"),
            FTP_DOWNLOAD_FAILED: t("backupAndResume.ftpError.downloadFailed"),
            FTP_REPLACE_FAILED: t("backupAndResume.ftpError.replaceFailed"),
            FTP_CANCELLED: t("backupAndResume.ftpError.cancelled"),
        };
        if (configField) {
            return localizedField[configField];
        }
        if (errorCode && localizedCode[errorCode]) {
            return localizedCode[errorCode];
        }
        return reason instanceof Error ? reason.message : String(reason ?? "");
    };

    const getLanErrorReason = (reason: unknown) => {
        const errorCode = reason instanceof Error
            ? (reason as ILanBackupError).code
            : undefined;
        const localizedCode: Record<string, string> = {
            LAN_UNSUPPORTED: t("backupAndResume.lanError.unsupported"),
            LAN_NETWORK_UNAVAILABLE: t(
                "backupAndResume.lanError.networkUnavailable",
            ),
            LAN_TIMEOUT: t("backupAndResume.lanError.timeout"),
            LAN_UPLOAD_TOO_LARGE: t("backupAndResume.lanError.tooLarge"),
            LAN_INVALID_ENCODING: t(
                "backupAndResume.lanError.invalidBackup",
            ),
            LAN_INVALID_BACKUP: t("backupAndResume.lanError.invalidBackup"),
            LAN_TRANSFER_FAILED: t("backupAndResume.lanError.transferFailed"),
            LAN_CANCELLED: t("backupAndResume.lanError.cancelled"),
        };
        if (errorCode && localizedCode[errorCode]) {
            return localizedCode[errorCode];
        }
        return reason instanceof Error ? reason.message : String(reason ?? "");
    };

    function showLanSession(session: ILanBackupSession, isBackup: boolean) {
        showDialog("LanBackupDialog", {
            title: t(
                isBackup
                    ? "backupAndResume.backupToLan"
                    : "backupAndResume.resumeFromLan",
            ),
            url: session.url,
            expiresAt: session.expiresAt,
            promise: session.transfer,
            onResolve() {
                Toast.success(
                    t(isBackup ? "toast.backupSuccess" : "toast.resumeSuccess"),
                );
            },
            onReject(reason) {
                Toast.warn(
                    t(isBackup ? "toast.backupFail" : "toast.resumeFail", {
                        reason: getLanErrorReason(reason),
                    }),
                );
            },
            onCancel() {
                LanBackupService.cancel();
            },
        });
    }

    async function onBackupToLan() {
        try {
            showLanSession(await LanBackupService.startBackup(), true);
        } catch (reason) {
            Toast.warn(
                t("toast.backupFail", { reason: getLanErrorReason(reason) }),
            );
        }
    }

    async function onResumeFromLan() {
        try {
            showLanSession(
                await LanBackupService.startResume(
                    resumeMode ?? ResumeMode.Append,
                ),
                false,
            );
        } catch (reason) {
            Toast.warn(
                t("toast.resumeFail", { reason: getLanErrorReason(reason) }),
            );
        }
    }

    function onTestFtp() {
        showDialog("LoadingDialog", {
            title: t("backupAndResume.testFtpConnection"),
            loadingText: t("backupAndResume.testingFtpConnection"),
            promise: FtpBackupService.testConnection(),
            onResolve(_, hideDialog) {
                Toast.success(t("toast.ftpConnectionSuccess"));
                hideDialog();
            },
            onCancel(hideDialog) {
                FtpBackupService.cancel();
                hideDialog();
            },
            onReject(reason, hideDialog) {
                hideDialog();
                Toast.warn(
                    t("toast.ftpConnectionFail", {
                        reason: getErrorReason(reason),
                    }),
                );
            },
        });
    }

    function onBackupToFtp() {
        showDialog("LoadingDialog", {
            title: t("backupAndResume.backupToFtp"),
            loadingText: t("backupAndResume.backuping"),
            promise: FtpBackupService.backup(),
            onResolve(_, hideDialog) {
                Toast.success(t("toast.backupSuccess"));
                hideDialog();
            },
            onCancel(hideDialog) {
                FtpBackupService.cancel();
                hideDialog();
            },
            onReject(reason, hideDialog) {
                hideDialog();
                Toast.warn(
                    t("toast.backupFail", { reason: getErrorReason(reason) }),
                );
            },
        });
    }

    function onResumeFromFtp() {
        showDialog("SimpleDialog", {
            title: t("backupAndResume.resumeFromFtp"),
            content: t("backupAndResume.ftpRestoreConfirm"),
            onOk() {
                setTimeout(() => {
                    showDialog("LoadingDialog", {
                        title: t("backupAndResume.resumeFromFtp"),
                        loadingText: t("backupAndResume.resuming"),
                        promise: FtpBackupService.resume(
                            resumeMode ?? ResumeMode.Append,
                        ),
                        onResolve(_, hideDialog) {
                            Toast.success(t("toast.resumeSuccess"));
                            hideDialog();
                        },
                        onCancel(hideDialog) {
                            FtpBackupService.cancel();
                            hideDialog();
                        },
                        onReject(reason, hideDialog) {
                            hideDialog();
                            Toast.warn(
                                t("toast.resumeFail", {
                                    reason: getErrorReason(reason),
                                }),
                            );
                        },
                    });
                }, 0);
            },
        });
    }

    async function onResumeFromUrl() {
        showPanel("SimpleInput", {
            title: t("backupAndResume.resumeFromUrlDialogTitle"),
            placeholder: t("backupAndResume.resumeFromUrlDialogPlaceHolder"),
            maxLength: 1024,
            async onOk(text, closePanel) {
                try {
                    const url = text.trim();
                    if (url.endsWith(".json") || url.endsWith(".txt")) {
                        const raw = (await axios.get(text)).data;
                        await Backup.resume(raw, resumeMode);
                        Toast.success(t("toast.resumeSuccess"));
                        closePanel();
                    } else {
                        throw "无效的URL";
                    }
                } catch (e: any) {
                    Toast.warn(t("toast.resumeFail", { reason: e?.message ?? e }));
                }
            },
        });
    }

    async function onResumeFromWebdav() {
        const url = Config.getConfig("webdav.url");
        const username = Config.getConfig("webdav.username");
        const password = Config.getConfig("webdav.password");

        if (!(username && password && url)) {
            Toast.warn(t("toast.resumePreCheckFailed"));
            return;
        }
        const client = createClient(url, {
            authType: AuthType.Password,
            username: username,
            password: password,
        });

        if (!(await client.exists("/MusicFree/MusicFreeBackup.json"))) {
            Toast.warn(t("toast.backupFileNotFound"));
            return;
        }

        try {
            const resumeData = await client.getFileContents(
                "/MusicFree/MusicFreeBackup.json",
                {
                    format: "text",
                },
            );
            await Backup.resume(
                resumeData,
                Config.getConfig("backup.resumeMode"),
            );
            Toast.success(t("toast.resumeSuccess"));
        } catch (e: any) {
            Toast.warn(t("toast.resumeFail", { reason: e?.message ?? e }));
        }
    }

    async function onBackupToWebdav() {
        const username = Config.getConfig("webdav.username");
        const password = Config.getConfig("webdav.password");
        const url = Config.getConfig("webdav.url");
        if (!(username && password && url)) {
            Toast.warn(t("toast.resumePreCheckFailed"));
            return;
        }
        try {
            const client = createClient(url, {
                authType: AuthType.Password,
                username: username,
                password: password,
            });

            const raw = Backup.backup();
            if (!(await client.exists("/MusicFree"))) {
                await client.createDirectory("/MusicFree");
            }
            // 临时文件
            await client.putFileContents(
                "/MusicFree/MusicFreeBackup.json",
                raw,
                {
                    overwrite: true,
                },
            );
            Toast.success(t("toast.backupSuccess"));
        } catch (e: any) {
            Toast.warn(t("toast.backupFail", { reason: e?.message ?? e }));
        }
    }

    const ftpContent = (
        <>
            <ListItemHeader>{t("backupAndResume.ftpBackup")}</ListItemHeader>
            <ListItem
                withHorizontalPadding
                onPress={() => {
                    showDialog("RadioDialog", {
                        title: t("backupAndResume.ftpMode"),
                        content: [
                            {
                                label: t("backupAndResume.ftpMode.ftps"),
                                value: "ftps",
                            },
                            {
                                label: t("backupAndResume.ftpMode.ftp"),
                                value: "ftp",
                            },
                        ],
                        onOk(value) {
                            Config.setConfig("ftp.mode", value as "ftp" | "ftps");
                        },
                    });
                }}>
                <ListItem.Content
                    title={t("backupAndResume.ftpMode")}
                    description={
                        ftpMode === "ftp"
                            ? t("backupAndResume.ftpPlainWarning")
                            : t("backupAndResume.ftpTlsDescription")
                    }
                />
                <ListItem.ListItemText>
                    {t(("backupAndResume.ftpMode." + ftpMode) as any)}
                </ListItem.ListItemText>
            </ListItem>
            <ListItem
                withHorizontalPadding
                onPress={() => {
                    showPanel("SetUserVariables", {
                        title: t("backupAndResume.ftpSettings"),
                        initValues: {
                            host: ftpHost ?? "",
                            port: String(ftpPort ?? 21),
                            username: ftpUsername ?? "",
                            password: ftpPassword ?? "",
                            remoteDirectory: ftpRemoteDirectory ?? "/MusicFree",
                        },
                        variables: [
                            {
                                key: "host",
                                name: t("backupAndResume.ftpHost"),
                                hint: t("backupAndResume.ftpHostHint"),
                            },
                            {
                                key: "port",
                                name: t("backupAndResume.ftpPort"),
                                hint: t("backupAndResume.ftpPortHint"),
                            },
                            {
                                key: "username",
                                name: t("common.username"),
                            },
                            {
                                key: "password",
                                name: t("common.password"),
                            },
                            {
                                key: "remoteDirectory",
                                name: t("backupAndResume.ftpRemoteDirectory"),
                                hint: t("backupAndResume.ftpRemoteDirectoryHint"),
                            },
                        ],
                        secureKeys: ["password"],
                        keyboardTypes: { port: "numeric" },
                        onOk(values, closePanel) {
                            try {
                                const rawPort = values?.port?.trim();
                                const options = normalizeFtpBackupOptions({
                                    mode: ftpMode,
                                    host: values?.host,
                                    port: rawPort ? Number(rawPort) : undefined,
                                    username: values?.username,
                                    password: values?.password,
                                    remoteDirectory: values?.remoteDirectory,
                                });
                                Config.setConfig("ftp.mode", options.mode);
                                Config.setConfig("ftp.host", options.host);
                                Config.setConfig("ftp.port", options.port);
                                Config.setConfig("ftp.username", options.username);
                                Config.setConfig("ftp.password", options.password);
                                Config.setConfig(
                                    "ftp.remoteDirectory",
                                    options.remoteDirectory,
                                );
                                Toast.success(t("toast.saveSuccess"));
                                closePanel();
                            } catch (error) {
                                Toast.warn(
                                    t("toast.ftpSettingsInvalid", {
                                        reason: getErrorReason(error),
                                    }),
                                );
                            }
                        },
                    });
                }}>
                <ListItem.Content title={t("backupAndResume.ftpSettings")} />
            </ListItem>
            <ListItem withHorizontalPadding onPress={onTestFtp}>
                <ListItem.Content title={t("backupAndResume.testFtpConnection")} />
            </ListItem>
            <ListItem withHorizontalPadding onPress={onBackupToFtp}>
                <ListItem.Content title={t("backupAndResume.backupToFtp")} />
            </ListItem>
            <ListItem withHorizontalPadding onPress={onResumeFromFtp}>
                <ListItem.Content title={t("backupAndResume.resumeFromFtp")} />
            </ListItem>
        </>
    );

    const lanContent = LanBackupService.isSupported ? (
        <>
            <ListItemHeader>
                {t("backupAndResume.lanBackup")}
            </ListItemHeader>
            <ListItem withHorizontalPadding onPress={onBackupToLan}>
                <ListItem.Content
                    title={t("backupAndResume.backupToLan")}
                    description={t("backupAndResume.lanDescription")}
                />
            </ListItem>
            <ListItem withHorizontalPadding onPress={onResumeFromLan}>
                <ListItem.Content
                    title={t("backupAndResume.resumeFromLan")}
                    description={t("backupAndResume.lanDescription")}
                />
            </ListItem>
        </>
    ) : null;

    const resumeContent = (
        <>
            <ListItemHeader>{t("sidebar.backupAndResume")}</ListItemHeader>
            <ListItem
                withHorizontalPadding
                onPress={() => {
                    showDialog("RadioDialog", {
                        title: t("backupAndResume.setResumeMode"),
                        content: [
                            {
                                label: t(("backupAndResume.resumeMode." + ResumeMode.Append) as any),
                                value: ResumeMode.Append,
                            },
                            {
                                label: t(("backupAndResume.resumeMode." + ResumeMode.OverwriteDefault) as any),
                                value: ResumeMode.OverwriteDefault,
                            },
                            {
                                label: t(("backupAndResume.resumeMode." + ResumeMode.Overwrite) as any),
                                value: ResumeMode.Overwrite,
                            },
                        ],
                        onOk(value) {
                            Config.setConfig(
                                "backup.resumeMode",
                                value as any,
                            );
                        },
                    });
                }}>
                <ListItem.Content title={t("backupAndResume.resumeMode")} />
                <ListItem.ListItemText>
                    {
                        t(("backupAndResume.resumeMode." + ((resumeMode as ResumeMode) ||
                            ResumeMode.Append)) as any)
                    }
                </ListItem.ListItemText>
            </ListItem>
            {lanContent}
            {ftpContent}
            <ListItem withHorizontalPadding onPress={onResumeFromUrl}>
                <ListItem.Content title={t("backupAndResume.resumeFromUrlDialogTitle")} />
            </ListItem>
        </>
    );

    const webdavContent = (
        <>
            <ListItemHeader>Webdav</ListItemHeader>
            <ListItem
                withHorizontalPadding
                onPress={() => {
                    showPanel("SetUserVariables", {
                        title: t("backupAndResume.webdavSettings"),
                        initValues: {
                            url: webdavUrl ?? "",
                            username: webdavUsername ?? "",
                            password: webdavPassword ?? "",
                        },
                        variables: [
                            {
                                key: "url",
                                name: "URL",
                                hint: t("backupAndResume.webdavUrl"),
                            },
                            {
                                key: "username",
                                name: t("common.username"),
                            },
                            {
                                key: "password",
                                name: t("common.password"),
                            },
                        ],
                        onOk(values, closePanel) {
                            Config.setConfig("webdav.url", values?.url);
                            Config.setConfig("webdav.username", values?.username);
                            Config.setConfig("webdav.password", values?.password);

                            Toast.success(t("toast.saveSuccess"));
                            closePanel();
                        },
                    });
                }}>
                <ListItem.Content title={t("backupAndResume.webdavSettings")} />
            </ListItem>
            <ListItem withHorizontalPadding onPress={onBackupToWebdav}>
                <ListItem.Content title={t("backupAndResume.backupToWebdav")} />
            </ListItem>
            <ListItem withHorizontalPadding onPress={onResumeFromWebdav}>
                <ListItem.Content title={t("backupAndResume.resumeFromWebdav")} />
            </ListItem>
        </>
    );

    if (orientation === "horizontal") {
        return (
            <ResponsiveSplitView
                carPreset="balanced"
                primary={
                    <ScrollView style={style.wrapper}>
                        {resumeContent}
                    </ScrollView>
                }
                secondary={
                    <ScrollView style={style.wrapper}>
                        {webdavContent}
                    </ScrollView>
                }
            />
        );
    }

    return (
        <ScrollView style={style.wrapper}>
            {resumeContent}
            {webdavContent}
        </ScrollView>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
});
