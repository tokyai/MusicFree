# Technical Design

## 1. Scope and ownership

This fix remains in the frontend layer. `DisplayMetrics` continues to own
car-mode font and touch-target values; shared controls own text measurement
contracts; page consumers only choose the appropriate layout variant.

Affected boundaries:

1. `ActionButton` owns the home shortcut tile/rail presentation.
2. `IconTextButton` and `LandscapeNavigationRail` own reusable narrow-column
   text bounds and overflow behavior.
3. Music-list editor and file-selector action rails own their local vertical
   action styling.

No route, playback, persistence, or native API changes are needed.

## 2. Layout contract

### Home shortcuts

- Portrait and non-car layouts retain the existing tiled grid.
- In car + horizontal mode, each shortcut is a full-width horizontal rail row:
  icon, one-line title, and a car-mode minimum touch height.
- The row uses `DisplayMetrics.horizontalPadding` and
  `DisplayMetrics.navigationItemHeight`; it never checks physical pixels.
- The title has `flexShrink: 1`, `minWidth: 0`, a single-line fit/ellipsis
  contract, and a bounded parent width.

### Shared text controls

- A narrow action button must set `minWidth: 0` on the pressable and the text
  node, use at most two lines where the command is genuinely long, and apply a
  tail ellipsis or font fitting before overflowing its pane.
- A navigation rail item is width-stretched, has a bounded text child, and
  remains at least `navigationItemHeight` in car mode.

### Local action rails

- `BottomIcon` and the file-selector confirmation action fill the rail width;
  centered labels use the full width instead of intrinsic glyph width.
- Existing touch behavior and action order remain unchanged.

## 3. Shared component changes

`ActionButton` gains a small `variant` prop (`"tile" | "rail"`, default
`"tile"`). The rail variant changes only flex direction, width, spacing, and
text fitting; it does not change the callback or accessibility semantics.

`IconTextButton` and `LandscapeNavigationRail` receive bounded text styles and
explicit line/ellipsis behavior. Their public callback and item data contracts
remain compatible; any new optional item metadata must have a default.

## 4. Data flow

```text
useDisplayMetrics()
  -> home horizontal Operations chooses rail variant in car mode
  -> ActionButton resolves bounded row styles
  -> ThemeText receives the available width and fits the title
```

The other rails consume the same display metrics already provided by the
bootstrap context. No new listeners or per-row dimension measurements are
introduced.

## 5. Compatibility and rollback

- Phone mode and portrait mode keep their current visual structure.
- Removing the `rail` selection and shared text styles restores the prior
  behavior without affecting navigation logic.
- Android API 24 and the existing React Native version remain supported.
- The emulator verification uses a 1920x1080 window override only for testing;
  production code remains resolution-independent.

## 6. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A long translated title is clipped | Use one/two-line limits, font fitting, and tail ellipsis; inspect all three locales. |
| Shared button style changes a non-car screen | Keep defaults unchanged and add only bounded flex styles that are neutral at full width. |
| A 26% action pane becomes too narrow | Keep the pane bounded, use the existing semantic preset, and verify plugin/file/editor screens on the emulator. |
| Visual regression hidden by unit tests | Capture home plus representative navigation/action-rail screenshots at medium and large car tiers. |
