import React from "react";
import MusicItem from "@/components/mediaItem/musicItem";

interface IMusicContentProps {
    item: IMusic.IMusicItem;
    tableMode?: boolean;
    compactTable?: boolean;
}
export default function MusicContentItem(props: IMusicContentProps) {
    const { item, tableMode, compactTable } = props;
    return (
        <MusicItem
            musicItem={item}
            tableMode={tableMode}
            compactTable={compactTable}
        />
    );
}
