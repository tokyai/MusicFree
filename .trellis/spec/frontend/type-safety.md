# Type Safety

## Project Reality

The project extends the React Native TypeScript configuration, uses the `@/`
alias, enables `skipLibCheck`, and currently leaves `noImplicitAny` disabled.
New code should still make public and cross-layer contracts explicit.

## Contracts

- Put shared media/domain declarations under `src/types/` and keep namespace
  shapes compatible with existing `IMusic`, `IAlbum`, `IArtist`, and `ICommon`
  consumers.
- Add route names and parameter types together in
  `src/core/router/index.ts`; use `useNavigate()` and `useParams()` at screens.
- Add persisted setting keys to `src/types/core/config.d.ts`.
- Keep translation data synchronized with `src/types/core/i18n/index.d.ts` and
  every language JSON file.
- Define TypeScript interfaces for native module methods and return values in
  `src/native/<module>/index.ts`.

## Narrowing

- Narrow nullable plugin, route, and native values before use. Platform-specific
  wrappers should reject or report unsupported platforms explicitly.
- Use `unknown` at new untyped external boundaries and narrow it before domain
  use. Existing `any` casts around legacy plugin and navigation APIs are not a
  pattern to expand.
- Use `@ts-expect-error` only for a known compatibility boundary, such as a
  persisted legacy value migration, and include a short reason.

## Verification

Run `npx tsc --noEmit` after changing TypeScript, global declarations, route
contracts, configuration, i18n types, or native wrappers.

## Scenario: Stack Navigation From Global Overlays

### 1. Scope / Trigger

This applies when a panel, dialog, portal, or other component rendered beside
`Stack.Navigator` needs to create a new stack entry. These components receive
the root container navigation object rather than a screen's stack navigation
helpers.

### 2. Signatures

- `useNavigate()(route, params?, { push?: boolean })` remains the typed route
  entry point.
- `navigateWithOptions(navigation, route, params, options)` in
  `src/core/router/navigationActions.ts` owns the root-safe dispatch behavior.

### 3. Contracts

- The default path calls `navigation.navigate(route, params)` and preserves
  existing route reuse behavior.
- `{ push: true }` dispatches `StackActions.push(route, params)`; it must not
  call `navigation.push`, because the root navigation object does not expose
  navigator-specific helper methods.
- Route names and params remain owned by `RouterParams` in
  `src/core/router/index.ts`.

### 4. Validation & Error Matrix

| Context / option | Required behavior |
| --- | --- |
| Screen component, no `push` option | Call ordinary `navigate` |
| Screen component with `{ push: true }` | Dispatch a stack push action |
| Global panel with `{ push: true }` | Dispatch successfully even though `navigation.push` is absent |
| Repeated route and params with `{ push: true }` | Create a new route entry and rerun its focus lifecycle |

### 5. Good / Base / Bad Cases

- Good: a global music-options panel dispatches a stack push to a fresh search
  route, then the search page consumes its typed params.
- Base: the home search entry continues to use ordinary `navigate`.
- Bad: a global overlay calls `navigation.push(...)`; the panel closes and the
  route does not change because that helper is unavailable in its context.

### 6. Tests Required

- Unit-test the push branch with a root-like navigation double that has only
  `dispatch` and `navigate`, and assert the exact `StackActions.push` action.
- Retain a default-navigation assertion so adding the push option cannot alter
  existing callers.
- For panel-originated routes, verify the real Android interaction from panel
  click through destination focus and initial request; a destination helper
  unit test alone is insufficient.

### 7. Wrong vs Correct

```ts
// Wrong: only screen navigation props are guaranteed to expose this helper.
navigation.push("search-page", params);

// Correct: works from screens and NavigationContainer-level overlays.
navigation.dispatch(StackActions.push("search-page", params));
```
