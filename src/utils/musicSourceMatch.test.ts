import { describe, expect, it } from "@jest/globals";
import {
    getMusicSourceEditionTags,
    normalizeMusicSourceText,
    selectMusicSourceCandidate,
} from "./musicSourceMatch";

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

describe("music source matching", () => {
    it("normalizes width, punctuation and case", () => {
        expect(normalizeMusicSourceText(" Ｓｏｎｇ - A ")).toBe("songa");
    });

    it("rejects a different recording edition", () => {
        expect(getMusicSourceEditionTags(music({ title: "Song (Live)" }))).toEqual([
            "live",
        ]);
        const result = selectMusicSourceCandidate(
            music(),
            [music({ id: "live", title: "Song (Live)", duration: 205 })],
        );
        expect(result.reason).toBe("no-match");
    });

    it("matches edition markers only when both recordings agree", () => {
        const result = selectMusicSourceCandidate(
            music({ title: "Song (Live)", duration: 205 }),
            [
                music({
                    id: "same-live",
                    platform: "target",
                    title: "Song 现场版",
                    duration: 205,
                }),
            ],
        );
        expect(result.reason).toBe("matched");
    });

    it("does not match the same title by another artist", () => {
        const result = selectMusicSourceCandidate(
            music(),
            [music({ id: "other", artist: "Other Artist" })],
        );
        expect(result.reason).toBe("no-match");
    });

    it("never treats a cross-platform ID as song identity", () => {
        const result = selectMusicSourceCandidate(
            music({ id: "shared-id" }),
            [
                music({
                    id: "shared-id",
                    platform: "target",
                    title: "Different Song",
                }),
            ],
        );
        expect(result.reason).toBe("no-match");
    });

    it("rejects duration differences outside the strict tolerance", () => {
        const result = selectMusicSourceCandidate(
            music({ duration: 200 }),
            [music({ id: "longer", platform: "target", duration: 209 })],
        );
        expect(result.reason).toBe("no-match");
    });

    it("rejects ambiguous equal candidates", () => {
        const result = selectMusicSourceCandidate(music(), [
            music({ id: "one", album: "Album A" }),
            music({ id: "two", album: "Album B" }),
        ]);
        expect(result.reason).toBe("ambiguous");
    });

    it("selects a clearly stronger candidate", () => {
        const result = selectMusicSourceCandidate(music(), [
            music({ id: "match" }),
            music({ id: "weak", title: "Song Other", duration: 240 }),
        ]);
        expect(result.reason).toBe("matched");
        expect(result.match?.item.id).toBe("match");
    });
});
