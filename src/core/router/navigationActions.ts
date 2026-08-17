import { StackActions } from "@react-navigation/native";

export interface INavigateOptions {
    push?: boolean;
}

interface INavigationActions {
    dispatch: (action: ReturnType<typeof StackActions.push>) => unknown;
    navigate: (route: string, params?: object) => unknown;
}

/**
 * Panels live beside the stack navigator, so their navigation object does not
 * expose stack-only helpers such as `push`. Dispatching a stack action works
 * from both screens and global overlays.
 */
export default function navigateWithOptions(
    navigation: INavigationActions,
    route: string,
    params?: object,
    options?: INavigateOptions,
) {
    if (options?.push) {
        navigation.dispatch(StackActions.push(route, params));
        return;
    }
    navigation.navigate(route, params);
}
