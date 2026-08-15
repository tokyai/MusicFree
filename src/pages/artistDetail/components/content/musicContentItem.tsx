import React from "react";
import MusicItem from "@/components/mediaItem/musicItem";

interface IMusicContentProps {
    item: IMusic.IMusicItem;
    tableMode?: boolean;
}
export default function MusicContentItem(props: IMusicContentProps) {
    const { item, tableMode } = props;
    return <MusicItem musicItem={item} tableMode={tableMode} />;
}
