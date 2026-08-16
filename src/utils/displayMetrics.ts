export const carDisplayFontSizes = ["medium", "large"] as const;
export type CarDisplayFontSize = (typeof carDisplayFontSizes)[number];

export type DisplayFontKey =
    | "tag"
    | "description"
    | "subTitle"
    | "content"
    | "title"
    | "appbar";

export type DisplayIconKey = "small" | "light" | "normal" | "big" | "large";

export type DisplayListHeightKey =
    | "big"
    | "normal"
    | "small"
    | "smallest"
    | "none";

export type DisplayOverlayKind = "drawer" | "panel" | "dialog";

export type DisplaySplitPreset =
    | "navigation"
    | "home"
    | "metadata"
    | "player"
    | "secondaryActions"
    | "balanced";

export interface DisplaySplitWeights {
    primary: number;
    secondary: number;
}

export const displaySplitPresets: Record<
    DisplaySplitPreset,
    DisplaySplitWeights
> = {
    navigation: { primary: 24, secondary: 76 },
    home: { primary: 28, secondary: 72 },
    metadata: { primary: 30, secondary: 70 },
    player: { primary: 42, secondary: 58 },
    secondaryActions: { primary: 74, secondary: 26 },
    balanced: { primary: 50, secondary: 50 },
};

export function resolveDisplaySplitWeights(
    preset: DisplaySplitPreset | undefined,
    isCarMode: boolean,
    primaryWeight = 38,
    secondaryWeight = 62,
): DisplaySplitWeights {
    if (isCarMode && preset) {
        return displaySplitPresets[preset];
    }
    return {
        primary: primaryWeight,
        secondary: secondaryWeight,
    };
}

const FONT_RPX: Record<DisplayFontKey, number> = {
    tag: 20,
    description: 22,
    subTitle: 26,
    content: 28,
    title: 32,
    appbar: 36,
};

const ICON_RPX: Record<DisplayIconKey, number> = {
    small: 30,
    light: 36,
    normal: 42,
    big: 60,
    large: 72,
};

const LIST_HEIGHT_RPX: Record<Exclude<DisplayListHeightKey, "none">, number> = {
    big: 120,
    normal: 108,
    small: 96,
    smallest: 72,
};

const FONT_MINIMUMS: Record<
    CarDisplayFontSize,
    Record<DisplayFontKey, number>
> = {
    medium: {
        tag: 14,
        description: 16,
        subTitle: 18,
        content: 18,
        title: 22,
        appbar: 24,
    },
    large: {
        tag: 16,
        description: 18,
        subTitle: 20,
        content: 20,
        title: 24,
        appbar: 28,
    },
};

const ICON_MINIMUMS: Record<
    CarDisplayFontSize,
    Record<DisplayIconKey, number>
> = {
    medium: {
        small: 20,
        light: 24,
        normal: 28,
        big: 36,
        large: 44,
    },
    large: {
        small: 22,
        light: 28,
        normal: 32,
        big: 40,
        large: 48,
    },
};

const LYRIC_RPX = [24, 30, 36, 42];
const LYRIC_MINIMUMS: Record<CarDisplayFontSize, number[]> = {
    medium: [18, 20, 22, 24],
    large: [20, 22, 24, 28],
};

const TOUCH_TARGETS: Record<CarDisplayFontSize, number> = {
    medium: 56,
    large: 64,
};

const LIST_IMAGE_MINIMUMS: Record<CarDisplayFontSize, number> = {
    medium: 44,
    large: 52,
};

const OVERLAY_BOUNDS: Record<
    DisplayOverlayKind,
    { ratio: number; min: number; max: number }
> = {
    drawer: { ratio: 0.26, min: 200, max: 420 },
    panel: { ratio: 0.42, min: 360, max: 720 },
    dialog: { ratio: 0.58, min: 420, max: 960 },
};

export interface DisplayMetrics {
    isCarMode: boolean;
    fontTier: CarDisplayFontSize;
    width: number;
    height: number;
    shortEdge: number;
    longEdge: number;
    fontSizes: Record<DisplayFontKey, number>;
    iconSizes: Record<DisplayIconKey, number>;
    listItemHeights: Record<DisplayListHeightKey, number | undefined>;
    lyricFontSizes: number[];
    minTouchTarget: number;
    horizontalPadding: number;
    actionWidth: number;
    listImageSize: number;
    appBarHeight: number;
    chipHeight: number;
    buttonHeight: number;
    navigationItemHeight: number;
    scaleRpx: (value: number) => number;
}

