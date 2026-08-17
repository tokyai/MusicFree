import { describe, expect, it, jest } from "@jest/globals";

const mockGetConfig = jest.fn((key: string) => {
    if (key === "basic.defaultPlayQuality") {
        return "standard";
    }
    if (key === "basic.playQualityOrder") {
        return "asc";
    }
    return undefined;
});

jest.mock("@/core/appConfig", () => ({
    __esModule: true,
    default: { getConfig: jest.fn((key: string) => mockGetConfig(key)) },
}));
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: { getSortedSearchablePlugins: jest.fn() },
    Plugin: class Plugin {},
    PluginState: { Error: 3 },
}));
jest.mock("@/utils/log", () => ({
    devLog: jest.fn(),
}));
jest.mock("@/utils/qualities", () => ({
    getQualityOrder: () => ["standard"],
}));
jest.mock("@/utils/mediaUtils", () => ({
    getMediaUniqueKey: (item: IMusic.IMusicItem) =>
        `${item.platform}@${item.id}`,
}));

import {
    batchSwitchMusicSources,
    getSourceSwitchPlugins,
} from "./musicSourceSwitcher";

const mockPluginManager = (
    jest.requireMock("@/core/pluginManager") as {
        default: { getSortedSearchablePlugins: jest.Mock };
    }
).default;

function music(overrides: Partial<IMusic.IMusicItem> = {}): IMusic.IMusicItem {
    return {
        id: "source-id",
        platform: "source",
        title: "Song",
        artist: "Artist",
        album: "Album",
        artwork: "",
        duration: 200,
        ...overrides,
    };
}

function plugin(search: any, getMediaSource: any = jest.fn(async () => null)) {
    return {
        name: "target",
        hash: "target-hash",
        state: 2,
        methods: {
            search,
            getMediaSource,
        },
    } as any;
}

describe("music source switcher", () => {
    it("tries a lower-ranked playable candidate after the best one fails", async () => {
        const search = jest.fn(async () => ({
            data: [
                music({ id: "unavailable", platform: "target", url: undefined }),
                music({
                    id: "playable",
                    platform: "target",
                    duration: 207.9,
                    url: "https://example.com/song.mp3",
                }),
            ],
        }));
        const getMediaSource = jest.fn(async () => null);
        const targetPlugin = plugin(search, getMediaSource);

        const result = await batchSwitchMusicSources({
            musicItems: [music()],
            existingMusicItems: [music()],
            targetPlugin,
        });

        expect(result.cancelled).toBe(false);
        expect(result.replacements[0]?.replacement.id).toBe("playable");
        expect(getMediaSource).toHaveBeenCalled();
    });

    it("rechecks ambiguity after an unavailable candidate is removed", async () => {
        const search = jest.fn(async () => ({
            data: [
                music({ id: "unavailable", platform: "target" }),
                music({
                    id: "candidate-one",
                    platform: "target",
                    duration: 207,
                    url: "https://example.com/one.mp3",
                }),
                music({
                    id: "candidate-two",
                    platform: "target",
                    duration: 207.2,
                    url: "https://example.com/two.mp3",
                }),
            ],
        }));
        const result = await batchSwitchMusicSources({
            musicItems: [music()],
            existingMusicItems: [],
            targetPlugin: plugin(search),
        });

        expect(result.replacements).toHaveLength(0);
        expect(result.failures[0]?.reason).toBe("ambiguous");
    });

    it("treats malformed search data as an empty result", async () => {
        const search = jest.fn(async () => ({
            data: { invalid: true },
        } as any));
        const result = await batchSwitchMusicSources({
            musicItems: [music()],
            existingMusicItems: [],
            targetPlugin: plugin(search),
        });

        expect(result.replacements).toHaveLength(0);
        expect(result.failures).toEqual([
            { musicItem: music(), reason: "no-match" },
        ]);
    });

    it("keeps an invalid legacy favorite as a failed item", async () => {
        const search = jest.fn();
        const invalidMusic = music({ title: "" });
        const result = await batchSwitchMusicSources({
            musicItems: [invalidMusic],
            existingMusicItems: [invalidMusic],
            targetPlugin: plugin(search),
            concurrency: Number.NaN,
        });

        expect(result.failures).toEqual([
            { musicItem: invalidMusic, reason: "no-match" },
        ]);
        expect(result.replacements).toHaveLength(0);
        expect(search).not.toHaveBeenCalled();
    });

    it("does not start a search after cancellation", async () => {
        const search = jest.fn();
        const controller = new AbortController();
        controller.abort();
        const result = await batchSwitchMusicSources({
            musicItems: [music()],
            existingMusicItems: [],
            targetPlugin: plugin(search),
            signal: controller.signal,
        });

        expect(result.cancelled).toBe(true);
        expect(search).not.toHaveBeenCalled();
        expect(result.replacements).toHaveLength(0);
    });

    it("excludes plugins in an error state", () => {
        const healthyPlugin = { name: "healthy", state: 2 };
        const brokenPlugin = { name: "broken", state: 3 };
        mockPluginManager.getSortedSearchablePlugins.mockReturnValueOnce([
            healthyPlugin,
            brokenPlugin,
        ]);

        expect(getSourceSwitchPlugins()).toEqual([healthyPlugin]);
    });
});
