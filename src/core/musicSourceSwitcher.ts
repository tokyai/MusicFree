import Config from "@/core/appConfig";
import PluginManager, { Plugin, PluginState } from "@/core/pluginManager";
import { getQualityOrder } from "@/utils/qualities";
import { getMediaUniqueKey } from "@/utils/mediaUtils";
import {
    IMusicSourceMatchResult,
    selectMusicSourceCandidate,
} from "@/utils/musicSourceMatch";
import { devLog } from "@/utils/log";

export type MusicSourceSwitchFailureReason =
    | "no-match"
    | "ambiguous"
    | "search-failed"
    | "not-playable";

export type MusicSourceSwitchSkipReason = "already-target" | "duplicate";

export interface IMusicSourceSwitchReplacement {
    original: IMusic.IMusicItem;
    replacement: IMusic.IMusicItem;
}

export interface IMusicSourceSwitchFailure {
    musicItem: IMusic.IMusicItem;
    reason: MusicSourceSwitchFailureReason;
}

export interface IMusicSourceSwitchSkipped {
    musicItem: IMusic.IMusicItem;
    reason: MusicSourceSwitchSkipReason;
}

export interface IMusicSourceSwitchOptions {
    musicItems: IMusic.IMusicItem[];
    existingMusicItems: IMusic.IMusicItem[];
    targetPlugin: Plugin;
    signal?: AbortSignal;
    concurrency?: number;
}

export interface IMusicSourceSwitchResult {
    cancelled: boolean;
    replacements: IMusicSourceSwitchReplacement[];
    failures: IMusicSourceSwitchFailure[];
    skipped: IMusicSourceSwitchSkipped[];
}

class MusicSourceSwitchCancelledError extends Error {
    constructor() {
        super("Music source switch was cancelled");
        this.name = "MusicSourceSwitchCancelledError";
    }
}

function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
        throw new MusicSourceSwitchCancelledError();
    }
}

function isUsableUrl(value: unknown) {
    return (
        typeof value === "string" &&
        /^(?:https?|file|content):\/\//i.test(value.trim())
    );
}

function hasDirectSource(musicItem: IMusic.IMusicItem) {
    if (isUsableUrl(musicItem.url)) {
        return true;
    }
    if (musicItem.source) {
        for (const source of Object.values(musicItem.source)) {
            if (isUsableUrl(source?.url)) {
                return true;
            }
        }
    }
    if (musicItem.qualities) {
        for (const quality of Object.values(musicItem.qualities)) {
            if (isUsableUrl(quality?.url)) {
                return true;
            }
        }
    }
    return false;
}

async function canPlayMusic(
    plugin: Plugin,
    musicItem: IMusic.IMusicItem,
    signal?: AbortSignal,
) {
    throwIfAborted(signal);
    if (hasDirectSource(musicItem)) {
        return true;
    }

    const qualityOrder = getQualityOrder(
        Config.getConfig("basic.defaultPlayQuality") ?? "standard",
        Config.getConfig("basic.playQualityOrder") ?? "asc",
    );
    for (const quality of qualityOrder) {
        throwIfAborted(signal);
        try {
            const source = await plugin.methods.getMediaSource(musicItem, quality);
            if (isUsableUrl(source?.url)) {
                return true;
            }
        } catch (error) {
            devLog("warn", "批量换源取流验证失败", error);
        }
    }
    return false;
}

function mergeCandidates(
    current: IMusic.IMusicItem[],
    next: IMusic.IMusicItem[],
) {
    const result = [...current];
    const seen = new Set(result.map(item => getMediaUniqueKey(item)));
    for (const item of next) {
        const key = getMediaUniqueKey(item);
        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }
    return result;
}

function isMusicItem(
    item: ICommon.IMediaBase | null | undefined,
): item is IMusic.IMusicItem {
    return (
        typeof item?.id === "string" &&
        item.id.trim().length > 0 &&
        typeof item.platform === "string" &&
        item.platform.trim().length > 0 &&
        typeof item.title === "string" &&
        item.title.trim().length > 0 &&
        typeof item.artist === "string" &&
        item.artist.trim().length > 0
    );
}

async function findPlayableCandidate(
    original: IMusic.IMusicItem,
    plugin: Plugin,
    signal?: AbortSignal,
): Promise<
    | { type: "matched"; item: IMusic.IMusicItem }
    | { type: "failed"; reason: MusicSourceSwitchFailureReason }
    | { type: "cancelled" }
