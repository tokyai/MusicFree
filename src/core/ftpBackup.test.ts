import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";

import { ResumeMode } from "@/constants/commonConst";

jest.mock("react-native-reanimated", () => ({
    Easing: {
        exp: () => 0,
        out: (value: unknown) => value,
    },
}));

const mockConfigValues: Record<string, unknown> = {};
const mockGetConfig = jest.fn((key: string) => mockConfigValues[key]);
const mockBackup = jest.fn(() => "backup-json");
const mockResume = jest.fn(async () => undefined);
const mockParseBackupPayload = jest.fn((raw: unknown) => ({
    musicSheets: [],
    plugins: [],
    raw,
}));
const mockExists = jest.fn(async () => true);
const mockUnlink = jest.fn(async () => undefined);
const mockReadFile = jest.fn(async () => "valid-json");
const mockWriteInChunks = jest.fn(async () => undefined);
const mockTestConnection = jest.fn(async () => undefined);
const mockUploadBackup = jest.fn(async () => ({ bytes: 11 }));
const mockDownloadBackup = jest.fn(async () => ({
    path: "/cache/restore.json",
    bytes: 10,
}));
const mockCancelPendingOperation = jest.fn();
let mockIsSupported = true;

jest.mock("react-native-fs", () => ({
    __esModule: true,
    CachesDirectoryPath: "/cache",
    default: {
        exists: (...args: Parameters<typeof mockExists>) => mockExists(...args),
        unlink: (...args: Parameters<typeof mockUnlink>) => mockUnlink(...args),
        readFile: (...args: Parameters<typeof mockReadFile>) =>
            mockReadFile(...args),
    },
}));

jest.mock("@/core/appConfig", () => ({
    __esModule: true,
    default: {
        getConfig: (...args: Parameters<typeof mockGetConfig>) =>
            mockGetConfig(...args),
    },
}));

jest.mock("@/core/backup", () => ({
    __esModule: true,
    default: {
        backup: (...args: Parameters<typeof mockBackup>) => mockBackup(...args),
        resume: (...args: Parameters<typeof mockResume>) => mockResume(...args),
    },
    parseBackupPayload: (...args: Parameters<typeof mockParseBackupPayload>) =>
        mockParseBackupPayload(...args),
}));

jest.mock("@/native/ftpBackup", () => ({
    __esModule: true,
    default: {
        get isSupported() {
            return mockIsSupported;
        },
        testConnection: (...args: Parameters<typeof mockTestConnection>) =>
            mockTestConnection(...args),
        uploadBackup: (...args: Parameters<typeof mockUploadBackup>) =>
            mockUploadBackup(...args),
        downloadBackup: (...args: Parameters<typeof mockDownloadBackup>) =>
            mockDownloadBackup(...args),
        cancelPendingOperation: () => mockCancelPendingOperation(),
    },
}));

jest.mock("@/utils/fileUtils.ts", () => ({
    writeInChunks: (...args: Parameters<typeof mockWriteInChunks>) =>
        mockWriteInChunks(...args),
}));

import {
    FTP_CONNECT_TIMEOUT_MS,
    FTP_DEFAULT_DIRECTORY,
    FTP_DEFAULT_PORT,
    FTP_READ_TIMEOUT_MS,
    backupToFtp,
    cancelFtpOperation,
    normalizeFtpBackupOptions,
    resumeFromFtp,
    testFtpConnection,
} from "./ftpBackup";

const requiredSettings = {
    host: "ftp.example.com",
    username: "musicfree",
    password: "secret",
};

beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockConfigValues).forEach(key => delete mockConfigValues[key]);
    Object.assign(mockConfigValues, {
        "ftp.mode": undefined,
        "ftp.host": requiredSettings.host,
        "ftp.port": undefined,
        "ftp.username": requiredSettings.username,
        "ftp.password": requiredSettings.password,
        "ftp.remoteDirectory": undefined,
    });
    mockIsSupported = true;
    mockExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue("valid-json");
    mockWriteInChunks.mockResolvedValue(undefined);
    mockTestConnection.mockResolvedValue(undefined);
    mockUploadBackup.mockResolvedValue({ bytes: 11 });
    mockDownloadBackup.mockResolvedValue({
        path: "/cache/restore.json",
        bytes: 10,
    });
    mockResume.mockResolvedValue(undefined);
    mockParseBackupPayload.mockImplementation(raw => ({
        musicSheets: [],
        plugins: [],
        raw,
    }));
});

afterEach(() => {
    mockIsSupported = true;
});

