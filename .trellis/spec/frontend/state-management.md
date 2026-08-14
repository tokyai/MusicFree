# State Management

## Choose The Narrowest Owner

- Use React local state for transient state owned by one component, such as a
  selected tab or expanded description.
- Use Jotai for reactive state shared by sibling components or imperative core
  code. Page atoms are co-located under `store/`, as in
  `src/pages/searchPage/store/atoms.ts`.
- Use core manager classes/singletons for long-lived domain behavior such as
  playback, plugins, downloads, lyrics, and music sheets.
- Use `AppConfig`/`useAppConfig` for persisted user settings. Do not add a
  second persistence path for the same setting.

## Jotai Patterns

- Export atoms with domain types and explicit initial values.
- Use `getDefaultStore()` only where non-React core code must coordinate with
  atoms, as in `src/core/i18n/index.ts` and
  `src/core/neteaseFingerprint.ts`.
- Reset route-scoped atoms when leaving a page if their data must not survive a
  new route invocation.

## Configuration

- Add configuration keys to `IAppConfigProperties` in
  `src/types/core/config.d.ts` before using `getConfig` or `setConfig`.
- Provide defaults at the consumption boundary with `??`; preserve the
  distinction between an unset value and an explicit false/zero value.
- When renaming persisted keys or changing stored shapes, add a schema migration
  in `src/core/appConfig.ts`.

## Avoid

- Do not mirror the same value in local state, Jotai, and a manager without a
  documented synchronization owner.
- Do not persist large transient payloads merely to share them between
  components.
