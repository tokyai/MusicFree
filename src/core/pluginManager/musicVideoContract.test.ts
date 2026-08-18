import { describe, expect, it, jest } from "@jest/globals";

jest.mock("react-native-url-polyfill", () => ({
    URL: (globalThis as any).URL,
}));

import { normalizeMusicVideoResult } from "./musicVideoContract";

describe("normalizeMusicVideoResult", () => {
    it("normalizes, deduplicates and orders playable sources", () => {
        expect(
            normalizeMusicVideoResult({
                id: "mv-1",
                title: " Song ",
                artist: "Artist",
                artwork: "https://example.com/cover.jpg",
                sources: [
                    {
                        quality: "720P",
                        height: 720,
                        url: "https://example.com/720.mp4",
                        headers: {
                            Referer: "https://example.com/",
                            Invalid: 2,
                        },
                    },
                    {
                        quality: "1080P",
                        height: 1080.4,
                        url: "http://example.com/1080.mp4",
                    },
                    {
                        quality: "duplicate",
                        height: 720,
                        url: "https://example.com/other.mp4",
                    },
                ],
            }),
        ).toEqual({
            id: "mv-1",
            title: "Song",
            artist: "Artist",
            artwork: "https://example.com/cover.jpg",
            sources: [
                {
                    quality: "1080P",
                    height: 1080,
                    url: "http://example.com/1080.mp4",
                },
                {
                    quality: "720P",
                    height: 720,
                    url: "https://example.com/720.mp4",
                    headers: { Referer: "https://example.com/" },
                },
            ],
        });
    });

    it.each([
        null,
        {},
        { id: "", sources: [] },
        { id: "mv", sources: [] },
        {
            id: "mv",
            sources: [{ height: 720, url: "file:///video.mp4" }],
        },
        {
            id: "mv",
            sources: [{ height: 0, url: "https://example.com/video.mp4" }],
        },
    ])("rejects an invalid result %#", value => {
        expect(normalizeMusicVideoResult(value)).toBeNull();
    });
});
