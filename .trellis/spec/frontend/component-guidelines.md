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
