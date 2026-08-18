import type { Plugin } from "@/core/pluginManager";
import { devLog } from "@/utils/log";
import { scoreLyricSearchCandidate } from "@/utils/lyricMatch";

export interface ILyricSearchCandidate {
    musicItem: ILyric.ILyricItem;
    pluginHash: string;
    pluginName: string;
    pluginOrder: number;
    resultOrder: number;
    relevance: number;
}

export interface ILyricPluginSearchResult {
    pluginHash: string;
    pluginName: string;
    pluginOrder: number;
    items: ILyric.ILyricItem[];
}

export function rankLyricSearchCandidates(
    query: string,
    currentMusic: IMusic.IMusicItem,
    pluginResults: ILyricPluginSearchResult[],
): ILyricSearchCandidate[] {
    const identities = new Set<string>();
    const candidates: ILyricSearchCandidate[] = [];

    pluginResults.forEach(result => {
        result.items.forEach((musicItem, resultOrder) => {
            if (
                !musicItem ||
                typeof musicItem.id !== "string" ||
                !musicItem.id.trim() ||
                typeof musicItem.platform !== "string" ||
                !musicItem.platform.trim() ||
                typeof musicItem.title !== "string" ||
                !musicItem.title.trim()
            ) {
                return;
            }
            const identity = `${musicItem.platform}@${musicItem.id}`;
            if (identities.has(identity)) {
                return;
            }
            identities.add(identity);
            candidates.push({
                musicItem,
                pluginHash: result.pluginHash,
                pluginName: result.pluginName,
                pluginOrder: result.pluginOrder,
                resultOrder,
                relevance: scoreLyricSearchCandidate(
                    query,
                    currentMusic,
                    musicItem,
                ),
            });
        });
    });

    return candidates.sort(
        (left, right) =>
            right.relevance - left.relevance ||
            left.pluginOrder - right.pluginOrder ||
            left.resultOrder - right.resultOrder,
    );
}

export async function searchLyricCandidates(
    query: string,
    currentMusic: IMusic.IMusicItem,
    plugins: Plugin[],
): Promise<ILyricSearchCandidate[]> {
    const results = await Promise.all(
        plugins.map(async (plugin, pluginOrder) => {
            try {
                const result = await plugin.methods.search(query, 1, "lyric");
                return {
                    pluginHash: plugin.hash,
                    pluginName: plugin.name,
                    pluginOrder,
                    items: (result?.data ?? []) as ILyric.ILyricItem[],
                };
            } catch (error: any) {
                devLog(
                    "warn",
                    "歌词搜索失败",
                    plugin.name,
                    error?.message,
                );
                return {
                    pluginHash: plugin.hash,
                    pluginName: plugin.name,
                    pluginOrder,
                    items: [],
                };
            }
        }),
    );
    return rankLyricSearchCandidates(query, currentMusic, results);
}
