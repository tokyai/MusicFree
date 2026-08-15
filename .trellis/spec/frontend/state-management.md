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

## Persisted Display Metrics Contract

### 1. Scope / Trigger

This contract applies when a display setting changes shared React Native sizing.
The car-display mode is presentation state only; it must not become a second
owner of playback, queue, plugin, or lyric state.

### 2. Signatures

- `IAppConfigProperties["basic.carDisplayMode"]`: `boolean`.
- `IAppConfigProperties["basic.carDisplayFontSize"]`: `"medium" | "large"`.
- `getDisplayMetrics(width, height, enabled, tier): DisplayMetrics` in
  `src/utils/displayMetrics.ts`.
- `getDisplayOverlayWidth(kind, availableWidth): number` in the same module.

### 3. Contracts

- An unset mode resolves to `false`; an unset or invalid tier resolves to
  `"medium"` at the consumer boundary.
- `DisplayMetricsProvider` is mounted once above navigation and global overlays;
  consumers call `useDisplayMetrics()` rather than reading `Dimensions`.
- Enabled sizes are `max(current logical-dp rpx result, tier minimum)`; disabled
  sizes retain the existing `rpx()` behavior.
- Overlay widths receive safe available width and are clamped before rendering.

### 4. Validation & Error Matrix

| Input | Required result |
| --- | --- |
| `carDisplayMode` unset | Legacy phone sizing |
| `carDisplayFontSize` missing or not `large` | `medium` tier |
| Window width/height non-positive or non-finite | Safe positive fallback; no `NaN` styles |
| Overlay minimum wider than available width | Available width wins; no overflow |

### 5. Good / Base / Bad Cases

- Good: toggle the config while audio is playing; only the metrics context
  updates and the queue/request state remains untouched.
- Base: a rotation or resizable window changes provider dimensions and all
  consumers recompute without adding listeners to list rows.
- Bad: a component branches on `1920`/`1080`, stores a copied mode in local
  state, or registers a `Dimensions` listener for every item.

### 6. Tests Required

Pure sizing tests must assert disabled behavior, both tiers at 360/480/600dp,
all four lyric selections, invalid dimensions, and ultra-wide/narrow overlay
bounds. UI verification should cover a compact and a large logical short edge.

### 7. Wrong vs Correct

```tsx
// Wrong: physical-pixel branch and per-component subscription
const isCar = Dimensions.get("window").width === 1920;

// Correct: one provider derives logical metrics; components consume the result
const { isCarMode, fontSizes } = useDisplayMetrics();
```

## Avoid

- Do not mirror the same value in local state, Jotai, and a manager without a
  documented synchronization owner.
- Do not persist large transient payloads merely to share them between
  components.
