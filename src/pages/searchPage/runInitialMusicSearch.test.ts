import { describe, expect, it, jest } from "@jest/globals";

import { runInitialMusicSearch } from "./runInitialMusicSearch";

function createActions() {
    return {
        resetResults: jest.fn(),
        setQuery: jest.fn(),
        setSearching: jest.fn(),
        search: jest.fn(),
    };
}

describe("runInitialMusicSearch", () => {
    it("does nothing for a manual search route", () => {
        const actions = createActions();

        expect(runInitialMusicSearch(undefined, actions)).toBe(false);
        expect(actions.resetResults).not.toHaveBeenCalled();
        expect(actions.search).not.toHaveBeenCalled();
    });

    it("resets state and starts a music search on focus", () => {
        const actions = createActions();

        expect(runInitialMusicSearch("周杰伦", actions)).toBe(true);
        expect(actions.resetResults).toHaveBeenCalledTimes(1);
        expect(actions.setQuery).toHaveBeenCalledWith("周杰伦");
        expect(actions.setSearching).toHaveBeenCalledTimes(1);
        expect(actions.search).toHaveBeenCalledWith("周杰伦", 1, "music");
    });

    it("starts the same query again on a later focus", () => {
        const actions = createActions();

        runInitialMusicSearch("同一专辑", actions);
        runInitialMusicSearch("同一专辑", actions);

        expect(actions.resetResults).toHaveBeenCalledTimes(2);
        expect(actions.search).toHaveBeenCalledTimes(2);
    });
});
