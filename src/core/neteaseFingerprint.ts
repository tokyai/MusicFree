import { atom, getDefaultStore, useAtomValue } from "jotai";

export interface INeteaseFingerprintRequest {
    id: number;
    audioBase64: string;
}

export interface INeteaseFingerprintResult {
    fingerprint: string;
    queryOffsetSeconds: number;
}

class NeteaseFingerprintAbortError extends Error {
    name = "AbortError";

    constructor(message = "Netease fingerprint request was cancelled") {
        super(message);
    }
}

export const neteaseFingerprintRequestAtom =
    atom<INeteaseFingerprintRequest | null>(null);

const FINGERPRINT_TIMEOUT_MS = 30_000;

let requestId = 0;
let pendingRequest: {
    id: number;
    resolve: (result: INeteaseFingerprintResult) => void;
    reject: (error: Error) => void;
    signal?: AbortSignal;
    onAbort?: () => void;
    timeout: ReturnType<typeof setTimeout>;
} | null = null;

function clearPendingRequest() {
    const request = pendingRequest;
    pendingRequest = null;
    getDefaultStore().set(neteaseFingerprintRequestAtom, null);
    if (request) clearTimeout(request.timeout);
    if (request?.signal && request.onAbort) {
        request.signal.removeEventListener("abort", request.onAbort);
    }
    return request;
}

export function cancelNeteaseFingerprint(): void {
    clearPendingRequest()?.reject(new NeteaseFingerprintAbortError());
}

export function requestNeteaseFingerprint(
    audioBase64: string,
    signal?: AbortSignal,
): Promise<INeteaseFingerprintResult> {
    if (signal?.aborted) {
        return Promise.reject(new NeteaseFingerprintAbortError());
    }

    cancelNeteaseFingerprint();

    const id = ++requestId;
    return new Promise<INeteaseFingerprintResult>((resolve, reject) => {
        const onAbort = () => {
            if (pendingRequest?.id !== id) return;
            clearPendingRequest()?.reject(new NeteaseFingerprintAbortError());
        };
        const timeout = setTimeout(() => {
            if (pendingRequest?.id !== id) return;
            clearPendingRequest()?.reject(
                new Error("Netease fingerprint request timed out"),
            );
        }, FINGERPRINT_TIMEOUT_MS);
        pendingRequest = { id, resolve, reject, signal, onAbort, timeout };
        signal?.addEventListener("abort", onAbort, { once: true });
        getDefaultStore().set(neteaseFingerprintRequestAtom, {
            id,
            audioBase64,
        });
    });
}

export function resolveNeteaseFingerprint(
    id: number,
    result?: INeteaseFingerprintResult,
    error?: string,
): void {
    if (!pendingRequest || pendingRequest.id !== id) return;
    const request = clearPendingRequest();
    if (!request) return;
    if (error || !result?.fingerprint) {
        request.reject(new Error(error || "Netease fingerprint failed"));
    } else {
        request.resolve(result);
    }
}

export function useNeteaseFingerprintRequest() {
    return useAtomValue(neteaseFingerprintRequestAtom);
}

export { NeteaseFingerprintAbortError };
