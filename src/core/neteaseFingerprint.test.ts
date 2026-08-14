import { afterEach, describe, expect, it } from "@jest/globals";
import { getDefaultStore } from "jotai";
import {
    cancelNeteaseFingerprint,
    neteaseFingerprintRequestAtom,
    requestNeteaseFingerprint,
    resolveNeteaseFingerprint,
} from "./neteaseFingerprint";

afterEach(() => cancelNeteaseFingerprint());

describe("Netease fingerprint requests", () => {
    it("resolves a sandbox result and releases the audio payload", async () => {
        const resultPromise = requestNeteaseFingerprint("audio-base64");
        const request = getDefaultStore().get(neteaseFingerprintRequestAtom);

        expect(request?.audioBase64).toBe("audio-base64");
        resolveNeteaseFingerprint(request!.id, {
            fingerprint: "fingerprint",
            queryOffsetSeconds: 4,
        });

        await expect(resultPromise).resolves.toEqual({
            fingerprint: "fingerprint",
            queryOffsetSeconds: 4,
        });
        expect(getDefaultStore().get(neteaseFingerprintRequestAtom)).toBeNull();
    });

    it("rejects and releases the payload when aborted", async () => {
        const abortController = new AbortController();
        const resultPromise = requestNeteaseFingerprint(
            "audio-base64",
            abortController.signal,
        );

        abortController.abort();

        await expect(resultPromise).rejects.toMatchObject({ name: "AbortError" });
        expect(getDefaultStore().get(neteaseFingerprintRequestAtom)).toBeNull();
    });
});
