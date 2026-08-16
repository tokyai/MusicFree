# Component And Layout Guidelines

## Component Pattern

- Use function components with explicit props interfaces for reusable UI.
  `src/components/base/listItem.tsx` and
  `src/components/musicSheetPage/components/header.tsx` are representative.
- Compose existing primitives before creating a new control. Prefer
  `ThemeText`, `IconButton`, `ListItem`, `AppBar`, `MusicBar`, and the existing
  loading/empty/footer components.
- Read colors through `useColors()` and translated copy through `useI18N()`.
  Add translation keys to all three language JSON files and the i18n type.
- Define stable styles with `StyleSheet.create`. Use inline styles only for
  values derived from theme, state, safe-area insets, or current dimensions.

## Layout And Sizing

- Use flex layout and actual available width for page geometry. `rpx()` is for
  control sizing, spacing, and typography; a legacy `width: rpx(750)` must not
  be copied as a full-page width in responsive screens.
- Use `VerticalSafeAreaView` for top/bottom insets and
  `HorizontalSafeAreaView` for left/right insets. Do not apply the same safe
  edge twice in nested containers.
- Use `useOrientation()` for the existing portrait/landscape contract. Keep
  orientation listeners centralized through
  `useListenOrientationChange()` in the bootstrap layer.
- Prefer one responsive component tree with conditional styles. When layout
  semantics genuinely differ, follow the existing `HomeBody` /
  `HomeBodyHorizontal` split in `src/pages/home/index.tsx`.
- Give fixed-format controls and panes stable dimensions so labels, loading
  states, and selection changes do not shift surrounding layout.

### Landscape Split Contract

- Use `ResponsiveSplitView` at the page/content boundary when a landscape
  screen has distinct primary and secondary regions. Keep `AppBar` and
  `MusicBar` outside the split so they remain fixed across the full width.
- The default split is `38:62`; playback detail explicitly passes `50:50`.
  Override weights only when the current screen has a documented content
  priority, rather than duplicating local row/flex geometry.
- Apply `HorizontalSafeAreaView` once around the complete split, not once per
  pane. Each pane and every parent of a virtualized list must remain bounded by
  `flex: 1`, `minWidth: 0`, and, where vertical scrolling is involved,
  `minHeight: 0`.

```tsx
<HorizontalSafeAreaView style={globalStyle.flex1}>
    <ResponsiveSplitView
        primary={<MetadataPane />}
        secondary={<MusicList />}
    />
</HorizontalSafeAreaView>
```

## Scenario: Semantic Car Display Splits

### 1. Scope / Trigger

Use semantic presets when a landscape page has two distinct panes and car mode
needs a different content priority. Do not branch on a physical resolution such
as 1920x1080.

### 2. Signatures

- `ResponsiveSplitView` accepts `carPreset?: DisplaySplitPreset` in addition to
  legacy `primaryWeight` and `secondaryWeight` props.
- `resolveDisplaySplitWeights(preset, isCarMode, primaryWeight,
  secondaryWeight): { primary: number; secondary: number }` owns resolution.

### 3. Contracts

| Preset | Primary : secondary | Use |
| --- | ---: | --- |
| `navigation` | 24 : 76 | Navigation rail and result content |
| `home` | 28 : 72 | Home operations and playlists |
| `metadata` | 30 : 70 | Header/details and media list |
| `player` | 42 : 58 | Player and lyrics |
| `secondaryActions` | 74 : 26 | Main list and action rail |
| `balanced` | 50 : 50 | Peer forms or previews |

Presets override legacy weights only while car mode is enabled. Phone mode and
portrait layouts retain their existing behavior. Each pane and virtual-list
parent remains bounded by `flex`, `minWidth: 0`, and when needed
`minHeight: 0`.

### 4. Validation & Error Matrix

| Input/state | Required result |
| --- | --- |
| Car mode enabled with a preset | Use the preset weights |
| Car mode disabled with a preset | Use explicit or default legacy weights |
| No preset | Use explicit or default legacy weights |
| Narrow safe width | Panes remain bounded; overlays clamp to available width |

### 5. Good / Base / Bad Cases

- Good: a metadata page declares `carPreset="metadata"` once at the split
  boundary and keeps both panes scrollable.
- Base: the same page in phone mode continues to use its previous 38:62 split.
- Bad: duplicating local `flex` ratios, checking for exact device pixels, or
  adding a `Dimensions` listener to list rows.

### 6. Tests Required

- Pure tests assert every preset and prove car mode off preserves legacy
  weights.
- Overlay tests cover narrow, representative car, and ultra-wide widths.
- Type-check and statically audit every `ResponsiveSplitView` consumer; device
  or emulator screenshots remain required for final visual confirmation when
  ADB is available.

### 7. Wrong vs Correct

```tsx
// Wrong: device-specific geometry scattered in a page
const primaryFlex = width === 1920 ? 30 : 38;

// Correct: semantic intent resolved by the shared display contract
<ResponsiveSplitView
    carPreset="metadata"
    primary={<Header />}
    secondary={<MusicList />}
/>
```

## Lists

- Use `FlashList` for long media/result lists and provide a stable
  `estimatedItemSize` and `keyExtractor` where identity is not implicit.
- Reuse `MusicList` and media item components for playback behavior instead of
  duplicating queue replacement or option-panel logic.
- Preserve list order for music. Do not turn an ordered song list into a grid
  unless the product behavior explicitly changes with it.

## Accessibility And Interaction

- Preserve accessibility labels on icon-only playback and navigation actions.
- Use the established icon set through `Icon`/`IconButton`; do not add manual
  SVGs for standard actions.
- Keep Android back handling and overlay dismissal behavior intact when
  changing panels or dialogs.
