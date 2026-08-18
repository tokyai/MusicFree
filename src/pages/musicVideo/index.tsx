import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import musicVideoManager, {
    useMusicVideoSession,
} from "@/core/musicVideoManager";
import { ROUTE_PATH, useParams } from "@/core/router";
import { useI18N } from "@/core/i18n";
import useDisplayMetrics from "@/hooks/useDisplayMetrics";
import { isMpvVideoSupported } from "@/native/mpvVideo";
import timeformat from "@/utils/timeformat";
import Slider from "@react-native-community/slider";
import { useNavigation } from "@react-navigation/native";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    AppState,
    Pressable,
    StatusBar,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ExoPlayer from "./exoPlayer";
import MpvPlayer from "./mpvPlayer";
import { IMusicVideoPlayerHandle } from "./playerTypes";

export default function MusicVideo() {
    const params = useParams<typeof ROUTE_PATH.MUSIC_VIDEO>();
    const navigation = useNavigation();
    const session = useMusicVideoSession();
    const activeSession =
        session?.id === params?.sessionId ? session : null;
    const sessionId = params?.sessionId ?? "";
    const { t } = useI18N();
    const displayMetrics = useDisplayMetrics();
    const playerRef = useRef<IMusicVideoPlayerHandle>(null);
    const currentPositionRef = useRef(0);
    const desiredSeekRef = useRef(0);
    const recoveringRef = useRef(false);
    const slidingRef = useRef(false);
    const [paused, setPaused] = useState(false);
    const [loading, setLoading] = useState(true);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [slidingPosition, setSlidingPosition] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryRevision, setRetryRevision] = useState(0);

    const source = activeSession?.result.sources[activeSession.sourceIndex];
    const playbackKey = activeSession
        ? `${activeSession.player}:${activeSession.sourceIndex}:${retryRevision}`
        : "missing";
    const touchTarget = displayMetrics.isCarMode
        ? displayMetrics.minTouchTarget
        : 48;
    const controlIconSize = displayMetrics.isCarMode
        ? displayMetrics.iconSizes.normal
        : 30;

    useEffect(() => {
        return () => {
            if (sessionId) {
                musicVideoManager.closeSession(sessionId).catch(() => undefined);
            }
        };
    }, [sessionId]);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", state => {
            if (state !== "active") {
                setPaused(true);
            }
        });
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        recoveringRef.current = false;
        setLoading(true);
        setError(null);
    }, [playbackKey]);

    const seekAfterLoad = useCallback(() => {
        const seekPosition = desiredSeekRef.current;
        desiredSeekRef.current = 0;
        if (seekPosition > 0) {
            requestAnimationFrame(() => {
                playerRef.current?.seek(seekPosition);
            });
        }
    }, []);

    const selectQuality = useCallback(() => {
        if (!activeSession) {
            return;
        }
        showDialog("RadioDialog", {
            title: t("musicVideo.quality"),
            defaultSelected: activeSession.sourceIndex,
            content: activeSession.result.sources.map((item, index) => ({
                label: item.quality || `${item.height}p`,
                value: index,
            })),
            onOk(value) {
                desiredSeekRef.current = currentPositionRef.current;
                musicVideoManager.selectSource(sessionId, Number(value));
            },
        });
    }, [activeSession, sessionId, t]);

    const selectPlayer = useCallback(() => {
        if (!activeSession) {
            return;
        }
        const players = [
            { label: "ExoPlayer", value: "exo" },
            ...(isMpvVideoSupported()
                ? [{ label: "MPV", value: "mpv" }]
                : []),
        ];
        showDialog("RadioDialog", {
            title: t("musicVideo.player"),
            defaultSelected: activeSession.player,
            content: players,
            onOk(value) {
                if (value !== activeSession.player) {
                    desiredSeekRef.current = currentPositionRef.current;
                    musicVideoManager.switchSessionPlayer(sessionId);
                }
            },
        });
    }, [activeSession, sessionId, t]);

    const handlePlaybackError = useCallback(() => {
        if (recoveringRef.current || !activeSession) {
            return;
        }
        recoveringRef.current = true;
        desiredSeekRef.current = currentPositionRef.current;
        const nextSource = musicVideoManager.selectNextLowerSource(sessionId);
        if (nextSource !== null) {
            return;
        }
        setPaused(true);
        setLoading(false);
        setError(t("musicVideo.playbackFailed"));
    }, [activeSession, sessionId, t]);

    const retry = useCallback(() => {
        recoveringRef.current = false;
        desiredSeekRef.current = currentPositionRef.current;
        setError(null);
        setLoading(true);
        setRetryRevision(value => value + 1);
    }, []);

    const tryOtherPlayer = useCallback(() => {
        if (!activeSession) {
            return;
        }
        desiredSeekRef.current = currentPositionRef.current;
        const nextPlayer = musicVideoManager.switchSessionPlayer(sessionId);
        if (nextPlayer) {
            setPaused(false);
        }
    }, [activeSession, sessionId]);

    const canTryOtherPlayer = useMemo(() => {
        if (!activeSession) {
            return false;
        }
        return activeSession.player === "mpv" || isMpvVideoSupported();
    }, [activeSession]);

    if (!activeSession || !source) {
        return (
            <SafeAreaView style={styles.missingPage}>
                <StatusBar hidden />
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("musicVideo.back")}
                    style={[styles.backButton, { width: touchTarget, height: touchTarget }]}
                    onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={controlIconSize} color="white" />
                </Pressable>
                <ThemeText color="white" fontSize="title">
                    {t("musicVideo.sessionUnavailable")}
                </ThemeText>
            </SafeAreaView>
        );
    }

    const Player = activeSession.player === "mpv" ? MpvPlayer : ExoPlayer;
    const displayedPosition = slidingPosition ?? position;

    return (
        <SafeAreaView style={styles.page} edges={["top", "bottom", "left", "right"]}>
            <StatusBar hidden />
            <View style={styles.videoContainer}>
                <Player
                    key={playbackKey}
                    ref={playerRef}
                    source={source}
                    paused={paused}
                    onLoadStart={() => setLoading(true)}
                    onLoad={data => {
                        setDuration(data.duration);
                        setLoading(false);
                        seekAfterLoad();
                    }}
                    onProgress={data => {
                        const nextDuration = data.duration > 0
                            ? data.duration
                            : duration;
                        currentPositionRef.current = data.currentTime;
                        if (!slidingRef.current) {
                            setPosition(data.currentTime);
                        }
                        if (nextDuration > 0) {
                            setDuration(nextDuration);
                        }
                    }}
                    onBuffer={setLoading}
                    onEnd={() => {
                        currentPositionRef.current = duration;
                        setPosition(duration);
                        setPaused(true);
                    }}
                    onError={handlePlaybackError}
                />
            </View>

            <View style={styles.topBar}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("musicVideo.back")}
                    style={[styles.iconButton, { width: touchTarget, height: touchTarget }]}
                    onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={controlIconSize} color="white" />
                </Pressable>
                <View style={styles.titleContainer}>
                    <ThemeText
                        color="white"
                        fontSize="title"
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {activeSession.result.title ?? activeSession.musicItem.title}
                    </ThemeText>
                    <ThemeText
                        color="#d0d0d0"
                        fontSize="description"
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {activeSession.result.artist ?? activeSession.musicItem.artist}
                    </ThemeText>
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("musicVideo.quality")}
                    style={[styles.menuButton, { minHeight: touchTarget }]}
                    onPress={selectQuality}>
                    <ThemeText color="white" fontSize="description" numberOfLines={1}>
                        {source.quality || `${source.height}p`}
                    </ThemeText>
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("musicVideo.player")}
                    style={[styles.menuButton, { minHeight: touchTarget }]}
                    onPress={selectPlayer}>
                    <ThemeText color="white" fontSize="description" numberOfLines={1}>
                        {activeSession.player === "mpv" ? "MPV" : "ExoPlayer"}
                    </ThemeText>
                </Pressable>
            </View>

            {loading && !error ? (
                <View pointerEvents="none" style={styles.centerOverlay}>
                    <ActivityIndicator size="large" color="#ffffff" />
                </View>
            ) : null}

            {error ? (
                <View style={styles.errorOverlay}>
                    <ThemeText color="white" fontSize="title" numberOfLines={2}>
                        {error}
                    </ThemeText>
                    <View style={styles.errorActions}>
                        <Pressable
                            accessibilityRole="button"
                            style={[styles.commandButton, { minHeight: touchTarget }]}
                            onPress={retry}>
                            <Icon name="arrow-path" size={controlIconSize} color="white" />
                            <ThemeText color="white">{t("musicVideo.retry")}</ThemeText>
                        </Pressable>
                        {canTryOtherPlayer ? (
                            <Pressable
                                accessibilityRole="button"
                                style={[styles.commandButton, { minHeight: touchTarget }]}
                                onPress={tryOtherPlayer}>
                                <Icon name="motion-play" size={controlIconSize} color="white" />
                                <ThemeText color="white">
                                    {t("musicVideo.tryOtherPlayer")}
                                </ThemeText>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            ) : null}

            <View style={styles.bottomBar}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={paused ? t("common.play") : t("musicVideo.pause")}
                    style={[styles.iconButton, { width: touchTarget, height: touchTarget }]}
                    onPress={() => {
                        if (duration > 0 && position >= duration - 0.5) {
                            desiredSeekRef.current = 0;
                            currentPositionRef.current = 0;
                            setPosition(0);
                            setPaused(false);
                            setRetryRevision(value => value + 1);
                            return;
                        }
                        setPaused(value => !value);
                    }}>
                    <Icon
                        name={paused ? "play" : "pause"}
                        size={controlIconSize}
                        color="white"
                    />
                </Pressable>
                <ThemeText color="#d0d0d0" fontSize="description" style={styles.time}>
                    {timeformat(Math.max(displayedPosition, 0))}
                </ThemeText>
                <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={Math.max(duration, 0)}
                    value={Math.min(displayedPosition, Math.max(duration, 0))}
                    minimumTrackTintColor="#f0f0f0"
                    maximumTrackTintColor="#777777"
                    thumbTintColor="#ffffff"
                    onSlidingStart={() => {
                        slidingRef.current = true;
                    }}
                    onValueChange={setSlidingPosition}
                    onSlidingComplete={value => {
                        slidingRef.current = false;
                        setSlidingPosition(null);
                        currentPositionRef.current = value;
                        setPosition(value);
                        playerRef.current?.seek(value);
                    }}
                />
                <ThemeText color="#d0d0d0" fontSize="description" style={styles.time}>
                    {timeformat(Math.max(duration, 0))}
                </ThemeText>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: "#000000",
    },
    missingPage: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        backgroundColor: "#000000",
    },
    videoContainer: {
        flex: 1,
        backgroundColor: "#000000",
    },
    topBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2,
        minHeight: 72,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "rgba(0,0,0,0.72)",
    },
    titleContainer: {
        flex: 1,
        minWidth: 0,
    },
    iconButton: {
        alignItems: "center",
        justifyContent: "center",
    },
    backButton: {
        position: "absolute",
        top: 12,
        left: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    menuButton: {
        maxWidth: 160,
        minWidth: 76,
        paddingHorizontal: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#888888",
        borderRadius: 6,
        backgroundColor: "rgba(32,32,32,0.92)",
    },
    centerOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },
    errorOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        paddingHorizontal: 24,
        backgroundColor: "rgba(0,0,0,0.72)",
    },
    errorActions: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 12,
    },
    commandButton: {
        minWidth: 132,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#aaaaaa",
        borderRadius: 6,
        backgroundColor: "#242424",
    },
    bottomBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2,
        minHeight: 76,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.78)",
    },
    slider: {
        flex: 1,
        height: 48,
        marginHorizontal: 8,
    },
    time: {
        width: 70,
        textAlign: "center",
    },
});
