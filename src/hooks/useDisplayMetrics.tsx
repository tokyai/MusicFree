import React, { createContext, ReactNode, useContext, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useAppConfig } from "@/core/appConfig";
import {
    getDisplayMetrics,
    DisplayMetrics,
    normalizeCarDisplayFontSize,
} from "@/utils/displayMetrics";

const defaultMetrics = getDisplayMetrics(750, 750, false, "medium");
const DisplayMetricsContext = createContext<DisplayMetrics>(defaultMetrics);

interface IDisplayMetricsProviderProps {
    children?: ReactNode;
}

export function DisplayMetricsProvider(props: IDisplayMetricsProviderProps) {
    const { children } = props;
    const { width, height } = useWindowDimensions();
    const configuredCarMode = useAppConfig("basic.carDisplayMode");
    const configuredFontSize = useAppConfig("basic.carDisplayFontSize");
    const isCarMode = configuredCarMode ?? false;
    const fontTier = normalizeCarDisplayFontSize(configuredFontSize);

    const metrics = useMemo(
        () => getDisplayMetrics(width, height, isCarMode, fontTier),
        [width, height, isCarMode, fontTier],
    );

    return (
        <DisplayMetricsContext.Provider value={metrics}>
            {children}
        </DisplayMetricsContext.Provider>
    );
}

export default function useDisplayMetrics() {
    return useContext(DisplayMetricsContext);
}
