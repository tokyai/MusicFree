import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("react-native-reanimated", () => ({
    Easing: {
        exp: () => 0,
        out: (value: unknown) => value,
    },
}));

const mockGetEnabledPlugins = jest.fn(() => []);
const mockInstallPluginFromUrl = jest.fn(async () => undefined);
const mockResumeSheets = jest.fn(async () => undefined);

jest.mock("./pluginManager", () => ({
    __esModule: true,
    default: {
        getEnabledPlugins: mockGetEnabledPlugins,
        installPluginFromUrl: mockInstallPluginFromUrl,
    },
}));

jest.mock("@/core/musicSheet", () => ({
    __esModule: true,
    default: {
        backupSheets: jest.fn(() => []),
        resumeSheets: mockResumeSheets,
    },
}));

import Backup, { parseBackupPayload } from "./backup";

const validBackup = {
    musicSheets: [
        {
            id: "sheet-1",
            platform: "本地",
            title: "歌单",
            musicList: [],
        },
    ],
    plugins: [
        {
            srcUrl: "https://example.com/plugin.js",
            version: "1.0.0",
        },
    ],
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe("backup payload validation", () => {
    it("parses a valid JSON payload", () => {
        expect(parseBackupPayload(JSON.stringify(validBackup))).toEqual(
            validBackup,
        );
    });

    it.each([
        ["not json"],
        [JSON.stringify(null)],
        [JSON.stringify({ musicSheets: [] })],
        [JSON.stringify({ musicSheets: [], plugins: [{}] })],
        [JSON.stringify({ musicSheets: [{}], plugins: [] })],
        [
            JSON.stringify({
                musicSheets: [],
                plugins: [{ srcUrl: "https://example.com/plugin.js", version: 1 }],
            }),
        ],
    ])("rejects invalid backup data", raw => {
        expect(() => parseBackupPayload(raw)).toThrow();
    });

    it("does not start restore side effects for an invalid payload", async () => {
        await expect(
            Backup.resume(JSON.stringify({ musicSheets: [{}], plugins: [] })),
        ).rejects.toThrow("备份文件中的歌单数据无效");

        expect(mockGetEnabledPlugins).not.toHaveBeenCalled();
        expect(mockInstallPluginFromUrl).not.toHaveBeenCalled();
        expect(mockResumeSheets).not.toHaveBeenCalled();
    });
});