> {
    const queries = [
        `${original.title} ${original.artist}`.trim(),
        original.title.trim(),
    ].filter((query, index, all) => query && all.indexOf(query) === index);
    let candidates: IMusic.IMusicItem[] = [];
    let lastFailure: MusicSourceSwitchFailureReason = "no-match";
    const unavailableCandidateKeys = new Set<string>();

    for (const query of queries) {
        try {
            throwIfAborted(signal);
            const result = await plugin.methods.search(query, 1, "music");
            throwIfAborted(signal);
            const resultData = result?.data;
            candidates = mergeCandidates(
                candidates,
                (Array.isArray(resultData) ? resultData : []).filter(
                    isMusicItem,
                ),
            );
        } catch (error) {
            if (error instanceof MusicSourceSwitchCancelledError) {
                return { type: "cancelled" };
            }
            devLog("warn", "批量换源搜索失败", error);
            lastFailure = "search-failed";
            continue;
        }

        let match: IMusicSourceMatchResult = selectMusicSourceCandidate(
            original,
            candidates.filter(
                candidate =>
                    !unavailableCandidateKeys.has(
                        getMediaUniqueKey(candidate),
                    ),
            ),
        );
        while (match.reason === "matched" && match.match) {
            const matchedItem = match.match.item;
            try {
                if (await canPlayMusic(plugin, matchedItem, signal)) {
                    return { type: "matched", item: matchedItem };
                }
            } catch (error) {
                if (error instanceof MusicSourceSwitchCancelledError) {
                    return { type: "cancelled" };
                }
            }
            lastFailure = "not-playable";
            unavailableCandidateKeys.add(getMediaUniqueKey(matchedItem));
            match = selectMusicSourceCandidate(
                original,
                candidates.filter(
                    candidate =>
                        !unavailableCandidateKeys.has(
                            getMediaUniqueKey(candidate),
                        ),
                ),
            );
        }
        if (match.reason === "ambiguous") {
            lastFailure = "ambiguous";
        }
    }

    return { type: "failed", reason: lastFailure };
}

export async function batchSwitchMusicSources(
    options: IMusicSourceSwitchOptions,
): Promise<IMusicSourceSwitchResult> {
    const {
        musicItems,
        existingMusicItems,
        targetPlugin,
        signal,
        concurrency = 2,
    } = options;
    const replacements: IMusicSourceSwitchReplacement[] = [];
    const failures: IMusicSourceSwitchFailure[] = [];
    const skipped: IMusicSourceSwitchSkipped[] = [];
    const occupiedKeys = new Set(
        existingMusicItems
            .filter(isMusicItem)
            .map(item => getMediaUniqueKey(item)),
    );
    let nextIndex = 0;

    async function worker() {
        while (true) {
            try {
                throwIfAborted(signal);
            } catch {
                return;
            }
            const index = nextIndex++;
            if (index >= musicItems.length) {
                return;
            }
            const original = musicItems[index];
            if (!isMusicItem(original)) {
                failures.push({ musicItem: original, reason: "no-match" });
                continue;
            }
            if (original.platform === targetPlugin.name) {
                skipped.push({ musicItem: original, reason: "already-target" });
                continue;
            }

            const result = await findPlayableCandidate(original, targetPlugin, signal);
            if (result.type === "cancelled") {
                return;
            }
            if (result.type === "failed") {
                failures.push({ musicItem: original, reason: result.reason });
                continue;
            }

            const targetKey = getMediaUniqueKey(result.item);
            if (occupiedKeys.has(targetKey)) {
                skipped.push({ musicItem: original, reason: "duplicate" });
                continue;
            }
            occupiedKeys.add(targetKey);
            replacements.push({ original, replacement: result.item });
        }
    }

    const normalizedConcurrency = Number.isFinite(concurrency)
        ? Math.max(1, Math.floor(concurrency))
        : 2;
    const workerCount = Math.min(
        normalizedConcurrency,
        Math.max(1, musicItems.length),
    );
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    return {
        cancelled: !!signal?.aborted,
        replacements,
        failures,
        skipped,
    };
}

export function getSourceSwitchPlugins() {
    return PluginManager.getSortedSearchablePlugins("music").filter(
        plugin => plugin.state !== PluginState.Error,
    );
}
