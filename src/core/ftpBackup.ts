import RNFS, { CachesDirectoryPath } from "react-native-fs";

import Backup, { parseBackupPayload } from "@/core/backup";
import Config from "@/core/appConfig";
import { ResumeMode } from "@/constants/commonConst.ts";
import FtpBackup, {
    type FtpMode,
    type IFtpConnectionOptions,
} from "@/native/ftpBackup";
import { writeInChunks } from "@/utils/fileUtils.ts";

export const FTP_BACKUP_FILE_NAME = "MusicFreeBackup.json";
export const FTP_DEFAULT_DIRECTORY = "/MusicFree";
export const FTP_DEFAULT_PORT = 21;
export const FTP_DEFAULT_MODE: FtpMode = "ftps";
export const FTP_CONNECT_TIMEOUT_MS = 15_000;
export const FTP_READ_TIMEOUT_MS = 30_000;

export interface IFtpBackupSettings {
    mode?: unknown;
    host?: unknown;
    port?: unknown;
    username?: unknown;
    password?: unknown;
    remoteDirectory?: unknown;
}

export interface IFtpBackupError extends Error {
    code?: string;
    configField?: FtpConfigField;
}

export type FtpConfigField =
    | "mode"
    | "host"
    | "port"
    | "credentials"
    | "directory";

function ftpError(
    code: string,
    message: string,
    configField?: FtpConfigField,
): IFtpBackupError {
    const error = new Error(message) as IFtpBackupError;
    error.code = code;
    error.configField = configField;
    return error;
}

function stringValue(value: unknown, trim = true) {
    if (typeof value !== "string") return "";
    return trim ? value.trim() : value;
}

function normalizeRemoteDirectory(value: unknown) {
    const directory = stringValue(value) || FTP_DEFAULT_DIRECTORY;
    if (
        !directory.startsWith("/") ||
        directory.includes("\\") ||
        directory.includes("\u0000") ||
        directory.split("/").some(segment => segment === "." || segment === "..")
    ) {
        throw ftpError(
            "FTP_INVALID_CONFIG",
            "FTP 远程目录必须是绝对路径，且不能包含相对路径段",
            "directory",
        );
    }
    return directory === "/" ? "/" : directory.replace(/\/+$/, "");
}

/** Normalize persisted settings at the TypeScript/native boundary. */
export function normalizeFtpBackupOptions(
    settings: IFtpBackupSettings,
): IFtpConnectionOptions {
    const mode = settings.mode === undefined
        ? FTP_DEFAULT_MODE
        : settings.mode === "ftp" || settings.mode === "ftps"
            ? settings.mode
            : null;
    if (!mode) {
        throw ftpError("FTP_INVALID_CONFIG", "FTP 传输模式无效", "mode");
    }

    const host = stringValue(settings.host);
    if (
        !host ||
        host.includes("://") ||
        /[\s/\\]/.test(host)
    ) {
        throw ftpError(
            "FTP_INVALID_CONFIG",
            "FTP 主机必须填写不带协议和路径的主机名或 IP 地址",
            "host",
        );
    }

    const port = settings.port === undefined
        ? FTP_DEFAULT_PORT
        : settings.port;
    if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw ftpError(
            "FTP_INVALID_CONFIG",
            "FTP 端口必须是 1 到 65535 的整数",
            "port",
        );
    }

    const username = stringValue(settings.username);
    const password = stringValue(settings.password, false);
    if (!username || !password) {
        throw ftpError(
            "FTP_INVALID_CONFIG",
            "FTP 用户名和密码不能为空",
            "credentials",
        );
    }

    return {
        mode,
        host,
        port,
        username,
        password,
        remoteDirectory: normalizeRemoteDirectory(settings.remoteDirectory),
        connectTimeoutMs: FTP_CONNECT_TIMEOUT_MS,
        readTimeoutMs: FTP_READ_TIMEOUT_MS,
    };
}

export function getFtpBackupOptions(): IFtpConnectionOptions {
    return normalizeFtpBackupOptions({
        mode: Config.getConfig("ftp.mode"),
        host: Config.getConfig("ftp.host"),
        port: Config.getConfig("ftp.port"),
        username: Config.getConfig("ftp.username"),
        password: Config.getConfig("ftp.password"),
        remoteDirectory: Config.getConfig("ftp.remoteDirectory"),
    });
}

function ensureSupported() {
    if (!FtpBackup.isSupported) {
        throw ftpError(
            "FTP_UNSUPPORTED",
            "当前平台不支持 FTP 备份，请使用 URL 或 WebDAV 方式",
        );
    }
}

function cacheFilePath(prefix: string) {
    return `${CachesDirectoryPath}/${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.json`;
}

async function removeCacheFile(filePath: string | undefined) {
    if (!filePath) return;
    try {
        if (await RNFS.exists(filePath)) {
            await RNFS.unlink(filePath);
        }
    } catch {
        // Cleanup is best effort; the native bridge already removes failed downloads.
    }
}

function isDownloadedCachePath(filePath: string) {
    const cachePrefix = `${CachesDirectoryPath}/`;
    return filePath.startsWith(cachePrefix);
}

function assertDownloadedCachePath(filePath: string) {
    if (!isDownloadedCachePath(filePath)) {
        throw ftpError("FTP_DOWNLOAD_FAILED", "FTP 下载文件位置无效");
    }
}

export async function testFtpConnection() {
    ensureSupported();
    await FtpBackup.testConnection(getFtpBackupOptions());
}

export async function backupToFtp() {
    ensureSupported();
    const options = getFtpBackupOptions();
    const localPath = cacheFilePath("musicfree-ftp-backup");
    try {
        await writeInChunks(localPath, Backup.backup());
        return await FtpBackup.uploadBackup(options, localPath);
    } finally {
        await removeCacheFile(localPath);
    }
}

export async function resumeFromFtp(
    resumeMode: ResumeMode = ResumeMode.Append,
) {
    ensureSupported();
    const options = getFtpBackupOptions();
    let downloadedPath: string | undefined;
    try {
        const result = await FtpBackup.downloadBackup(options);
        downloadedPath = result.path;
        assertDownloadedCachePath(downloadedPath);
        const raw = await RNFS.readFile(downloadedPath, "utf8");
        if (raw.includes("\uFFFD")) {
            throw ftpError("FTP_DOWNLOAD_FAILED", "FTP 备份文件不是有效的 UTF-8 文本");
        }
        const payload = parseBackupPayload(raw);
        return await Backup.resume(payload, resumeMode);
    } finally {
        if (downloadedPath && isDownloadedCachePath(downloadedPath)) {
            await removeCacheFile(downloadedPath);
        }
    }
}

export function cancelFtpOperation() {
    FtpBackup.cancelPendingOperation();
}

const FtpBackupService = {
    isSupported: FtpBackup.isSupported,
    getOptions: getFtpBackupOptions,
    testConnection: testFtpConnection,
    backup: backupToFtp,
    resume: resumeFromFtp,
    cancel: cancelFtpOperation,
};

export default FtpBackupService;
