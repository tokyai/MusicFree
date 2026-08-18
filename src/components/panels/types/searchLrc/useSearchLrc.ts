import { RequestStateCode } from "@/constants/commonConst";
import {
    ILyricSearchCandidate,
    searchLyricCandidates,
} from "@/core/lyricSearch";
import type { Plugin } from "@/core/pluginManager";
import { errorLog } from "@/utils/log";
import { useCallback, useEffect, useRef, useState } from "react";

export default function useSearchLrc(
    musicItem: IMusic.IMusicItem | null | undefined,
    plugins: Plugin[],
) {
    const [state, setState] = useState(RequestStateCode.IDLE);
    const [data, setData] = useState<ILyricSearchCandidate[]>([]);
    const revisionRef = useRef(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            revisionRef.current += 1;
        };
    }, []);

    const search = useCallback(
        async (query: string) => {
            const normalizedQuery = query.trim();
            const revision = ++revisionRef.current;
            if (!musicItem || !normalizedQuery || !plugins.length) {
                setData([]);
                setState(RequestStateCode.FINISHED);
                return;
            }

            setData([]);
            setState(RequestStateCode.PENDING_FIRST_PAGE);
            try {
                const candidates = await searchLyricCandidates(
                    normalizedQuery,
                    musicItem,
                    plugins,
                );
                if (
                    mountedRef.current &&
                    revision === revisionRef.current
                ) {
                    setData(candidates);
                    setState(RequestStateCode.FINISHED);
                }
            } catch (error: any) {
                errorLog("搜索歌词失败", error?.message);
                if (
                    mountedRef.current &&
                    revision === revisionRef.current
                ) {
                    setData([]);
                    setState(RequestStateCode.ERROR);
                }
            }
        },
        [musicItem, plugins],
    );

    return { data, search, state };
}
