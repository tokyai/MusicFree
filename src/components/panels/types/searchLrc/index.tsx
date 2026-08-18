import Button from "@/components/base/textButton.tsx";
import NoPlugin from "@/components/base/noPlugin";
import PanelBase from "@/components/panels/base/panelBase";
import { hidePanel } from "@/components/panels/usePanel";
import { fontSizeConst } from "@/constants/uiConst";
import { useI18N } from "@/core/i18n";
import lyricManager from "@/core/lyricManager";
import type { ILyricSearchCandidate } from "@/core/lyricSearch";
import PluginManager from "@/core/pluginManager";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx, { vmax } from "@/utils/rpx";
import Toast from "@/utils/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { TextInput } from "react-native-gesture-handler";
import LyricList from "./LyricList";
import useSearchLrc from "./useSearchLrc";

interface ISearchLrcProps {
    musicItem?: IMusic.IMusicItem | null;
}

function hasActualLyric(source: ILyric.ILyricSource | null): boolean {
    return !!(
        source?.rawLrc?.trim() ||
        source?.translation?.trim()
    );
}

export default function SearchLrc(props: ISearchLrcProps) {
    const { musicItem } = props;
    const initialQuery = musicItem?.alias?.trim()
        ? musicItem.alias
        : musicItem?.title ?? "";
    const [input, setInput] = useState(initialQuery);
    const [applyingKey, setApplyingKey] = useState<string | null>(null);
    const applyingKeyRef = React.useRef<string | null>(null);
    const colors = useColors();
    const { t } = useI18N();
    const plugins = useMemo(
        () => PluginManager.getSortedSearchablePlugins("lyric"),
        [],
    );
    const { data, search, state } = useSearchLrc(musicItem, plugins);

    useEffect(() => {
        if (initialQuery) {
            search(initialQuery);
        }
    }, [initialQuery, search]);

    const applyCandidate = useCallback(
        async (candidate: ILyricSearchCandidate) => {
            if (!musicItem || applyingKeyRef.current) {
                return;
            }
            const key = `${candidate.pluginHash}@${candidate.musicItem.platform}@${candidate.musicItem.id}`;
            applyingKeyRef.current = key;
            setApplyingKey(key);
            const targetWasCurrent = TrackPlayer.isCurrentMusic(musicItem);
            try {
                const plugin =
                    PluginManager.getByHash(candidate.pluginHash) ??
                    PluginManager.getByMedia(candidate.musicItem);
                const lyricSource =
                    (await plugin?.methods.getLyric(candidate.musicItem)) ??
                    null;
                if (!hasActualLyric(lyricSource)) {
                    throw new Error("EMPTY_LYRIC");
                }
                if (
                    targetWasCurrent &&
                    !TrackPlayer.isCurrentMusic(musicItem)
                ) {
                    throw new Error("STALE_MUSIC");
                }

                lyricManager.associateLyric(musicItem, candidate.musicItem);
                Toast.success(t("panel.searchLrc.toast.settingSuccess"));
                hidePanel();
            } catch {
                Toast.warn(t("panel.searchLrc.toast.failToSearch"));
            } finally {
                applyingKeyRef.current = null;
                setApplyingKey(null);
            }
        },
        [musicItem, t],
    );

    return (
        <PanelBase
            keyboardAvoidBehavior="none"
            height={vmax(80)}
            positionMethod="top"
            renderBody={() => (
                <View style={styles.wrapper}>
                    <View style={styles.titleContainer}>
                        <TextInput
                            value={input}
                            onChangeText={setInput}
                            onSubmitEditing={() => search(input)}
                            style={[
                                styles.input,
                                {
                                    color: colors.text,
                                    backgroundColor: colors.placeholder,
                                },
                            ]}
                            placeholderTextColor={colors.textSecondary}
                            placeholder={t("panel.searchLrc.inputPlaceholder")}
                            maxLength={80}
                        />
                        <Button
                            style={styles.searchBtn}
                            onPress={() => search(input)}>
                            {t("common.search")}
                        </Button>
                    </View>
                    <View style={styles.resultContainer}>
                        {plugins.length ? (
                            <LyricList
                                data={data}
                                state={state}
                                applyingKey={applyingKey}
                                onPress={applyCandidate}
                            />
                        ) : (
                            <NoPlugin
                                notSupportType={t(
                                    "panel.searchLrc.notSupported",
                                )}
                            />
                        )}
                    </View>
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        paddingTop: rpx(36),
        flex: 1,
        minHeight: 0,
    },
    titleContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: rpx(6),
        paddingHorizontal: rpx(24),
    },
    input: {
        borderRadius: rpx(12),
        fontSize: fontSizeConst.content,
        lineHeight: fontSizeConst.content * 1.5,
        padding: rpx(12),
        flex: 1,
        minWidth: 0,
    },
    searchBtn: {
        marginLeft: rpx(12),
    },
    resultContainer: {
        flex: 1,
        minHeight: 0,
    },
});
