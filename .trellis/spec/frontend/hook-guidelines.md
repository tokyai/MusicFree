# Hook Guidelines

## Ownership

- Put reusable subscriptions in `src/hooks/useX.ts` and page-specific query or
  coordination hooks under `src/pages/<page>/hooks/`.
- Hooks may expose core manager state, but the core manager remains the source
  of truth. Examples include `useAppConfig()` in `src/core/appConfig.ts` and
  playback hooks exported by `src/core/trackPlayer.ts`.

## Effects And Cleanup

- Pair every event subscription, timer, native task, or async request with
  cleanup. `src/hooks/useOrientation.ts` removes its Dimensions listener, and
  `src/core/neteaseFingerprint.ts` supports cancellation.
- Reset page-scoped atoms on unmount when stale state must not leak between
  route visits. `src/pages/searchPage/index.tsx` and
  `src/pages/artistDetail/index.tsx` show this pattern.
- Do not create one Dimensions or AppState listener per list item. Mount global
  listeners once and expose reactive state.

## Query Hooks

- Keep request state explicit with `RequestStateCode` and expose retry/load-more
  callbacks to the view. See `src/pages/topList/hooks/useGetTopList.ts` and
  `src/pages/artistDetail/hooks/useQuery.ts`.
- Guard stale async results when a request can be superseded or cancelled.
- Memoize callbacks passed deeply into virtualized lists when identity affects
  rendering, but do not add memoization without a concrete render or dependency
  reason.

## Dependencies

- Follow the current ESLint hooks rules. Exhaustive dependency findings are
  warnings, not permission to ignore stale closures; verify intentional
  mount-only effects explicitly.
