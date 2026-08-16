import { describe, expect, it } from "@jest/globals";
import {
    DisplaySplitPreset,
    getDisplayMetrics,
    getDisplayOverlayWidth,
    normalizeCarDisplayFontSize,
    resolveDisplaySplitWeights,
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

    it.each([
        ["medium", 18, 56],
        ["large", 20, 64],
    ] as Array<["medium" | "large", number, number]>) (
        "keeps the 731dp landscape car rail readable at the %s tier",
        (tier, minimumSubtitleSize, minimumTouchTarget) => {
            const metrics = getDisplayMetrics(1280, 731, true, tier);

            expect(metrics.fontSizes.subTitle).toBeGreaterThanOrEqual(
                minimumSubtitleSize,
            );
            expect(metrics.navigationItemHeight).toBeGreaterThanOrEqual(
                minimumTouchTarget,
            );
            expect(metrics.horizontalPadding).toBeGreaterThan(0);
        },
    );

    it("keeps phone landscape metrics independent from the car rail tier", () => {
        const medium = getDisplayMetrics(1280, 731, false, "medium");
        const large = getDisplayMetrics(1280, 731, false, "large");

        expect(medium.minTouchTarget).toBe(0);
        expect(large.minTouchTarget).toBe(0);
        expect(large.fontSizes.subTitle).toBe(medium.fontSizes.subTitle);
    });

    it("keeps all lyric selections distinct and above the selected tier minimum", () => {
        const metrics = getDisplayMetrics(360, 640, true, "large");

        expect(metrics.lyricFontSizes).toEqual([20, 22, 24, 28]);
    });

    it("does not let a minimum overlay width exceed available width", () => {
        expect(getDisplayOverlayWidth("panel", 300)).toBe(300);
        expect(getDisplayOverlayWidth("dialog", 1920)).toBe(960);
        expect(getDisplayOverlayWidth("drawer", 1920)).toBe(420);
    });

    it.each([
        ["navigation", 24, 76],
        ["home", 28, 72],
        ["metadata", 30, 70],
        ["player", 42, 58],
        ["secondaryActions", 74, 26],
        ["balanced", 50, 50],
    ] as Array<[DisplaySplitPreset, number, number]>) (
        "resolves the %s car split",
        (preset, primary, secondary) => {
            expect(resolveDisplaySplitWeights(preset, true)).toEqual({
                primary,
                secondary,
            });
        },
    );

    it("keeps explicit phone split weights when car mode is disabled", () => {
        expect(resolveDisplaySplitWeights("navigation", false, 62, 38)).toEqual({
            primary: 62,
            secondary: 38,
        });
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
