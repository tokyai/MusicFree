import axios from "axios";
import qs from "qs";
import { readFile, unlink } from "react-native-fs";
import AudioClipper, { IAudioClip } from "@/native/audioClipper";
import {
    INeteaseFingerprintResult,
    cancelNeteaseFingerprint,
    requestNeteaseFingerprint,
} from "./neteaseFingerprint";
import {
    parseNeteaseRecognitionTime,
    parseRecognitionTimecode,
} from "./bilibiliRecognitionUtils";

export {
    getRecognitionSegmentStart,
    isBilibiliMediaItem,
    parseNeteaseRecognitionTime,
    parseRecognitionTimecode,
} from "./bilibiliRecognitionUtils";

const CLIP_DURATION_SECONDS = 12;
const NETEASE_MATCH_URL =
    "https://interface.music.163.com/api/music/audio/match";
const NETEASE_LYRIC_URL = "https://interface.music.163.com/api/song/lyric";

export type BilibiliRecognitionProvider = "netease" | "audd";

export interface IBilibiliRecognitionOptions {
    provider: BilibiliRecognitionProvider;
    apiToken?: string;
    signal?: AbortSignal;
}

export interface IBilibiliRecognitionResult {
    title: string;
    artist: string;
    album?: string;
    songTime: number;
    sourceStartTime: number;
    platformSongId?: string;
}

interface IAudDResponse {
    status?: string;
    error?: {
        error_message?: string;
        message?: string;
    };
    result?: {
        title?: string;
        artist?: string;
        album?: string;
        timecode?: string;
    } | null;
}

interface INeteaseMatchSong {
    id?: string | number;
    name?: string;
    artists?: Array<{ name?: string }>;
    ar?: Array<{ name?: string }>;
    album?: { name?: string };
    al?: { name?: string };
}

interface INeteaseMatchItem {
    song?: INeteaseMatchSong;
    startTime?: string | number;
}

interface INeteaseMatchResponse {
    data?: {
        result?: INeteaseMatchItem[];
    };
}

interface INeteaseLyricResponse {
    lrc?: { lyric?: string | null };
    klyric?: { lyric?: string | null };
    tlyric?: { lyric?: string | null };
}

const NETEASE_HEADERS = {
    Accept: "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: "chrome-extension://pgphbbekcgpfaekhcbjamjjkegcclhhd",
    Referer: "https://music.163.com/",
    "User-Agent":
        "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/102.0.0.0 Mobile Safari/537.36",
};

function createAbortError(): Error {
    const error = new Error("Bilibili audio recognition was cancelled");
    error.name = "AbortError";
    return error;
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw createAbortError();
}

function withAbort<T>(
    promise: Promise<T>,
    signal: AbortSignal | undefined,
    onLateResolve?: (value: T) => void,
    onAbortRequest?: () => void,
): Promise<T> {
    if (!signal) return promise;
    return new Promise<T>((resolve, reject) => {
        let settled = false;
        const cleanup = () => signal.removeEventListener("abort", onAbort);
        const onAbort = () => {
            if (settled) return;
            settled = true;
            cleanup();
            onAbortRequest?.();
            reject(createAbortError());
        };

        if (signal.aborted) {
            onAbort();
            return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then(
            value => {
                if (settled) {
                    onLateResolve?.(value);
                    return;
                }
                settled = true;
                cleanup();
                resolve(value);
            },
            error => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            },
        );
    });
}

function normalizeOptions(
    optionsOrToken: IBilibiliRecognitionOptions | string,
): IBilibiliRecognitionOptions {
    if (typeof optionsOrToken === "string") {
        return { provider: "audd", apiToken: optionsOrToken };
    }
    return optionsOrToken;
}

function getNeteaseMatch(
    response: INeteaseMatchResponse,
): IBilibiliRecognitionResult | null {
    const item = response.data?.result?.find(candidate => {
        const song = candidate.song;
        return (
            !!song?.id &&
            !!song.name &&
            (song.artists || song.ar || []).some(artist => !!artist.name)
        );
    });
    const song = item?.song;
    const songTime = parseNeteaseRecognitionTime(item?.startTime);
    if (!song?.id || !song.name || songTime === null) return null;

    const artist = (song.artists || song.ar || [])
        .map(artistEntry => artistEntry.name?.trim())
        .filter(Boolean)
        .join("/");
    if (!artist) return null;

    return {
        title: song.name.trim(),
        artist,
        album: (song.album?.name || song.al?.name || "").trim(),
        songTime,
        sourceStartTime: 0,
        platformSongId: String(song.id),
    };
}

