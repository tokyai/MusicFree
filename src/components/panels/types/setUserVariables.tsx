import React, { useRef } from "react";
import {
    KeyboardAvoidingView,
    StyleSheet,
    TextInputProps,
} from "react-native";
import rpx, { vmax } from "@/utils/rpx";
import useColors from "@/hooks/useColors";

import ThemeText from "@/components/base/themeText";
import { ScrollView } from "react-native-gesture-handler";
import PanelBase from "../base/panelBase";
import { hidePanel } from "../usePanel";
import ListItem from "@/components/base/listItem";
import Input from "@/components/base/input";
import globalStyle from "@/constants/globalStyle";
import PanelHeader from "../base/panelHeader";

export interface IUserVariablesProps {
    title?: string;
    onOk: (values: Record<string, string>, closePanel: () => void) => void;
    variables: IPlugin.IUserVariable[];
    initValues?: Record<string, string>;
    onCancel?: () => void;
    secureKeys?: string[];
    keyboardTypes?: Record<string, TextInputProps["keyboardType"]>;
}

export default function SetUserVariables(props: IUserVariablesProps) {
    const {
        onOk,
        onCancel,
        variables,
        initValues = {},
        title,
        secureKeys = [],
        keyboardTypes = {},
    } = props;

    const colors = useColors();

    const resultRef = useRef({ ...initValues });

    return (
        <PanelBase
            height={vmax(80)}
            positionMethod='top'
            keyboardAvoidBehavior='none'
            renderBody={() => (
                <>
                    <PanelHeader
                        title={title ?? "设置用户变量"}
                        onCancel={() => {
                            onCancel?.();
                            hidePanel();
                        }}
                        onOk={async () => {
                            onOk(resultRef.current, hidePanel);
                        }}
                    />
                    <KeyboardAvoidingView
                        behavior="padding"
                        style={globalStyle.flex1}>
                        <ScrollView
                            contentContainerStyle={{
                                paddingBottom: vmax(20),
                            }}>
                            {variables.map(it => (
                                <ListItem
                                    withHorizontalPadding
                                    style={styles.listItem}>
                                    <ThemeText
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                        style={styles.varName}>
                                        {it.name ?? it.key}
                                    </ThemeText>
                                    <Input
                                        defaultValue={initValues[it.key]}
                                        onChangeText={e => {
                                            resultRef.current[it.key] = e;
                                        }}
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor:
                                                    colors.placeholder,
                                            },
                                        ]}
                                        placeholder={it.hint}
                                        secureTextEntry={secureKeys.includes(it.key)}
                                        keyboardType={keyboardTypes[it.key]}
                                    />
                                </ListItem>
                            ))}
                        </ScrollView>
                    </KeyboardAvoidingView>
                </>
            )}
        />
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
    },
    opeartions: {
        width: "100%",
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        height: rpx(100),
        alignItems: "center",
        justifyContent: "space-between",
    },
    listItem: {
        justifyContent: "space-between",
    },
    varName: {
        maxWidth: "35%",
    },
    input: {
        width: "50%",
        paddingVertical: rpx(8),
        paddingHorizontal: rpx(12),
        borderRadius: rpx(8),
    },
});
