import { IAppConfig } from "@/types/core/config";
import { ITrackPlayer } from "@/types/core/trackPlayer";
import { IInjectable } from "@/types/infra";
import LyricParser, { IParsedLrcItem } from "@/utils/lrcParser";
import { getMediaExtraProperty, patchMediaExtra } from "@/utils/mediaExtra";
import { isSameMediaItem } from "@/utils/mediaUtils";
import {
    getRecognizedSongIdentity,
    MAX_LYRIC_MATCH_SCORE,
    scoreLyricCandidate,
} from "@/utils/lyricMatch";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { Plugin } from "./pluginManager";

import pathConst from "@/constants/pathConst";
import LyricUtil from "@/native/lyricUtil";
import { checkAndCreateDir } from "@/utils/fileUtils";
import PersistStatus from "@/utils/persistStatus";
import CryptoJs from "crypto-js";
import { unlink, writeFile } from "react-native-fs";
import RNTrackPlayer, { Event } from "react-native-track-player";
import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import { IPluginManager } from "@/types/core/pluginManager";
import {
    BilibiliRecognitionProvider,
    cancelBilibiliAudioRecognition,
    fetchNeteaseLyric,
    getRecognitionSegmentStart,
    isBilibiliMediaItem,
    recognizeBilibiliAudio,
} from "./bilibiliAudioRecognition";

const BILIBILI_RECOGNITION_INITIAL_DELAY = 8;
const BILIBILI_RECOGNITION_RETRY_INTERVAL = 30;
const BILIBILI_RECOGNITION_AFTER_LAST_LYRIC = 15;
const BILIBILI_SEEK_THRESHOLD = 4;


interface ILyricState {
    loading: boolean;
    lyrics: IParsedLrcItem[];
    hasTranslation: boolean;
    meta?: Record<string, string>;
    recognizedSong?: {
        title: string;
        artist: string;
    };
}

const defaultLyricState = {
    loading: true,
    lyrics: [],
    hasTranslation: false,
};

const lyricStateAtom = atom<ILyricState>(defaultLyricState);
const currentLyricItemAtom = atom<IParsedLrcItem | null>(null);


class LyricManager implements IInjectable {

    private trackPlayer!: ITrackPlayer;
    private appConfig!: IAppConfig;
    private pluginManager!: IPluginManager;

    private lyricParser: LyricParser | null = null;
    private lyricRequestRevision = 0;

    private recognitionRevision = 0;
    private recognitionInFlight = false;
    private recognitionConfigKey?: string;
    private recognitionAbortController?: AbortController;
    private nextRecognitionPosition: number | null = null;
    private lastPlaybackPosition: number | null = null;
    private recognizedSongIdentity: string | null = null;
    private recognizedSegmentStart: number | null = null;
    private recognizedSong?: ILyricState["recognizedSong"];


    get currentLyricItem() {
        return getDefaultStore().get(currentLyricItemAtom);
    }

    get lyricState() {
        return getDefaultStore().get(lyricStateAtom);
    }

    injectDependencies(trackPlayerService: ITrackPlayer, appConfigService: IAppConfig, pluginManager: IPluginManager): void {
        this.trackPlayer = trackPlayerService;
        this.appConfig = appConfigService;
        this.pluginManager = pluginManager;
    }

    setup() {
        // 更新歌词
        this.trackPlayer.on(TrackPlayerEvents.CurrentMusicChanged, (musicItem) => {
            this.resetBilibiliRecognition();
            this.refreshLyric(true, true);

            if (this.appConfig.getConfig("lyric.showStatusBarLyric")) {
                if (musicItem) {
                    LyricUtil.setStatusBarLyricText(
                        `${musicItem.title} - ${musicItem.artist}`,);
                } else {
                    LyricUtil.setStatusBarLyricText("MusicFree");
                }
            }
        });

        RNTrackPlayer.addEventListener(Event.PlaybackProgressUpdated, evt => {
            this.maybeRecognizeBilibiliAudio(evt.position).catch(() => {});

            const parser = this.lyricParser;
            if (!parser || !this.trackPlayer.isCurrentMusic(parser.musicItem)) {
                return;
            }

            const currentLyricItem = getDefaultStore().get(currentLyricItemAtom);
            const newLyricItem = parser.getPosition(evt.position);


            if (currentLyricItem?.lrc !== newLyricItem?.lrc) {
                // 更新当前歌词状态
                getDefaultStore().set(currentLyricItemAtom, newLyricItem ?? null);

                // 更新状态栏歌词
                const showTranslation = PersistStatus.get("lyric.showTranslation");

                if (this.appConfig.getConfig("lyric.showStatusBarLyric")) {
                    LyricUtil.setStatusBarLyricText(
                        (newLyricItem?.lrc ?? "") +
                        (showTranslation
                            ? `\n${newLyricItem?.translation ?? ""}`
                            : ""),
                    );
                }
            }
        });


        if (this.appConfig.getConfig("lyric.showStatusBarLyric")) {
            const statusBarLyricConfig = {
                topPercent: this.appConfig.getConfig("lyric.topPercent"),
                leftPercent: this.appConfig.getConfig("lyric.leftPercent"),
                align: this.appConfig.getConfig("lyric.align"),
                color: this.appConfig.getConfig("lyric.color"),
                backgroundColor: this.appConfig.getConfig("lyric.backgroundColor"),
                widthPercent: this.appConfig.getConfig("lyric.widthPercent"),
                fontSize: this.appConfig.getConfig("lyric.fontSize"),
            };
            LyricUtil.showStatusBarLyric(
                "MusicFree",
                statusBarLyricConfig ?? {}
            );
        }

        this.refreshLyric(true);
    }

