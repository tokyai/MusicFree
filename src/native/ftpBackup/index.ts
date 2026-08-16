import { NativeModules, Platform } from "react-native";

export type FtpMode = "ftp" | "ftps";

export interface IFtpConnectionOptions {
    mode: FtpMode;
    host: string;
    port: number;
    username: string;
    password: string;
    remoteDirectory: string;
    connectTimeoutMs: number;
    readTimeoutMs: number;
}

export interface IFtpTransferResult {
    bytes: number;
}

export interface IFtpDownloadResult extends IFtpTransferResult {
    path: string;
}

interface IFtpBackupNativeModule {
    testConnection(options: IFtpConnectionOptions): Promise<void>;
    uploadBackup(
        options: IFtpConnectionOptions,
        localPath: string,
    ): Promise<IFtpTransferResult>;
    downloadBackup(
        options: IFtpConnectionOptions,
    ): Promise<IFtpDownloadResult>;
    cancelPendingOperation(): void;
}

const nativeFtpBackup = NativeModules.FtpBackup as
    | IFtpBackupNativeModule
    | undefined;

function unsupportedError() {
    return new Error("FTP backup is not supported on this platform");
}

const FtpBackup = {
    isSupported: Platform.OS === "android" && !!nativeFtpBackup,

    testConnection(options: IFtpConnectionOptions) {
        if (!nativeFtpBackup || Platform.OS !== "android") {
            return Promise.reject(unsupportedError());
        }
        return nativeFtpBackup.testConnection(options);
    },

    uploadBackup(options: IFtpConnectionOptions, localPath: string) {
        if (!nativeFtpBackup || Platform.OS !== "android") {
            return Promise.reject(unsupportedError());
        }
        return nativeFtpBackup.uploadBackup(options, localPath);
    },

    downloadBackup(options: IFtpConnectionOptions) {
        if (!nativeFtpBackup || Platform.OS !== "android") {
            return Promise.reject(unsupportedError());
        }
        return nativeFtpBackup.downloadBackup(options);
    },

    cancelPendingOperation() {
        nativeFtpBackup?.cancelPendingOperation();
    },
};

export default FtpBackup;
