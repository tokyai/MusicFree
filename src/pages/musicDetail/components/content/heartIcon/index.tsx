import React from "react";
import { useCurrentMusic } from "@/core/trackPlayer";
import IconButton from "@/components/base/iconButton";
import MusicSheet, { useFavorite } from "@/core/musicSheet";

export default function () {
    const musicItem = useCurrentMusic();

    const isFavorite = useFavorite(musicItem);

    return isFavorite ? (
        <IconButton
            name="heart"
            sizeType="normal"
            color="red"
            onPress={() => {
                if (!musicItem) {
                    return;
                }
                MusicSheet.removeMusic(MusicSheet.defaultSheet.id, musicItem);
            }}
        />
    ) : (
        <IconButton
            name="heart-outline"
            sizeType="normal"
            color="white"
            onPress={() => {
                if (musicItem) {
                    MusicSheet.addMusic(MusicSheet.defaultSheet.id, musicItem);
                }
            }}
        />
    );
}
