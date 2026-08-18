import minDistance from "./minDistance";

export interface ILyricMatchItem {
    title?: string;
    artist?: string;
    album?: string;
}

export const MAX_LYRIC_MATCH_SCORE = 0.5;

export function normalizeLyricMatchText(value?: string): string {
    return (value || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\s\-_·•.,，。/\\|:：;'’"“”()[\]{}【】<>《》&+]+/g, "");
}

function normalizedDistance(left?: string, right?: string): number {
    const normalizedLeft = normalizeLyricMatchText(left);
    const normalizedRight = normalizeLyricMatchText(right);
    const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
    if (maxLength === 0) return 0;
    return minDistance(normalizedLeft, normalizedRight) / maxLength;
}

export function getLyricTextSimilarity(left?: string, right?: string): number {
    if (!normalizeLyricMatchText(left) || !normalizeLyricMatchText(right)) {
        return 0;
    }
    return 1 - normalizedDistance(left, right);
}

export function scoreLyricSearchCandidate(
    query: string,
    current: ILyricMatchItem,
    candidate: ILyricMatchItem,
): number {
    return (
        getLyricTextSimilarity(query, candidate.title) * 0.55 +
        getLyricTextSimilarity(current.title, candidate.title) * 0.2 +
        getLyricTextSimilarity(current.artist, candidate.artist) * 0.2 +
        getLyricTextSimilarity(current.album, candidate.album) * 0.05
    );
}

export function scoreLyricCandidate(
    target: ILyricMatchItem,
    candidate: ILyricMatchItem,
): number {
    return (
        normalizedDistance(target.title, candidate.title) * 0.7 +
        normalizedDistance(target.artist, candidate.artist) * 0.3
    );
}

export function getRecognizedSongIdentity(item: ILyricMatchItem): string {
    return `${normalizeLyricMatchText(item.title)}@${normalizeLyricMatchText(
        item.artist,
    )}`;
}
