export function isBilibiliMediaItem(
    mediaItem?: IMusic.IMusicItem | null,
): boolean {
    if (!mediaItem) return false;
    const platform = String(mediaItem.platform || "").toLowerCase();
    return !!(
        mediaItem.bvid ||
        (mediaItem.cid && mediaItem.aid) ||
        platform.includes("bili") ||
        platform.includes("哔哩") ||
        platform.includes("b站")
    );
}

export function parseRecognitionTimecode(value?: string): number | null {
    if (!value) return null;
    const parts = value.split(":").map(Number);
    if (
        parts.length < 2 ||
        parts.length > 3 ||
        parts.some(part => !Number.isFinite(part) || part < 0) ||
        parts.slice(1).some(part => part >= 60)
    ) {
        return null;
    }
    return parts.reduce((total, part) => total * 60 + part, 0);
}

export function parseNeteaseRecognitionTime(
    value?: string | number,
): number | null {
    if (typeof value === "string" && value.includes(":")) {
        return parseRecognitionTimecode(value);
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    // Some unofficial gateways return milliseconds instead of seconds.
    return parsed > 10_000 ? parsed / 1_000 : parsed;
}

export function getRecognitionSegmentStart(
    sourceStartTime: number,
    recognizedSongTime: number,
): number {
    return sourceStartTime - recognizedSongTime;
}
