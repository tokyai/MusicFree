import { describe, expect, it } from "@jest/globals";
import {
    getDisplayMetrics,
    getDisplayOverlayWidth,
    normalizeCarDisplayFontSize,
} from "./displayMetrics";

describe("display metrics", () => {
    it("keeps the legacy scale when car mode is disabled", () => {
        const metrics = getDisplayMetrics(360, 640, false, "large");

        expect(metrics.isCarMode).toBe(false);
        expect(metrics.fontSizes.content).toBeCloseTo((28 / 750) * 360);
        expect(metrics.minTouchTarget).toBe(0);
    });

    it.each([
        [360, "medium", 18, 22, 56],
        [480, "large", 20, 24, 64],
        [600, "medium", 22.4, 25.6, 56],
    ] as Array<[number, "medium" | "large", number, number, number]>)(
        "applies tier lower bounds at %ddp",
        (shortEdge, tier, content, title, touchTarget) => {
            const metrics = getDisplayMetrics(shortEdge, shortEdge, true, tier);

            expect(metrics.fontSizes.content).toBeGreaterThanOrEqual(content);
            expect(metrics.fontSizes.title + 0.000001).toBeGreaterThanOrEqual(
                title,
            );
            expect(metrics.minTouchTarget).toBe(touchTarget);
            expect(metrics.listItemHeights.small).toBeGreaterThanOrEqual(
                touchTarget,
            );
        },
    );

    it("keeps all lyric selections distinct and above the selected tier minimum", () => {
        const metrics = getDisplayMetrics(360, 640, true, "large");

        expect(metrics.lyricFontSizes).toEqual([20, 22, 24, 28]);
    });

    it("does not let a minimum overlay width exceed available width", () => {
        expect(getDisplayOverlayWidth("panel", 400)).toBe(400);
        expect(getDisplayOverlayWidth("dialog", 1920)).toBe(1152);
        expect(getDisplayOverlayWidth("drawer", 1920)).toBe(640);
    });

    it("falls back to safe dimensions instead of producing NaN styles", () => {
        const metrics = getDisplayMetrics(
            Number.NaN,
            0,
            true,
            normalizeCarDisplayFontSize("invalid"),
        );

        expect(metrics.width).toBe(1);
        expect(metrics.height).toBe(1);
        expect(metrics.shortEdge).toBe(1);
        expect(metrics.fontTier).toBe("medium");
        expect(Number.isFinite(metrics.fontSizes.content)).toBe(true);
    });
});
