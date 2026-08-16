import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import globalStyle from "@/constants/globalStyle";
import { ScrollView } from "react-native-gesture-handler";
import TypeTag from "../../../../components/base/typeTag";

import useRecommendList from "../../hooks/useRecommendListTags";
import SheetList from "./sheetList";
import { hidePanel, showPanel } from "@/components/panels/usePanel";
import { useI18N } from "@/core/i18n";
import useOrientation from "@/hooks/useOrientation";
import LandscapeNavigationRail, {
    ILandscapeNavigationRailItem,
    ILandscapeNavigationRailSection,
} from "@/components/base/landscapeNavigationRail";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";

interface ILandscapeSource {
    items: ILandscapeNavigationRailItem[];
    selectedKey: string;
    onSelect: (key: string) => void;
}

interface IProps {
    hash: string;
    defaultTag: ICommon.IUnique;
    selectedTag: ICommon.IUnique;
    firstTag: ICommon.IUnique;
    onTagSelect: (
        tag: ICommon.IUnique,
        showAsFirstTag: boolean,
    ) => void;
    landscapeSource?: ILandscapeSource;
}


function SheetBody(props: IProps) {
    const {
        hash,
        defaultTag,
        selectedTag,
        firstTag,
        onTagSelect,
        landscapeSource,
    } = props;

    const { t } = useI18N();
    const orientation = useOrientation();

    // 所有tag
    const tags = useRecommendList(hash);

    if (orientation === "horizontal" && landscapeSource) {
        const pinnedTags = [defaultTag, ...(tags?.pinned ?? [])];
        const sections: ILandscapeNavigationRailSection[] = [
            {
                key: "sources",
                title: t("common.source"),
                items: landscapeSource.items,
                selectedKey: landscapeSource.selectedKey,
                onSelect: landscapeSource.onSelect,
            },
            {
                key: "pinned-tags",
                title: t("panel.sheetTags.title"),
                items: pinnedTags.map(tag => ({
                    key: tag.id,
                    title: tag.title ?? t("common.unknownName"),
                })),
                selectedKey: selectedTag.id,
                onSelect: key => {
                    const tag = pinnedTags.find(item => item.id === key);
                    if (tag) {
                        onTagSelect(tag, tag.id === defaultTag.id);
                    }
                },
            },
            ...(tags?.data ?? []).map((tagGroup, groupIndex) => ({
                key: `tag-group-${groupIndex}`,
                title: tagGroup.title,
                items: tagGroup.data.map(tag => ({
                    key: tag.id,
                    title: tag.title ?? t("common.unknownName"),
                })),
                selectedKey: selectedTag.id,
                onSelect: (key: string) => {
                    const tag = tagGroup.data.find(item => item.id === key);
                    if (tag) {
                        onTagSelect(tag, true);
                    }
                },
            })),
        ];

        return (
            <ResponsiveSplitView
                carPreset="navigation"
                primary={<LandscapeNavigationRail sections={sections} />}
                secondary={
                    <View style={globalStyle.flex1}>
                        <SheetList tag={selectedTag} pluginHash={hash} />
                    </View>
                }
            />
        );
    }

    return (
        <View style={globalStyle.fwflex1}>
            <ScrollView
                style={style.headerWrapper}
                contentContainerStyle={style.header}
                showsHorizontalScrollIndicator={false}
                horizontal>
                <TypeTag
                    title={firstTag.title}
                    selected={selectedTag.id === firstTag.id}
                    onPress={() => {
                        // 拉起浮层
                        showPanel("SheetTags", {
                            tags: tags?.data ?? [],
                            onTagPressed(tag) {
                                onTagSelect(tag, true);
                                hidePanel();
                            },
                        });
                    }}
                />
                {(tags?.pinned ?? []).map(_ => (
                    <TypeTag
                        key={`pinned-${_.id}`}
                        title={_?.title ?? ""}
                        selected={selectedTag.id === _.id}
                        onPress={() => {
                            onTagSelect(_, false);
                        }}
                    />
                ))}
            </ScrollView>
            <SheetList tag={selectedTag} pluginHash={hash} />
        </View>
    );
}

export default memo(SheetBody);

const style = StyleSheet.create({
    headerWrapper: {
        height: rpx(100),
        flexGrow: 0,
    },
    header: {
        height: rpx(100),
        alignItems: "center",
    },
});
