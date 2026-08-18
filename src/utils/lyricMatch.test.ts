import { describe, expect, it } from "@jest/globals";
import {
    getRecognizedSongIdentity,
    getLyricTextSimilarity,
    normalizeLyricMatchText,
    scoreLyricCandidate,
    scoreLyricSearchCandidate,
} from "./lyricMatch";

describe("lyric matching", () => {
    it("normalizes punctuation, whitespace and case", () => {
        expect(normalizeLyricMatchText("  Hello - World! ")).toBe(
            "helloworld!",
        );
    });

    it("uses the candidate title when scoring", () => {
        const exact = scoreLyricCandidate(
            { title: "Song A", artist: "Artist" },
            { title: "Song A", artist: "Artist" },
        );
        const different = scoreLyricCandidate(
            { title: "Song A", artist: "Artist" },
            { title: "Song B", artist: "Artist" },
        );
        expect(exact).toBe(0);
        expect(different).toBeGreaterThan(exact);
    });

    it("creates a stable recognized-song identity", () => {
        expect(
            getRecognizedSongIdentity({ title: "Song A", artist: "Artist" }),
        ).toBe("songa@artist");
    });

    it("scores search candidates as similarity from zero to one", () => {
        expect(getLyricTextSimilarity("Song A", "song-a")).toBe(1);
        expect(getLyricTextSimilarity("", "")).toBe(0);
        expect(
            scoreLyricSearchCandidate(
                "Song A",
                { title: "Song A", artist: "Artist", album: "Album" },
                { title: "Song A", artist: "Artist", album: "Album" },
            ),
        ).toBe(1);
    });
});
