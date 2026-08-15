# Technical Design

## 1. Architecture and ownership

The change remains in the shared React Native layer. It does not add native modules, platform detection, runtime dependencies, routes, playback state, plugin contracts, lyric-recognition behavior, or network payloads.

Two typed AppConfig values are the only persisted source of truth:

- `basic.carDisplayMode`: `boolean`, consumed as `false` when unset.
- `basic.carDisplayFontSize`: `"medium" | "large"`, consumed as `"medium"` when unset.

A small pure sizing module owns the car-display constants and calculations. A single display-metrics provider reads those two config values plus `useWindowDimensions()` and exposes derived metrics through `useDisplayMetrics()`. It is mounted once above navigation, panels, dialogs, toasts, and page content.

This gives the data flow:

```text
MMKV AppConfig + current window width/height
                  ↓
        DisplayMetricsProvider
                  ↓
           useDisplayMetrics()
                  ↓
shared text / rows / controls / overlays / lyric presentation
```

Components consume derived values only. They do not mirror the setting in local state or register their own Dimensions listener.

## 2. Sizing contract

The existing `rpx()` result remains the base size. When car mode is disabled, components retain their current constants and style order. When enabled, a metric is computed as:

```text
resolved size = max(current-short-edge rpx size, selected logical-dp minimum)
```

The provider uses the current window short edge for the base calculation rather than the module-load snapshot. A window resize or rotation therefore recomputes active car metrics without remounting the player or pages.

The font and lyric minima are the tables in `prd.md`. Touch-target minima are 56dp for `medium` and 64dp for `large`. Icon minima and list-image minima are kept in the same pure sizing module so that icons, row heights, and their containers grow together. Fixed 38:62 and 50:50 split weights are unchanged.

Pure functions cover:

- short-edge scaling;
- font, icon, list-row, AppBar, and touch-target resolution;
- the four lyric-font selections;
- width clamping for drawer, panel, and dialog content.

These functions receive width, height, enabled state, and tier explicitly so they can be unit-tested at 360dp, 480dp, 600dp, and ultra-wide widths without rendering React Native views.

### Target hardware audit

The supplied 1920×1080 / 14.6-inch panel is approximately 150.9 PPI. Android may expose it to React Native at different logical densities: for example, density 2 produces about 960×540dp, while density 3 produces about 640×360dp. At the former, the existing base text is already near the `medium` minima; at the latter, the minima prevent the known undersized 360dp case. The `large` tier adds only the explicitly documented lower bounds, so it remains an opt-in choice for longer viewing distance or accessibility needs. No hardware-specific constants or automatic density branch are necessary.

At the 16:9 landscape aspect ratio, the existing 38:62 and 50:50 pane weights leave the right music pane usable at both example logical sizes. Compact table mode continues to hide only lower-priority columns in the narrower 640×360dp scenario. Overlay helpers must always cap their result by safe available width so a minimum bound never overflows a small logical window.

## 3. Typography

`ThemeText` remains the main typography boundary. In car mode it resolves the semantic font key through display metrics and places the resolved font size after caller styles, preventing a legacy smaller numeric style from bypassing the selected minimum. If a caller provides a numeric line height that would clip the resolved font, the final car style raises that line height only as much as required. `allowFontScaling={false}` remains unchanged.

High-visibility direct `Text` users that do not pass through `ThemeText` are adapted at their owning component, especially playback-detail metadata, playback-detail lyrics, time labels, inputs, toast/tip text, and compact player metadata. The task does not mechanically replace every `Text` node or change error/debug-only presentation unless it shares an active player control.

Playback-detail lyric size remains selected by the existing persisted four-position control. The selected `rpx(24/30/36/42)` value is clamped to the selected car-tier minimum; the stored lyric selection is neither rewritten nor reset.

## 4. Touch targets and shared controls

The shared components own the minimums rather than page-specific copies:

- `ListItem` resolves `big`, `normal`, `small`, and `smallest` heights and matching image/action widths from display metrics.
- `IconButton`, `Button`, `TextButton`, `Chip`, `TypeTag`, `ThemeSwitch`, and the landscape navigation rail receive a visible minimum container or hit area.
- AppBar, PlayAllBar, MusicBar, dialog actions, and panel headers use the same minimum so enlarged children are not clipped by a legacy fixed parent height.
- `MusicList` and radio/list owners use the resolved row size for estimates or fixed-item offsets, avoiding a mismatch between virtualized geometry and visible rows.

The landscape music-row table keeps its existing compact-column rule. Increased font and action sizes may reduce secondary-column room, but title and action columns remain present and single-line cells retain ellipsis behavior.

## 5. Settings and localization

The two rows are placed together in the General section of Basic Settings:

1. a switch for car display mode;
2. an always-visible radio row for car font size with `medium` and `large` choices.

The tier remains selectable while the mode is off so the user can prepare the next activation, and turning the mode off retains the last tier. The existing `createSwitch`, `createRadio`, and `RadioDialog` paths are reused. Labels are added to Simplified Chinese, Traditional Chinese, English, and the typed i18n contract.

No AppConfig schema migration is needed: these are additive keys, and `undefined` deliberately maps to the product defaults at each consumption boundary.

## 6. Wide-screen overlays

Normal mode preserves current drawer, panel, and dialog geometry. In car mode, landscape widths are based on safe available width and clamped to readable bounds:

- drawer: roughly 36% of available width, bounded to a practical navigation width;
- ordinary right panel: roughly 40% of available width, bounded so short content is not stretched across an ultra-wide screen;
- dialog: roughly 60% of available width, with horizontal margins and a larger upper bound than the legacy short-edge-only formula.

Each owning overlay subtracts its safe-area insets before clamping. Existing mask dismissal, Android back subscriptions, keyboard avoidance, animation direction, and unmount callbacks remain intact. `PanelFullscreen` and other full-screen experiences do not consume the bounded-width helper and remain full screen.

## 7. Compatibility and performance

- Android remains API 24+; no native or Android Auto/Automotive code is added.
- There is one window-dimension subscription in the provider, not one per row or text node.
- Mode/tier/window changes update presentation context only. Playback queues, requests, selection atoms, and plugin state are not remounted or rewritten.
- Long lists stay virtualized. Context changes are rare user/window events; ordinary playback progress does not update display metrics.
- Existing portrait and landscape branches remain; this task changes sizing and overlay bounds, not navigation or page ownership.

## 8. Rollout and rollback

The feature is default-off, which is the compatibility and rollout guard. Config/i18n, metric foundation, shared primitives, lyric handling, and overlays are implemented as separate checkpoints. If a car-only presentation regression is found, the metric consumer can be reverted without migrating stored data. Removing the two additive keys later is safe because unset values already map to current behavior.
