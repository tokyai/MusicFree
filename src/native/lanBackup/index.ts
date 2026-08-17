import { NativeModules, Platform } from "react-native";

export type LanBackupMode = "backup" | "restore";

export interface ILanBackupServerOptions {
    mode: LanBackupMode;
    backupJson?: string;
    maxBytes?: number;
    timeoutMs?: number;
}

export interface ILanBackupServerInfo {
    url: string;
    expiresAt: number;
    mode: LanBackupMode;
}

export interface ILanBackupTransferResult {
    bytes: number;
    payload?: string;
}

interface ILanBackupNativeModule {
    startServer(
        options: ILanBackupServerOptions,
    ): Promise<ILanBackupServerInfo>;
    waitForTransfer(): Promise<ILanBackupTransferResult>;
    stopServer(): void;
}

const nativeLanBackup = NativeModules.LanBackup as
    | ILanBackupNativeModule
    | undefined;

function unsupportedError() {
    const error = new Error(
        "LAN backup is not supported on this platform",
    ) as Error & { code?: string };
    error.code = "LAN_UNSUPPORTED";
    return error;
}

const LanBackup = {
    isSupported: Platform.OS === "android" && !!nativeLanBackup,

    startServer(options: ILanBackupServerOptions) {
        if (!nativeLanBackup || Platform.OS !== "android") {
            return Promise.reject(unsupportedError());
        }
        return nativeLanBackup.startServer(options);
    },

    waitForTransfer() {
        if (!nativeLanBackup || Platform.OS !== "android") {
            return Promise.reject(unsupportedError());
        }
        return nativeLanBackup.waitForTransfer();
    },

    stopServer() {
        nativeLanBackup?.stopServer();
    },
};

export default LanBackup;
