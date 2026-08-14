import { describe, expect, it } from "@jest/globals";
import {
    getRecognitionSegmentStart,
    isBilibiliMediaItem,
    parseNeteaseRecognitionTime,
    parseRecognitionTimecode,
} from "./bilibiliRecognitionUtils";

const mediaItem = (platform: string): IMusic.IMusicItem => ({
    id: "1",
    platform,
    title: "song",
    artist: "artist",
    album: "",
    artwork: "",
    duration: 100,
});

describe("bilibili recognition helpers", () => {
    it("detects Bilibili media metadata", () => {
        expect(isBilibiliMediaItem(mediaItem("QingBili"))).toBe(true);
        expect(isBilibiliMediaItem(mediaItem("青B站"))).toBe(true);
        expect(isBilibiliMediaItem(mediaItem("QQ"))).toBe(false);
    });

    it("parses AudD timecodes", () => {
        expect(parseRecognitionTimecode("01:02")).toBe(62);
        expect(parseRecognitionTimecode("01:02:03")).toBe(3723);
        expect(parseRecognitionTimecode("invalid")).toBeNull();
        expect(parseRecognitionTimecode("01:60")).toBeNull();
    });

    it("calculates the long-video song start", () => {
        expect(getRecognitionSegmentStart(602, 2)).toBe(600);
    });

    it("normalizes Netease recognition offsets", () => {
        expect(parseNeteaseRecognitionTime(62.5)).toBe(62.5);
        expect(parseNeteaseRecognitionTime(62_500)).toBe(62.5);
        expect(parseNeteaseRecognitionTime("01:02")).toBe(62);
        expect(parseNeteaseRecognitionTime(-1)).toBeNull();
    });
});
