interface IInitialMusicSearchActions {
    resetResults: () => void;
    setQuery: (query: string) => void;
    setSearching: () => void;
    search: (
        query: string,
        page: number,
        type: ICommon.SupportMediaType,
    ) => unknown;
}

/** Run on every route focus; intentionally does not deduplicate equal queries. */
export function runInitialMusicSearch(
    query: string | undefined,
    actions: IInitialMusicSearchActions,
) {
    if (!query) return false;

    actions.resetResults();
    actions.setQuery(query);
    actions.setSearching();
    actions.search(query, 1, "music");
    return true;
}