describe("FTP backup configuration", () => {
    it("uses FTPS, port 21 and /MusicFree by default", () => {
        expect(normalizeFtpBackupOptions(requiredSettings)).toEqual({
            mode: "ftps",
            host: "ftp.example.com",
            port: FTP_DEFAULT_PORT,
            username: "musicfree",
            password: "secret",
            remoteDirectory: FTP_DEFAULT_DIRECTORY,
            connectTimeoutMs: FTP_CONNECT_TIMEOUT_MS,
            readTimeoutMs: FTP_READ_TIMEOUT_MS,
        });
    });

    it("keeps an explicitly selected plain FTP mode", () => {
        expect(
            normalizeFtpBackupOptions({
                ...requiredSettings,
                mode: "ftp",
                port: 2121,
                remoteDirectory: "/backups/musicfree/",
            }),
        ).toMatchObject({
            mode: "ftp",
            port: 2121,
            remoteDirectory: "/backups/musicfree",
        });
    });

    it.each([
        [{ ...requiredSettings, host: "ftp://example.com" }, "host"],
        [{ ...requiredSettings, port: 0 }, "port"],
        [{ ...requiredSettings, port: 21.5 }, "port"],
        [{ ...requiredSettings, remoteDirectory: "relative/path" }, "directory"],
        [{ ...requiredSettings, remoteDirectory: "/backup/../private" }, "directory"],
        [{ ...requiredSettings, username: "" }, "credentials"],
    ])("rejects invalid settings before native work", (settings, configField) => {
        expect(() => normalizeFtpBackupOptions(settings)).toThrow();
        try {
            normalizeFtpBackupOptions(settings);
        } catch (error) {
            expect(error).toMatchObject({
                code: "FTP_INVALID_CONFIG",
                configField,
            });
        }
    });
});

describe("FTP backup lifecycle", () => {
    it("preserves native error codes", async () => {
        mockTestConnection.mockRejectedValueOnce(
            Object.assign(new Error("authentication failed"), {
                code: "FTP_AUTH_FAILED",
            }),
        );

        await expect(testFtpConnection()).rejects.toMatchObject({
            code: "FTP_AUTH_FAILED",
        });
    });

    it("removes the staged upload file after a failed transfer", async () => {
        mockUploadBackup.mockRejectedValueOnce(
            Object.assign(new Error("upload failed"), {
                code: "FTP_UPLOAD_FAILED",
            }),
        );

        await expect(backupToFtp()).rejects.toMatchObject({
            code: "FTP_UPLOAD_FAILED",
        });
        expect(mockWriteInChunks).toHaveBeenCalledWith(
            expect.stringMatching(/^\/cache\/musicfree-ftp-backup-/),
            "backup-json",
        );
        expect(mockUnlink).toHaveBeenCalledWith(
            expect.stringMatching(/^\/cache\/musicfree-ftp-backup-/),
        );
    });

    it("validates a download before restore and always removes it", async () => {
        mockParseBackupPayload.mockImplementationOnce(() => {
            throw new Error("invalid backup");
        });

        await expect(resumeFromFtp()).rejects.toThrow("invalid backup");
        expect(mockResume).not.toHaveBeenCalled();
        expect(mockUnlink).toHaveBeenCalledWith("/cache/restore.json");
    });

    it("passes the selected restore mode after validation", async () => {
        await resumeFromFtp(ResumeMode.OverwriteDefault);

        expect(mockParseBackupPayload).toHaveBeenCalledWith("valid-json");
        expect(mockResume).toHaveBeenCalledWith(
            expect.objectContaining({ musicSheets: [], plugins: [] }),
            ResumeMode.OverwriteDefault,
        );
        expect(mockUnlink).toHaveBeenCalledWith("/cache/restore.json");
    });

    it("does not unlink a path outside the application cache", async () => {
        mockDownloadBackup.mockResolvedValueOnce({
            path: "/storage/shared/other.json",
            bytes: 10,
        });

        await expect(resumeFromFtp()).rejects.toMatchObject({
            code: "FTP_DOWNLOAD_FAILED",
        });
        expect(mockUnlink).not.toHaveBeenCalled();
    });

    it("forwards cancellation to the native transport", () => {
        cancelFtpOperation();
        expect(mockCancelPendingOperation).toHaveBeenCalledTimes(1);
    });

    it("rejects before staging when the native bridge is unavailable", async () => {
        mockIsSupported = false;

        await expect(backupToFtp()).rejects.toMatchObject({
            code: "FTP_UNSUPPORTED",
        });
        expect(mockWriteInChunks).not.toHaveBeenCalled();
    });
});
