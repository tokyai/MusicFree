import { URL } from "react-native-url-polyfill";

const MAX_ID_LENGTH = 256;
const MAX_TEXT_LENGTH = 512;
const MAX_URL_LENGTH = 8192;
const MAX_HEADER_NAME_LENGTH = 128;
const MAX_HEADER_VALUE_LENGTH = 4096;

function readString(
    value: unknown,
    maxLength: number,
): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) {
        return undefined;
    }
    return normalized;
}

function readHttpUrl(value: unknown): string | undefined {
    const url = readString(value, MAX_URL_LENGTH);
    if (!url) {
        return undefined;
    }
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:"
            ? url
            : undefined;
    } catch {
        return undefined;
    }
}

function readHeaders(value: unknown): Record<string, string> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }

    const headers: Record<string, string> = {};
    Object.entries(value).forEach(([key, headerValue]) => {
        const normalizedKey = readString(key, MAX_HEADER_NAME_LENGTH);
        const normalizedValue = readString(
            headerValue,
            MAX_HEADER_VALUE_LENGTH,
        );
        if (normalizedKey && normalizedValue) {
            headers[normalizedKey] = normalizedValue;
        }
    });
    return Object.keys(headers).length ? headers : undefined;
}

function normalizeSource(value: unknown): IPlugin.IMusicVideoSource | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const source = value as Record<string, unknown>;
    const url = readHttpUrl(source.url);
    const height = Number(source.height);
    if (!url || !Number.isFinite(height) || height <= 0) {
        return null;
    }

    const normalizedHeight = Math.round(height);
    return {
        quality:
            readString(source.quality, MAX_TEXT_LENGTH) ??
            `${normalizedHeight}p`,
        height: normalizedHeight,
        url,
        headers: readHeaders(source.headers),
        mimeType: readString(source.mimeType, MAX_TEXT_LENGTH),
    };
}

export function normalizeMusicVideoResult(
    value: unknown,
): IPlugin.IMusicVideoResult | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const result = value as Record<string, unknown>;
    const id = readString(result.id, MAX_ID_LENGTH);
    if (!id || !Array.isArray(result.sources)) {
        return null;
    }

    const seenHeights = new Set<number>();
    const sources = result.sources
        .map(normalizeSource)
        .filter((source): source is IPlugin.IMusicVideoSource => !!source)
        .filter(source => {
            if (seenHeights.has(source.height)) {
                return false;
            }
            seenHeights.add(source.height);
            return true;
        })
        .sort((a, b) => b.height - a.height);

    if (!sources.length) {
        return null;
    }

    return {
        id,
        title: readString(result.title, MAX_TEXT_LENGTH),
        artist: readString(result.artist, MAX_TEXT_LENGTH),
        artwork: readHttpUrl(result.artwork),
        sources,
    };
}
