import Config from "@/core/appConfig";
import PluginManager from "@/core/pluginManager";
import TrackPlayer from "@/core/trackPlayer";
import { isMpvVideoSupported } from "@/native/mpvVideo";
import type { IAppConfig } from "@/types/core/config";
import type { IPluginManager } from "@/types/core/pluginManager";
import type { ITrackPlayer } from "@/types/core/trackPlayer";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { nanoid } from "nanoid/non-secure";

export type MusicVideoPlayer = "exo" | "mpv";

export interface IMusicVideoSession {
    id: string;
    musicItem: IMusic.IMusicItem;
    result: IPlugin.IMusicVideoResult;
    sourceIndex: number;
    attemptedSourceIndexes: number[];
    player: MusicVideoPlayer;
    audioWasPlaying: boolean;
}

export type PrepareMusicVideoResult =
    | { status: "ready"; session: IMusicVideoSession }
    | { status: "unsupported" | "unavailable" | "stale" };

interface IMusicVideoManagerDependencies {
    config: IAppConfig;
    pluginManager: Pick<IPluginManager, "getByMedia">;
    trackPlayer: Pick<
        ITrackPlayer,
        "currentMusic" | "isCurrentMusic" | "isPlaying" | "pause" | "play"
    >;
    isMpvSupported: () => boolean;
    createSessionId: () => string;
}

const sessionAtom = atom<IMusicVideoSession | null>(null);

export function selectPreferredMusicVideoSource(
    sources: IPlugin.IMusicVideoSource[],
    preferredHeight: number,
): number {
    const safePreference =
        Number.isFinite(preferredHeight) && preferredHeight > 0
            ? preferredHeight
            : 1080;
    const preferredIndex = sources.findIndex(
        source => source.height <= safePreference,
    );
    return preferredIndex >= 0 ? preferredIndex : Math.max(0, sources.length - 1);
}

export function findNextLowerMusicVideoSource(
    sources: IPlugin.IMusicVideoSource[],
    currentIndex: number,
    attemptedIndexes: number[],
): number | null {
    const currentHeight = sources[currentIndex]?.height ?? Infinity;
    const attempted = new Set(attemptedIndexes);
    const nextIndex = sources.findIndex(
        (source, index) =>
            source.height < currentHeight && !attempted.has(index),
    );
    return nextIndex >= 0 ? nextIndex : null;
}

export class MusicVideoManager {
    private dependencies: IMusicVideoManagerDependencies;

    constructor(dependencies?: Partial<IMusicVideoManagerDependencies>) {
        this.dependencies = {
            config: Config,
            pluginManager: PluginManager,
            trackPlayer: TrackPlayer,
            isMpvSupported: isMpvVideoSupported,
            createSessionId: () => nanoid(),
            ...dependencies,
        };
    }

    get session(): IMusicVideoSession | null {
        return getDefaultStore().get(sessionAtom);
    }

    getSession(sessionId: string): IMusicVideoSession | null {
        const session = this.session;
        return session?.id === sessionId ? session : null;
    }

    async prepareSession(
        musicItem: IMusic.IMusicItem,
    ): Promise<PrepareMusicVideoResult> {
        const plugin = this.dependencies.pluginManager.getByMedia(musicItem);
        if (!plugin?.supportedMethods.has("getMusicVideo")) {
            return { status: "unsupported" };
        }

        const result = await plugin.methods.getMusicVideo(musicItem);
        if (!result) {
            return { status: "unavailable" };
        }
        if (!this.dependencies.trackPlayer.isCurrentMusic(musicItem)) {
            return { status: "stale" };
        }

        const audioWasPlaying = await this.dependencies.trackPlayer.isPlaying();
        if (!this.dependencies.trackPlayer.isCurrentMusic(musicItem)) {
            return { status: "stale" };
        }
        if (audioWasPlaying) {
            await this.dependencies.trackPlayer.pause();
            if (!this.dependencies.trackPlayer.isCurrentMusic(musicItem)) {
                await this.dependencies.trackPlayer.play();
                return { status: "stale" };
            }
        }

        const preferredHeight =
            this.dependencies.config.getConfig("mv.preferredHeight") ?? 1080;
        const sourceIndex = selectPreferredMusicVideoSource(
            result.sources,
            preferredHeight,
        );
        const preferredPlayer =
            this.dependencies.config.getConfig("mv.defaultPlayer") ?? "exo";
        const player =
            preferredPlayer === "mpv" && this.dependencies.isMpvSupported()
                ? "mpv"
                : "exo";
        const session: IMusicVideoSession = {
            id: this.dependencies.createSessionId(),
            musicItem,
            result,
            sourceIndex,
            attemptedSourceIndexes: [sourceIndex],
            player,
            audioWasPlaying,
        };
        getDefaultStore().set(sessionAtom, session);
        return { status: "ready", session };
    }

    selectSource(sessionId: string, sourceIndex: number): boolean {
        const session = this.getSession(sessionId);
        const source = session?.result.sources[sourceIndex];
        if (!session || !source) {
            return false;
        }
        this.dependencies.config.setConfig("mv.preferredHeight", source.height);
        getDefaultStore().set(sessionAtom, {
            ...session,
            sourceIndex,
            attemptedSourceIndexes: [sourceIndex],
        });
        return true;
    }

    selectNextLowerSource(sessionId: string): number | null {
        const session = this.getSession(sessionId);
        if (!session) {
            return null;
        }
        const sourceIndex = findNextLowerMusicVideoSource(
            session.result.sources,
            session.sourceIndex,
            session.attemptedSourceIndexes,
        );
        if (sourceIndex === null) {
            return null;
        }
        getDefaultStore().set(sessionAtom, {
            ...session,
            sourceIndex,
            attemptedSourceIndexes: [
                ...session.attemptedSourceIndexes,
                sourceIndex,
            ],
        });
        return sourceIndex;
    }

    switchSessionPlayer(sessionId: string): MusicVideoPlayer | null {
        const session = this.getSession(sessionId);
        if (!session) {
            return null;
        }
        const player: MusicVideoPlayer =
            session.player === "exo" && this.dependencies.isMpvSupported()
                ? "mpv"
                : "exo";
        getDefaultStore().set(sessionAtom, {
            ...session,
            player,
            attemptedSourceIndexes: [session.sourceIndex],
        });
        return player;
    }

    async closeSession(sessionId: string): Promise<void> {
        const session = this.getSession(sessionId);
        if (!session) {
            return;
        }
        getDefaultStore().set(sessionAtom, null);
        if (
            session.audioWasPlaying &&
            this.dependencies.trackPlayer.isCurrentMusic(session.musicItem)
        ) {
            await this.dependencies.trackPlayer.play();
        }
    }
}

const musicVideoManager = new MusicVideoManager();

export function useMusicVideoSession(): IMusicVideoSession | null {
    return useAtomValue(sessionAtom);
}

export default musicVideoManager;
