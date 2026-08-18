import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/core/appConfig", () => ({ __esModule: true, default: {} }));
jest.mock("@/core/pluginManager", () => ({ __esModule: true, default: {} }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: {} }));
jest.mock("@/native/mpvVideo", () => ({
    isMpvVideoSupported: () => false,
}));
jest.mock("nanoid/non-secure", () => ({ nanoid: () => "generated-session" }));

import {
    findNextLowerMusicVideoSource,
    MusicVideoManager,
    selectPreferredMusicVideoSource,
} from "./musicVideoManager";

const musicItem: IMusic.IMusicItem = {
    id: "song-1",
    platform: "source",
    title: "Song",
    artist: "Artist",
    album: "Album",
    artwork: "",
    duration: 180,
};

const videoResult: IPlugin.IMusicVideoResult = {
    id: "mv-1",
    sources: [
        { quality: "4K", height: 2160, url: "https://example.com/4k.mp4" },
        { quality: "1080P", height: 1080, url: "https://example.com/1080.mp4" },
        { quality: "720P", height: 720, url: "https://example.com/720.mp4" },
    ],
};

function createManager(options?: {
    supported?: boolean;
    result?: IPlugin.IMusicVideoResult | null;
    defaultPlayer?: "exo" | "mpv";
    mpvSupported?: boolean;
}) {
    let currentMusic: IMusic.IMusicItem | null = musicItem;
    let playing = true;
    const pause = jest.fn(async () => {
        playing = false;
    });
    const play = jest.fn(async () => {
        playing = true;
    });
    const values = new Map<string, unknown>([
        ["mv.defaultPlayer", options?.defaultPlayer ?? "exo"],
        ["mv.preferredHeight", 1080],
    ]);
    const setConfig = jest.fn((key: string, value: unknown) => {
        values.set(key, value);
    });
    const getMusicVideo = jest.fn(async () =>
        options?.result === undefined ? videoResult : options.result,
    );

    const manager = new MusicVideoManager({
        config: {
            getConfig: (key: string) => values.get(key),
            setConfig,
        } as any,
        pluginManager: {
            getByMedia: () => ({
                supportedMethods: new Set(
                    options?.supported === false ? [] : ["getMusicVideo"],
                ),
                methods: { getMusicVideo },
            }) as any,
        },
        trackPlayer: {
            get currentMusic() {
                return currentMusic;
            },
            isCurrentMusic: item =>
                !!item &&
                item.id === currentMusic?.id &&
                item.platform === currentMusic?.platform,
            isPlaying: async () => playing,
            pause,
            play,
        },
        isMpvSupported: () => options?.mpvSupported ?? false,
        createSessionId: () => "session-1",
    });

    return {
        manager,
        pause,
        play,
        setConfig,
        setCurrentMusic: (value: IMusic.IMusicItem | null) => {
            currentMusic = value;
        },
    };
}

describe("musicVideoManager", () => {
    it("selects the best source at or below the preferred height", () => {
        expect(selectPreferredMusicVideoSource(videoResult.sources, 1080)).toBe(1);
        expect(selectPreferredMusicVideoSource(videoResult.sources, 360)).toBe(2);
    });

    it("finds an untried lower source", () => {
        expect(findNextLowerMusicVideoSource(videoResult.sources, 0, [0, 1])).toBe(2);
        expect(findNextLowerMusicVideoSource(videoResult.sources, 2, [2])).toBeNull();
    });

    it("pauses only after a video is found and restores the same song", async () => {
        const { manager, pause, play } = createManager({
            defaultPlayer: "mpv",
            mpvSupported: false,
        });

        const prepared = await manager.prepareSession(musicItem);
        expect(prepared.status).toBe("ready");
        expect(pause).toHaveBeenCalledTimes(1);
        expect(manager.session?.sourceIndex).toBe(1);
        expect(manager.session?.player).toBe("exo");

        await manager.closeSession("session-1");
        expect(play).toHaveBeenCalledTimes(1);
        expect(manager.session).toBeNull();
    });

    it("does not pause when the current platform has no MV", async () => {
        const { manager, pause } = createManager({ result: null });
        await expect(manager.prepareSession(musicItem)).resolves.toEqual({
            status: "unavailable",
        });
        expect(pause).not.toHaveBeenCalled();
    });

    it("does not restore audio after the current song changes", async () => {
        const { manager, play, setCurrentMusic } = createManager();
        await manager.prepareSession(musicItem);
        setCurrentMusic({ ...musicItem, id: "song-2" });

        await manager.closeSession("session-1");
        expect(play).not.toHaveBeenCalled();
    });

    it("persists manual quality but keeps engine switching session-only", async () => {
        const { manager, setConfig } = createManager({ mpvSupported: true });
        await manager.prepareSession(musicItem);

        expect(manager.selectSource("session-1", 2)).toBe(true);
        expect(setConfig).toHaveBeenCalledWith("mv.preferredHeight", 720);
        expect(manager.switchSessionPlayer("session-1")).toBe("mpv");
        expect(setConfig).not.toHaveBeenCalledWith("mv.defaultPlayer", "mpv");

        await manager.closeSession("session-1");
    });
});