function safeDimension(value: number) {
    return Number.isFinite(value) && value > 0 ? value : 1;
}

function scaleRpx(value: number, shortEdge: number) {
    return (value / 750) * shortEdge;
}

export function normalizeCarDisplayFontSize(value: unknown): CarDisplayFontSize {
    return value === "large" ? "large" : "medium";
}

export function getDisplayOverlayWidth(
    kind: DisplayOverlayKind,
    availableWidth: number,
): number {
    const width = safeDimension(availableWidth);
    const bounds = OVERLAY_BOUNDS[kind];
    const upperBound = Math.min(bounds.max, width);
    const lowerBound = Math.min(bounds.min, upperBound);
    return Math.min(
        upperBound,
        Math.max(lowerBound, width * bounds.ratio),
    );
}

export function getDisplayMetrics(
    width: number,
    height: number,
    isCarMode: boolean,
    fontTier: CarDisplayFontSize = "medium",
): DisplayMetrics {
    const safeWidth = safeDimension(width);
    const safeHeight = safeDimension(height);
    const shortEdge = Math.min(safeWidth, safeHeight);
    const longEdge = Math.max(safeWidth, safeHeight);
    const tier = normalizeCarDisplayFontSize(fontTier);
    const scale = (value: number) => scaleRpx(value, shortEdge);
    const minTouchTarget = isCarMode ? TOUCH_TARGETS[tier] : 0;

    const fontSizes = Object.keys(FONT_RPX).reduce((result, key) => {
        const fontKey = key as DisplayFontKey;
        result[fontKey] = isCarMode
            ? Math.max(scale(FONT_RPX[fontKey]), FONT_MINIMUMS[tier][fontKey])
            : scale(FONT_RPX[fontKey]);
        return result;
    }, {} as Record<DisplayFontKey, number>);

    const iconSizes = Object.keys(ICON_RPX).reduce((result, key) => {
        const iconKey = key as DisplayIconKey;
        result[iconKey] = isCarMode
            ? Math.max(scale(ICON_RPX[iconKey]), ICON_MINIMUMS[tier][iconKey])
            : scale(ICON_RPX[iconKey]);
        return result;
    }, {} as Record<DisplayIconKey, number>);

    const listItemHeights = Object.keys(LIST_HEIGHT_RPX).reduce(
        (result, key) => {
            const heightKey = key as Exclude<DisplayListHeightKey, "none">;
            const baseHeight = scale(LIST_HEIGHT_RPX[heightKey]);
            result[heightKey] = isCarMode
                ? Math.max(baseHeight, minTouchTarget)
                : baseHeight;
            return result;
        },
        {} as Record<Exclude<DisplayListHeightKey, "none">, number>,
    );

    const lyricFontSizes = LYRIC_RPX.map((value, index) => {
        const baseSize = scale(value);
        return isCarMode
            ? Math.max(baseSize, LYRIC_MINIMUMS[tier][index])
            : baseSize;
    });

    const minSpacing = isCarMode ? (tier === "large" ? 20 : 16) : 0;
    return {
        isCarMode,
        fontTier: tier,
        width: safeWidth,
        height: safeHeight,
        shortEdge,
        longEdge,
        fontSizes,
        iconSizes,
        listItemHeights: {
            ...listItemHeights,
            none: undefined,
        },
        lyricFontSizes,
        minTouchTarget,
        horizontalPadding: isCarMode
            ? Math.max(scale(24), minSpacing)
            : scale(24),
        actionWidth: isCarMode
            ? Math.max(scale(80), minTouchTarget)
            : scale(80),
        listImageSize: isCarMode
            ? Math.max(scale(80), LIST_IMAGE_MINIMUMS[tier])
            : scale(80),
        appBarHeight: isCarMode
            ? Math.max(scale(88), minTouchTarget)
            : scale(88),
        chipHeight: isCarMode
            ? Math.max(scale(56), minTouchTarget)
            : scale(56),
        buttonHeight: isCarMode
            ? Math.max(scale(72), minTouchTarget)
            : scale(72),
        navigationItemHeight: isCarMode
            ? Math.max(scale(72), minTouchTarget)
            : scale(72),
        scaleRpx: scale,
    };
}

export type { DisplayMetrics as IDisplayMetrics };
