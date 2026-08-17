import minDistance from "./minDistance";

/**
 * 曲名和歌手是跨平台换源的主要身份线索；专辑/时长在不同插件中经常
 * 缺失或采用不同单位，因此只参与排序，不再作为硬性拒绝条件。
 */
export const MUSIC_SOURCE_MATCH_THRESHOLD = 0.82;

type MusicEditionTag =
    | "live"
    | "remix"
    | "acoustic"
    | "instrumental"
    | "cover"
    | "dj"
    | "edit"
    | "demo"
    | "remaster"
    | "sped-up"
    | "slowed";

interface IEditionMarker {
    tag: MusicEditionTag;
    pattern: RegExp;
}

const EDITION_MARKERS: IEditionMarker[] = [
    {
        tag: "live",
        pattern: /(?:\blive\b|\bconcert\b|现场(?:版|录音)?|演唱会(?:版|现场)?)/gi,
    },
    {
        tag: "remix",
        pattern: /(?:\bremix(?:ed)?\b|\bmix\b|混音(?:版)?)/gi,
    },
    {
        tag: "acoustic",
        pattern: /(?:\bacoustic\b|不插电(?:版)?|木吉他(?:版)?)/gi,
    },
    {
        tag: "instrumental",
        pattern: /(?:\binstrumental\b|\bkaraoke\b|伴奏(?:版)?|纯音乐(?:版)?|无人声(?:版)?)/gi,
    },
    {
        tag: "cover",
        pattern: /(?:\bcover\b|翻唱(?:版)?)/gi,
    },
    {
        tag: "dj",
        pattern: /(?:\bdj(?:版|version|mix|remix)?\b|dj版)/gi,
    },
    {
        tag: "edit",
        pattern: /(?:\bradio\s*edit\b|\bedit(?:ed)?\b|剪辑版|电台版)/gi,
    },
    {
        tag: "demo",
        pattern: /(?:\bdemo\b|小样(?:版)?)/gi,
    },
    {
        tag: "remaster",
        pattern: /(?:\bremaster(?:ed)?\b|重制(?:版)?)/gi,
    },
    {
        tag: "sped-up",
        pattern: /(?:\bsped\s*up\b|加速版)/gi,
    },
    {
        tag: "slowed",
        pattern: /(?:\bslowed(?:\s*down)?\b|慢速版)/gi,
    },
];

function normalizeWidth(value: string) {
    return value.normalize("NFKC").toLowerCase();
}

function markerMatches(value: string, marker: IEditionMarker) {
    marker.pattern.lastIndex = 0;
    return marker.pattern.test(value);
}

function removeMarkers(value: string) {
    return EDITION_MARKERS.reduce((result, marker) => {
        marker.pattern.lastIndex = 0;
        return result.replace(marker.pattern, " ");
    }, value);
}

