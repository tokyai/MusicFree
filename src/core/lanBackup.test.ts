import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { ResumeMode } from "@/constants/commonConst";

jest.mock("react-native-reanimated", () => ({
    Easing: {
        exp: () => 0,
        out: (value: unknown) => value,
    },
}));

const mockBackup = jest.fn(() => "backup-json");
const mockResume = jest.fn(async () => undefined);
const mockParseBackupPayload = jest.fn((raw: unknown) => ({
    musicSheets: [],
    plugins: [],
    raw,
}));
const mockStartServer = jest.fn(async (options: unknown) => ({
    url: "http://192.168.1.8:12345/?token=test",
    expiresAt: 123456,
    mode: (options as { mode: "backup" | "restore" }).mode,
}));
const mockWaitForTransfer = jest.fn(
    async (): Promise<{ bytes: number; payload?: string }> => ({ bytes: 11 }),
);
const mockStopServer = jest.fn();
let mockIsSupported = true;

jest.mock("@/core/backup", () => ({
    __esModule: true,
    default: {
        backup: (...args: Parameters<typeof mockBackup>) => mockBackup(...args),
        resume: (...args: Parameters<typeof mockResume>) => mockResume(...args),
    },
    parseBackupPayload: (...args: Parameters<typeof mockParseBackupPayload>) =>
        mockParseBackupPayload(...args),
}));

jest.mock("@/native/lanBackup", () => ({
    __esModule: true,
    default: {
        get isSupported() {
            return mockIsSupported;
        },
        startServer: (...args: Parameters<typeof mockStartServer>) =>
            mockStartServer(...args),
        waitForTransfer: (...args: Parameters<typeof mockWaitForTransfer>) =>
            mockWaitForTransfer(...args),
        stopServer: () => mockStopServer(),
    },
}));

import {
    cancelLanBackup,
    startLanBackup,
    startLanResume,
} from "./lanBackup";

beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupported = true;
    mockBackup.mockReturnValue("backup-json");
    mockResume.mockResolvedValue(undefined);
    mockParseBackupPayload.mockImplementation(raw => ({
        musicSheets: [],
        plugins: [],
        raw,
    }));
    mockStartServer.mockImplementation(async options => ({
        url: "http://192.168.1.8:12345/?token=test",
        expiresAt: 123456,
        mode: (options as { mode: "backup" | "restore" }).mode,
    }));
    mockWaitForTransfer.mockResolvedValue({ bytes: 11 });
});

describe("LAN backup lifecycle", () => {
    it("starts a one-shot backup with the current backup JSON", async () => {
        const session = await startLanBackup();

        expect(mockStartServer).toHaveBeenCalledWith({
            mode: "backup",
            backupJson: "backup-json",
        });
        await expect(session.transfer).resolves.toEqual({ bytes: 11 });
        expect(mockWaitForTransfer).toHaveBeenCalledTimes(1);
    });

    it("validates an upload before restoring with the selected mode", async () => {
        mockWaitForTransfer.mockResolvedValueOnce({
            bytes: 18,
            payload: "restore-json",
        });

        const session = await startLanResume(ResumeMode.OverwriteDefault);
        await expect(session.transfer).resolves.toMatchObject({ bytes: 18 });

        expect(mockStartServer).toHaveBeenCalledWith({ mode: "restore" });
        expect(mockParseBackupPayload).toHaveBeenCalledWith("restore-json");
        expect(mockResume).toHaveBeenCalledWith(
            expect.objectContaining({ musicSheets: [], plugins: [] }),
            ResumeMode.OverwriteDefault,
        );
    });

    it("does not restore an invalid upload", async () => {
        mockWaitForTransfer.mockResolvedValueOnce({
            bytes: 4,
            payload: "nope",
        });
        mockParseBackupPayload.mockImplementationOnce(() => {
            throw new Error("invalid backup");
        });

        const session = await startLanResume();
        await expect(session.transfer).rejects.toMatchObject({
            code: "LAN_INVALID_BACKUP",
        });
        expect(mockResume).not.toHaveBeenCalled();
    });

    it("rejects a restore result without a payload", async () => {
        const session = await startLanResume();

        await expect(session.transfer).rejects.toMatchObject({
            code: "LAN_INVALID_BACKUP",
        });
        expect(mockParseBackupPayload).not.toHaveBeenCalled();
        expect(mockResume).not.toHaveBeenCalled();
    });

    it("forwards cancellation to the native one-shot server", () => {
        cancelLanBackup();
        expect(mockStopServer).toHaveBeenCalledTimes(1);
    });

    it("rejects before serializing when the native bridge is unavailable", async () => {
        mockIsSupported = false;

        await expect(startLanBackup()).rejects.toMatchObject({
            code: "LAN_UNSUPPORTED",
        });
        expect(mockBackup).not.toHaveBeenCalled();
        expect(mockStartServer).not.toHaveBeenCalled();
    });
});
