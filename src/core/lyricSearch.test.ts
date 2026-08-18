import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/utils/log", () => ({ devLog: jest.fn() }));

import { rankLyricSearchCandidates } from "./lyricSearch";

const currentMusic: IMusic.IMusicItem = {
    id: "current",
    platform: "current-source",
    title: "夜曲",
    artist: "周杰伦",
    album: "十一月的萧邦",
    artwork: "",
    duration: 220,
};

function lyricItem(
    id: string,
    title: string,
    artist: string,
    album: string,
): ILyric.ILyricItem {
    return {
        id,
        platform: "source",
        title,
        artist,
        album,
        artwork: "",
        duration: 220,
    };
}

describe("rankLyricSearchCandidates", () => {
    it("ranks exact metadata above a title-only match", () => {
        const ranked = rankLyricSearchCandidates("夜曲", currentMusic, [
            {
                pluginHash: "one",
                pluginName: "One",
                pluginOrder: 0,
                items: [
                    lyricItem("wrong", "夜曲", "其他歌手", "其他专辑"),
                    lyricItem("exact", "夜曲", "周杰伦", "十一月的萧邦"),
                ],
            },
        ]);

        expect(ranked.map(item => item.musicItem.id)).toEqual([
            "exact",
            "wrong",
        ]);
        expect(ranked[0].relevance).toBeGreaterThan(ranked[1].relevance);
    });

    it("deduplicates identities and keeps stable source order for ties", () => {
        const duplicate = lyricItem("same", "夜曲", "周杰伦", "");
        const ranked = rankLyricSearchCandidates("夜曲", currentMusic, [
            {
                pluginHash: "one",
                pluginName: "One",
                pluginOrder: 0,
                items: [duplicate],
            },
            {
                pluginHash: "two",
                pluginName: "Two",
                pluginOrder: 1,
                items: [duplicate, lyricItem("other", "夜曲", "周杰伦", "")],
            },
        ]);

        expect(ranked.map(item => item.pluginHash)).toEqual(["one", "two"]);
        expect(ranked.map(item => item.musicItem.id)).toEqual(["same", "other"]);
    });

    it("drops malformed plugin items", () => {
        const ranked = rankLyricSearchCandidates("夜曲", currentMusic, [
            {
                pluginHash: "one",
                pluginName: "One",
                pluginOrder: 0,
                items: [{ id: "", platform: "source", title: "" } as any],
            },
        ]);
        expect(ranked).toEqual([]);
    });
});