async function recognizeWithNetease(
    clip: IAudioClip,
    signal?: AbortSignal,
): Promise<IBilibiliRecognitionResult | null> {
    throwIfAborted(signal);
    const audioBase64 = await readFile(clip.path, "base64");
    throwIfAborted(signal);
    const fingerprint: INeteaseFingerprintResult =
        await requestNeteaseFingerprint(audioBase64, signal);
    throwIfAborted(signal);

    const body = qs.stringify({
        sessionId: `musicfree-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2)}`,
        algorithmCode: "shazam_v2",
        duration: 6,
        rawdata: fingerprint.fingerprint,
        times: 2,
        decrypt: 1,
    });
    const response = await axios.post<INeteaseMatchResponse>(
        NETEASE_MATCH_URL,
        body,
        {
            headers: NETEASE_HEADERS,
            timeout: 30_000,
            signal,
        },
    );
    const result = getNeteaseMatch(response.data);
    if (!result) return null;
    return {
        ...result,
        sourceStartTime: clip.sourceStartTime + fingerprint.queryOffsetSeconds,
    };
}

async function recognizeWithAudd(
    clip: IAudioClip,
    apiToken: string,
    signal?: AbortSignal,
): Promise<IBilibiliRecognitionResult | null> {
    throwIfAborted(signal);
    const form = new FormData();
    form.append("api_token", apiToken.trim());
    form.append("file", {
        uri: clip.uri,
        type: clip.mimeType,
        name: clip.fileName,
    } as any);

    const response = await axios.post<IAudDResponse>(
        "https://api.audd.io/",
        form,
        {
            timeout: 30_000,
            signal,
        },
    );
    const body = response.data;
    if (body?.status !== "success") {
        throw new Error(
            body?.error?.error_message ||
                body?.error?.message ||
                "Music recognition failed",
        );
    }

    const result = body.result;
    const songTime = parseRecognitionTimecode(result?.timecode);
    if (!result?.title || !result.artist || songTime === null) return null;

    return {
        title: result.title.trim(),
        artist: result.artist.trim(),
        album: result.album?.trim(),
        songTime,
        sourceStartTime: clip.sourceStartTime,
    };
}

export async function recognizeBilibiliAudio(
    track: IMusic.IMusicItem,
    position: number,
    optionsOrToken: IBilibiliRecognitionOptions | string,
): Promise<IBilibiliRecognitionResult | null> {
    const options = normalizeOptions(optionsOrToken);
    const apiToken = options.apiToken?.trim() || "";
    if (
        !AudioClipper.isSupported ||
        !track.url ||
        (options.provider === "audd" && !apiToken)
    ) {
        return null;
    }
    throwIfAborted(options.signal);

    const requestedStart = Math.max(0, position - 2);
    const headers = {
        ...(track.headers || {}),
        ...(track.userAgent && !track.headers?.["User-Agent"]
            ? { "User-Agent": track.userAgent }
            : {}),
    };
    const clipPromise = AudioClipper.clipRemoteAudio(
        track.url,
        headers,
        requestedStart,
        CLIP_DURATION_SECONDS,
    );
    const clip = await withAbort(
        clipPromise,
        options.signal,
        value => unlink(value.path).catch(() => {}),
        () => AudioClipper.cancelPendingClips(),
    );

    try {
        if (options.provider === "netease") {
            return await recognizeWithNetease(clip, options.signal);
        }
        return await recognizeWithAudd(clip, apiToken, options.signal);
    } finally {
        await unlink(clip.path).catch(() => {});
    }
}

export async function fetchNeteaseLyric(
    songId: string,
    signal?: AbortSignal,
): Promise<ILyric.ILyricSource | null> {
    if (!songId) return null;
    throwIfAborted(signal);
    const body = qs.stringify({
        id: songId,
        tv: -1,
        lv: -1,
        rv: -1,
        kv: -1,
    });
    const response = await axios.post<INeteaseLyricResponse>(
        NETEASE_LYRIC_URL,
        body,
        {
            headers: NETEASE_HEADERS,
            timeout: 20_000,
            signal,
        },
    );
    const data = response.data;
    const rawLrc = data.lrc?.lyric || data.klyric?.lyric || "";
    if (!rawLrc.trim()) return null;
    return {
        rawLrc,
        translation: data.tlyric?.lyric || undefined,
    };
}

export function cancelBilibiliAudioRecognition(): void {
    AudioClipper.cancelPendingClips();
    cancelNeteaseFingerprint();
}
