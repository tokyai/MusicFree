import { describe, expect, it, jest } from "@jest/globals";

const commonConstants = {
    SortType: {
        None: "None",
        Title: "title",
        Artist: "artist",
        Album: "album",
        Newest: "time",
        Oldest: "time-rev",
    },
    internalSerializeKey: "$",
    localPluginPlatform: "本地",
};
jest.mock("@/constants/commonConst.ts", () => commonConstants);
jest.mock("@/constants/commonConst", () => commonConstants);
jest.mock("@/utils/mediaUtils", () => ({
    isSameMediaItem: (left: ICommon.IMediaBase, right: ICommon.IMediaBase) =>
        left?.platform === right?.platform && left?.id === right?.id,
}));
jest.mock("@/utils/mediaUtils.ts", () => ({
    isSameMediaItem: (left: ICommon.IMediaBase, right: ICommon.IMediaBase) =>
        left?.platform === right?.platform && left?.id === right?.id,
}));

import SortedMusicList from "./sortedMusicList";

function music(id: string, platform = "source"): IMusic.IMusicItem {
    return {
        id,
        platform,
        title: id,
        artist: "Artist",
        album: "Album",
        artwork: "",
        duration: 100,
    };
}

describe("SortedMusicList source replacement", () => {
    it("rebuilds identity indexes without changing order", () => {
        const first = music("first");
        const second = music("second");
        const replacement = music("replacement", "target");
        const list = new SortedMusicList([first, second], undefined, true);

        expect(
            list.replace([{ original: first, replacement }]),
        ).toBe(1);
        expect(list.musicList.map(item => `${item.platform}@${item.id}`)).toEqual([
            "target@replacement",
            "source@second",
        ]);
        expect(list.has(first)).toBe(false);
        expect(list.has(replacement)).toBe(true);
    });

    it("rejects an existing or repeated target identity", () => {
        const first = music("first");
        const second = music("second");
        const list = new SortedMusicList([first, second], undefined, true);

        expect(
            list.replace([
                { original: first, replacement: second },
                { original: second, replacement: music("new", "target") },
            ]),
        ).toBe(1);
        expect(list.musicList[0]).toEqual(first);
        expect(list.musicList[1].platform).toBe("target");
    });
});
