import { describe, expect, it, jest } from "@jest/globals";
import { StackActions } from "@react-navigation/native";

import navigateWithOptions from "./navigationActions";

describe("navigateWithOptions", () => {
    it("dispatches a stack push when the root navigation has no push helper", () => {
        const navigation = {
            dispatch: jest.fn(),
            navigate: jest.fn(),
        };
        const params = {
            initialQuery: "周杰伦",
            searchRequestId: "request-id",
        };

        navigateWithOptions(navigation, "search-page", params, {
            push: true,
        });

        expect(navigation.dispatch).toHaveBeenCalledWith(
            StackActions.push("search-page", params),
        );
        expect(navigation.navigate).not.toHaveBeenCalled();
        expect("push" in navigation).toBe(false);
    });

    it("keeps ordinary navigation behavior by default", () => {
        const navigation = {
            dispatch: jest.fn(),
            navigate: jest.fn(),
        };

        navigateWithOptions(navigation, "home", undefined);

        expect(navigation.navigate).toHaveBeenCalledWith("home", undefined);
        expect(navigation.dispatch).not.toHaveBeenCalled();
    });
});
