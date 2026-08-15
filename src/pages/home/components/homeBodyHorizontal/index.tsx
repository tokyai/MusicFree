import React from "react";
import { View } from "react-native";
import globalStyle from "@/constants/globalStyle";
import Operations from "./operations";
import Sheets from "../homeBody/sheets";
import ResponsiveSplitView from "@/components/base/responsiveSplitView";

export default function HomeBodyHorizontal() {
    return (
        <ResponsiveSplitView
            primary={<Operations />}
            secondary={
                <View style={globalStyle.flex1}>
                    <Sheets />
                </View>
            }
        />
    );
}