    associateLyric(musicItem: IMusic.IMusicItem, linkToMusicItem: ICommon.IMediaBase) {
        if (!musicItem || !linkToMusicItem) {
            return false;
        }

        // 如果当前音乐项和关联的音乐项相同，则不需要重新关联
        if (isSameMediaItem(musicItem, linkToMusicItem)) {
            patchMediaExtra(musicItem, {
                associatedLrc: undefined,
            });
            return false;
        } else {
            patchMediaExtra(musicItem, {
                associatedLrc: linkToMusicItem,
            });
            if (this.trackPlayer.isCurrentMusic(musicItem)) {
                this.refreshLyric(false);
            }
            return true;
        }
    }

    unassociateLyric(musicItem: IMusic.IMusicItem) {
        if (!musicItem) {
            return;
        }

        patchMediaExtra(musicItem, {
            associatedLrc: undefined,
        });

        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            this.refreshLyric(false);
        }
    }

    async uploadLocalLyric(musicItem: IMusic.IMusicItem, lyricContent: string, type: "raw" | "translation" = "raw") {
        if (!musicItem) {
            return;
        }

        const platformHash = CryptoJs.MD5(musicItem.platform).toString(
            CryptoJs.enc.Hex,
        );
        const idHash: string = CryptoJs.MD5(musicItem.id).toString(
            CryptoJs.enc.Hex,
        );

        // 检查是否缓存文件夹存在
        await checkAndCreateDir(pathConst.localLrcPath + platformHash);
        await writeFile(pathConst.localLrcPath +
            platformHash +
            "/" +
            idHash +
            (type === "raw" ? "" : ".tran") +
            ".lrc", lyricContent, "utf8");

        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            this.refreshLyric(false, false);
        }
    }

    async removeLocalLyric(musicItem: IMusic.IMusicItem) {
        if (!musicItem) {
            return;
        }

        const platformHash = CryptoJs.MD5(musicItem.platform).toString(
            CryptoJs.enc.Hex,
        );
        const idHash: string = CryptoJs.MD5(musicItem.id).toString(
            CryptoJs.enc.Hex,
        );

        const basePath =
            pathConst.localLrcPath + platformHash + "/" + idHash;

        await unlink(basePath + ".lrc").catch(() => { });
        await unlink(basePath + ".tran.lrc").catch(() => { });

        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            this.refreshLyric(false, false);
        }

    }


    updateLyricOffset(musicItem: IMusic.IMusicItem, offset: number) {
        if (!musicItem) {
            return;
        }

        // 更新歌词偏移
        patchMediaExtra(musicItem, {
            lyricOffset: offset,
        });

        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            this.refreshLyric(true, false);
        }
    }

    private setLyricAsLoadingState() {
        getDefaultStore().set(lyricStateAtom, {
            loading: true,
            lyrics: [],
            hasTranslation: false,
        });
        getDefaultStore().set(currentLyricItemAtom, null);
    }

    private setLyricAsNoLyricState() {
        getDefaultStore().set(lyricStateAtom, {
            loading: false,
            lyrics: [],
            hasTranslation: false,
        });
        getDefaultStore().set(currentLyricItemAtom, null);
        if (this.appConfig.getConfig("lyric.showStatusBarLyric")) {
            const musicItem = this.trackPlayer.currentMusic;
            LyricUtil.setStatusBarLyricText(musicItem ? `${musicItem.title} - ${musicItem.artist}` : "MusicFree");
        }
    }

    private getBilibiliRecognitionConfig() {
        const configuredProvider = this.appConfig.getConfig(
            "lyric.bilibiliAudioRecognitionProvider",
        );
        const provider: BilibiliRecognitionProvider =
            configuredProvider === "audd" ? "audd" : "netease";
        const token = this.appConfig.getConfig("lyric.auddApiToken")?.trim() || "";
        return {
            provider,
            token,
            key: provider === "audd" ? `${provider}:${token}` : provider,
        };
    }

    public cancelBilibiliRecognition(restoreLyric = false) {
        this.resetBilibiliRecognition();
        if (restoreLyric) {
            this.refreshLyric(false).catch(() => {});
        }
    }

    private resetBilibiliRecognition(configKey?: string) {
        this.recognitionRevision += 1;
        this.recognitionAbortController?.abort();
        this.recognitionAbortController = undefined;
        cancelBilibiliAudioRecognition();
        this.recognitionConfigKey = configKey;
        this.nextRecognitionPosition = null;
        this.lastPlaybackPosition = null;
        this.recognizedSongIdentity = null;
        this.recognizedSegmentStart = null;
        this.recognizedSong = undefined;
    }

    private async maybeRecognizeBilibiliAudio(position: number) {
        const enabled = this.appConfig.getConfig(
            "lyric.bilibiliAudioRecognitionEnabled",
        ) === true;
        const currentMusicItem = this.trackPlayer.currentMusic;
        if (
            !enabled ||
            !currentMusicItem ||
            !isBilibiliMediaItem(currentMusicItem)
        ) {
            if (this.recognitionConfigKey !== undefined) {
                this.resetBilibiliRecognition();
                this.refreshLyric(false).catch(() => {});
            }
            return;
        }

        const config = this.getBilibiliRecognitionConfig();
        if (config.provider === "audd" && !config.token) {
            if (this.recognitionConfigKey !== undefined) {
                this.resetBilibiliRecognition();
                this.refreshLyric(false).catch(() => {});
            }
            return;
        }

        if (config.key !== this.recognitionConfigKey) {
            this.resetBilibiliRecognition(config.key);
        }

        if (
            this.lastPlaybackPosition !== null &&
            Math.abs(position - this.lastPlaybackPosition) >
                BILIBILI_SEEK_THRESHOLD
        ) {
            this.resetBilibiliRecognition(config.key);
        }
        this.lastPlaybackPosition = position;

        if (
            position < BILIBILI_RECOGNITION_INITIAL_DELAY ||
            this.recognitionInFlight ||
            (this.nextRecognitionPosition !== null &&
                position < this.nextRecognitionPosition)
        ) {
            return;
        }

        const revision = this.recognitionRevision;
        const abortController = new AbortController();
        this.recognitionAbortController = abortController;
        this.recognitionInFlight = true;
        this.nextRecognitionPosition =
            position + BILIBILI_RECOGNITION_RETRY_INTERVAL;

        try {
            const playerTrack = (await RNTrackPlayer.getActiveTrack()) as
                | IMusic.IMusicItem
                | undefined;
            if (
                revision !== this.recognitionRevision ||
                !playerTrack?.url ||
                !this.trackPlayer.isCurrentMusic(currentMusicItem) ||
                !isSameMediaItem(playerTrack, currentMusicItem)
            ) {
                return;
            }

            const result = await recognizeBilibiliAudio(
                playerTrack,
                position,
                {
                    provider: config.provider,
                    apiToken: config.token,
                    signal: abortController.signal,
                },
            ).catch(() => null);
            if (
                !result ||
                revision !== this.recognitionRevision ||
                abortController.signal.aborted ||
                !this.trackPlayer.isCurrentMusic(currentMusicItem) ||
                !this.appConfig.getConfig(
                    "lyric.bilibiliAudioRecognitionEnabled",
                ) ||
                this.getBilibiliRecognitionConfig().key !== config.key
            ) {
                return;
            }

            const identity = getRecognizedSongIdentity(result);
            const segmentStart = getRecognitionSegmentStart(
                result.sourceStartTime,
                result.songTime,
            );
            if (
                !identity ||
                (identity === this.recognizedSongIdentity &&
                    this.recognizedSegmentStart !== null &&
                    Math.abs(segmentStart - this.recognizedSegmentStart) < 5)
            ) {
                return;
            }

            const recognizedMusicItem: IMusic.IMusicItem = {
                id: identity,
                platform: currentMusicItem.platform,
                title: result.title,
                artist: result.artist,
                album: result.album || "",
                artwork: currentMusicItem.artwork,
                duration: 0,
            };
            const isObsolete = () =>
                revision !== this.recognitionRevision ||
                abortController.signal.aborted ||
                !this.trackPlayer.isCurrentMusic(currentMusicItem) ||
                !this.appConfig.getConfig(
                    "lyric.bilibiliAudioRecognitionEnabled",
                ) ||
                this.getBilibiliRecognitionConfig().key !== config.key;

            let lrcSource: ILyric.ILyricSource | null = null;
            if (config.provider === "netease" && result.platformSongId) {
                lrcSource = await fetchNeteaseLyric(
                    result.platformSongId,
                    abortController.signal,
                ).catch(() => null);
            }
            if (!lrcSource) {
                lrcSource = await this.searchSimilarLyric(
                    recognizedMusicItem,
                    isObsolete,
                    currentMusicItem.platform,
                );
            }
            if (!lrcSource || isObsolete()) return;

            const manualOffset =
                getMediaExtraProperty(currentMusicItem, "lyricOffset") || 0;
            this.lyricRequestRevision += 1;
            const requestRevision = this.lyricRequestRevision;
            await this.applyLyricSource(
                currentMusicItem,
                lrcSource,
                segmentStart - manualOffset,
                false,
                {
                    title: result.title,
                    artist: result.artist,
                },
                requestRevision,
            );
            if (!isObsolete() && requestRevision === this.lyricRequestRevision) {
                const lyricItems = this.lyricParser?.getLyricItems() || [];
                const lastLyricTime = lyricItems[lyricItems.length - 1]?.time;
                if (lastLyricTime !== undefined) {
                    this.nextRecognitionPosition = Math.max(
                        this.nextRecognitionPosition || 0,
                        segmentStart +
                            lastLyricTime +
                            BILIBILI_RECOGNITION_AFTER_LAST_LYRIC,
                    );
                }
                this.recognizedSongIdentity = identity;
                this.recognizedSegmentStart = segmentStart;
                this.recognizedSong = {
                    title: result.title,
                    artist: result.artist,
                };
            }
        } finally {
            if (this.recognitionAbortController === abortController) {
                this.recognitionAbortController = undefined;
            }
            this.recognitionInFlight = false;
        }
    }

    private async applyLyricSource(
        musicItem: IMusic.IMusicItem,
        lrcSource: ILyric.ILyricSource,
        parserOffset: number,
        ignoreProgress: boolean = false,
        recognizedSong?: {
            title: string;
            artist: string;
        },
        requestRevision: number = this.lyricRequestRevision,
    ) {
        if (
            requestRevision !== this.lyricRequestRevision ||
            !this.trackPlayer.isCurrentMusic(musicItem)
        ) {
            return;
        }

        const parser = new LyricParser(lrcSource.rawLrc!, {
            extra: { offset: parserOffset },
            musicItem,
            lyricSource: lrcSource,
            translation: lrcSource.translation,
        });

        if (
            requestRevision !== this.lyricRequestRevision ||
            !this.trackPlayer.isCurrentMusic(musicItem)
        ) {
            return;
        }

        this.lyricParser = parser;
        getDefaultStore().set(lyricStateAtom, {
            loading: false,
            lyrics: parser.getLyricItems(),
            hasTranslation: !!lrcSource.translation,
            meta: parser.getMeta(),
            recognizedSong,
        });

        const currentLyric = ignoreProgress
            ? parser.getLyricItems()?.[0] ?? null
            : parser.getPosition(
                (await this.trackPlayer.getProgress()).position,
            );
        if (
            requestRevision === this.lyricRequestRevision &&
            this.trackPlayer.isCurrentMusic(musicItem)
        ) {
            getDefaultStore().set(currentLyricItemAtom, currentLyric || null);
        }
    }

    private async refreshLyric(skipFetchLyricSourceIfSame: boolean = true, ignoreProgress: boolean = false) {
        const currentMusicItem = this.trackPlayer.currentMusic;
        const requestRevision = ++this.lyricRequestRevision;

        // 如果没有当前音乐项，重置歌词状态
        if (!currentMusicItem) {
            this.setLyricAsNoLyricState();
            return;
        }

        try {
            let lrcSource: ILyric.ILyricSource | null;

            if (skipFetchLyricSourceIfSame && this.lyricParser && this.trackPlayer.isCurrentMusic(this.lyricParser.musicItem)) {
                lrcSource = this.lyricParser.lyricSource ?? null;
            } else {
                // 重置歌词状态
                this.setLyricAsLoadingState();

                lrcSource = (await this.pluginManager.getByMedia(currentMusicItem)?.methods?.getLyric(currentMusicItem)) ?? null;
            }

            // 切换到其他歌曲了, 直接返回
            if (
                requestRevision !== this.lyricRequestRevision ||
                !this.trackPlayer.isCurrentMusic(currentMusicItem)
            ) {
                return;
            }

            // 如果歌词源不存在，并且开启自动搜索歌词
            if (!lrcSource && this.appConfig.getConfig("lyric.autoSearchLyric")) {
                // 重置歌词状态
                this.setLyricAsLoadingState();

                lrcSource = await this.searchSimilarLyric(currentMusicItem);
            }

            // 切换到其他歌曲了, 直接返回
            if (
                requestRevision !== this.lyricRequestRevision ||
                !this.trackPlayer.isCurrentMusic(currentMusicItem)
            ) {
                return;
            }

            // 如果源不存在，恢复默认设置
            if (!lrcSource) {
                this.setLyricAsNoLyricState();
                this.lyricParser = null;
                return;
            }

            const keepsRecognizedAlignment =
                skipFetchLyricSourceIfSame &&
                this.recognizedSegmentStart !== null &&
                lrcSource === this.lyricParser?.lyricSource;
            const manualOffset =
                getMediaExtraProperty(currentMusicItem, "lyricOffset") || 0;
            await this.applyLyricSource(
                currentMusicItem,
                lrcSource,
                keepsRecognizedAlignment
                    ? this.recognizedSegmentStart! - manualOffset
                    : manualOffset * -1,
                ignoreProgress,
                keepsRecognizedAlignment ? this.recognizedSong : undefined,
                requestRevision,
            );

            if (requestRevision !== this.lyricRequestRevision) return;

            const currentLyric = getDefaultStore().get(currentLyricItemAtom);
            const parser = this.lyricParser;

            if (this.appConfig.getConfig("lyric.showStatusBarLyric")) {
                if (currentLyric && parser) {
                    LyricUtil.setStatusBarLyricText(
                        (currentLyric?.lrc ?? "") +
                        (parser.hasTranslation
                            ? `\n${currentLyric?.translation ?? ""}`
                            : ""),
                    );
                } else {
                    const musicItem = this.trackPlayer.currentMusic;
                    LyricUtil.setStatusBarLyricText(musicItem ? `${musicItem.title} - ${musicItem.artist}` : "MusicFree");
                }
            }
        } catch (err) {
            if (
                requestRevision === this.lyricRequestRevision &&
                this.trackPlayer.isCurrentMusic(currentMusicItem)
            ) {
                this.lyricParser = null;
                this.setLyricAsNoLyricState();
            }
        }
    }

    /**
     * 检索最接近的歌词
     * @param musicItem 
     * @returns 
     */
    private async searchSimilarLyric(
        musicItem: IMusic.IMusicItem,
        isObsolete: () => boolean = () =>
            !this.trackPlayer.isCurrentMusic(musicItem),
        excludedPlatform: string = musicItem.platform,
    ) {
        const keyword = musicItem.alias || musicItem.title;
        const plugins = this.pluginManager.getSortedSearchablePlugins("lyric");
        const matches: Array<{
            score: number;
            musicItem: IMusic.IMusicItem;
            plugin: Plugin;
        }> = [];

        for (let plugin of plugins) {
            if (isObsolete()) return null;

            if (plugin.name === excludedPlatform) continue;

            const results = await plugin.methods
                .search(keyword, 1, "lyric")
                .catch(() => null);
            for (const item of results?.data?.slice(0, 5) || []) {
                const score = scoreLyricCandidate(musicItem, item);
                if (score <= MAX_LYRIC_MATCH_SCORE) {
                    matches.push({
                        score,
                        musicItem: item,
                        plugin,
                    });
                }
            }
        }

        matches.sort((left, right) => left.score - right.score);
        for (const match of matches) {
            if (isObsolete()) return null;
            const lyric = await match.plugin.methods
                .getLyric(match.musicItem)
                .catch(() => null);
            if (lyric) return lyric;
        }

        return null;
    }

}

const lyricManager = new LyricManager();
export default lyricManager;


export const useLyricState = () => useAtomValue(lyricStateAtom);
export const useCurrentLyricItem = () => useAtomValue(currentLyricItemAtom);