function normalizeText(value?: string) {
    return normalizeWidth(value || "")
        .replace(/(?:feat(?:uring)?|ft)\.?\s*/g, " ")
        .replace(/[\s\-_·•.,，。/\\|:：;'’"“”()[\]{}【】<>《》&+!?！？]+/g, "");
}

function normalizeTitleVariants(item: IMusic.IMusicItem) {
    const values = [item.title, item.alias].filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    const variants = values.map(value => {
        const withoutMarkers = removeMarkers(normalizeWidth(value));
        const withoutFeaturedArtist = withoutMarkers.replace(
            /(?:\(|\[|【)?\s*(?:feat(?:uring)?|ft)\.?\s+[^)\]】]*/gi,
            " ",
        );
        return normalizeText(withoutFeaturedArtist);
    });
    return variants.length ? variants : [""];
}

function getEditionTags(item: IMusic.IMusicItem) {
    const source = normalizeWidth(
        [item.title, item.alias].filter(Boolean).join(" "),
    );
    const tags = new Set<MusicEditionTag>();
    EDITION_MARKERS.forEach(marker => {
        if (markerMatches(source, marker)) {
            tags.add(marker.tag);
        }
    });
    return [...tags].sort();
}

function splitArtists(value?: string) {
    if (!value) {
        return [];
    }
    return normalizeWidth(value)
        .replace(/(?:feat(?:uring)?|ft)\.?/g, "|")
        .split(/[,&/;|、，；＋+]|\s+x\s+|\s+and\s+/g)
        .map(item => normalizeText(item))
        .filter(Boolean);
}

function similarity(left: string, right: string) {
    if (!left && !right) {
        return 1;
    }
    if (!left || !right) {
        return 0;
    }
    if (left === right) {
        return 1;
    }
    const maxLength = Math.max(left.length, right.length);
    return Math.max(0, 1 - minDistance(left, right) / maxLength);
}

function titleSimilarity(target: IMusic.IMusicItem, candidate: IMusic.IMusicItem) {
    const targetVariants = normalizeTitleVariants(target);
    const candidateVariants = normalizeTitleVariants(candidate);
    return Math.max(
        ...targetVariants.flatMap(targetTitle =>
            candidateVariants.map(candidateTitle =>
                similarity(targetTitle, candidateTitle),
            ),
        ),
    );
}

function artistSimilarity(target: IMusic.IMusicItem, candidate: IMusic.IMusicItem) {
    const targetArtists = splitArtists(target.artist);
    const candidateArtists = splitArtists(candidate.artist);
    if (!targetArtists.length || !candidateArtists.length) {
        return 0;
    }

    const coverage = (source: string[], other: string[]) =>
        source.reduce(
            (total, item) =>
                total + Math.max(...other.map(otherItem => similarity(item, otherItem))),
            0,
        ) / source.length;

    return (coverage(targetArtists, candidateArtists) +
        coverage(candidateArtists, targetArtists)) / 2;
}

function durationSimilarity(target: IMusic.IMusicItem, candidate: IMusic.IMusicItem) {
    const targetDuration = Number(target.duration);
    const candidateDuration = Number(candidate.duration);
    if (!Number.isFinite(targetDuration) || targetDuration <= 0 ||
        !Number.isFinite(candidateDuration) || candidateDuration <= 0) {
        return { compatible: true, score: 0.5 };
    }
    const tolerance = Math.max(4, targetDuration * 0.04);
    const difference = Math.abs(targetDuration - candidateDuration);
    if (difference > tolerance) {
        return { compatible: false, score: 0 };
    }
    return { compatible: true, score: Math.max(0, 1 - difference / tolerance) };
}

function albumSimilarity(target: IMusic.IMusicItem, candidate: IMusic.IMusicItem) {
    const targetAlbum = normalizeText(target.album);
    const candidateAlbum = normalizeText(candidate.album);
    if (!targetAlbum || !candidateAlbum) {
        return 0.5;
    }
    return similarity(targetAlbum, candidateAlbum);
}

export interface IMusicSourceCandidateScore {
    item: IMusic.IMusicItem;
    title: number;
    artist: number;
    duration: number;
    album: number;
    score: number;
}

export type MusicSourceMatchReason = "matched" | "no-match" | "ambiguous";

export interface IMusicSourceMatchResult {
    reason: MusicSourceMatchReason;
    match?: IMusicSourceCandidateScore;
    ranked: IMusicSourceCandidateScore[];
}

export function scoreMusicSourceCandidate(
    target: IMusic.IMusicItem,
    candidate: IMusic.IMusicItem,
): IMusicSourceCandidateScore | null {
    if (!candidate?.id || !candidate.platform || !candidate.title || !candidate.artist) {
        return null;
    }
    const title = titleSimilarity(target, candidate);
    const artist = artistSimilarity(target, candidate);
    const duration = durationSimilarity(target, candidate);
    if (title < 0.85 || artist < 0.8) {
        return null;
    }

    const album = albumSimilarity(target, candidate);
    return {
        item: candidate,
        title,
        artist,
        duration: duration.score,
        album,
        score: title * 0.6 + artist * 0.35 + duration.score * 0.03 + album * 0.02,
    };
}

export function selectMusicSourceCandidate(
    target: IMusic.IMusicItem,
    candidates: IMusic.IMusicItem[],
): IMusicSourceMatchResult {
    const seen = new Set<string>();
    const ranked = candidates
        .map(candidate => {
            const key = `${candidate?.platform ?? ""}@${candidate?.id ?? ""}`;
            if (!key || seen.has(key)) {
                return null;
            }
            seen.add(key);
            return scoreMusicSourceCandidate(target, candidate);
        })
        .filter((item): item is IMusicSourceCandidateScore => !!item)
        .sort((left, right) => right.score - left.score);

    const best = ranked[0];
    if (!best || best.score < MUSIC_SOURCE_MATCH_THRESHOLD) {
        return { reason: "no-match", ranked };
    }
    return { reason: "matched", match: best, ranked };
}

export function normalizeMusicSourceText(value?: string) {
    return normalizeText(value);
}

export function getMusicSourceEditionTags(item: IMusic.IMusicItem) {
    return getEditionTags(item);
}
