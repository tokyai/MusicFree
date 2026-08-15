# Technical Design

## 1. Architecture and ownership

All changes stay in the shared React Native layer. No native module, route contract, persistence schema, player manager, plugin manager, or request payload changes are required.

Direction remains owned by `src/hooks/useOrientation.ts`. Responsive geometry is implemented with flex and current window dimensions at reusable layout boundaries, not with one listener per screen row.

Two shared UI pieces are justified by repeated current consumers:

1. A small landscape split container under `src/components/base/` that renders primary and secondary panes with either `38:62` or `50:50`, optional divider, stable min widths, and `flex: 1` containment.
2. A vertical navigation/filter rail under `src/components/base/` that renders scrollable labeled options with selected, disabled and accessibility states. Rankings, recommendations, search and settings reuse it.

Page-specific state and composition remain under each `src/pages/<feature>/` directory. No generic responsive framework is introduced.

## 2. Responsive layout contract

-   Portrait is the default branch and retains the current component tree whenever possible.
-   Landscape is defined by the existing `horizontal` orientation value.
-   AppBar and MusicBar remain outside the split container.
-   Split panes use `minWidth: 0` so long text cannot force overflow, and every virtualized list receives a parent with a bounded flex size.
-   Page width is `100%` / flex-based. `rpx()` remains for gaps, rows, icons, covers and typography.
-   Safe area wrappers are applied once per axis: page wrappers own top/bottom; content or split wrappers own left/right.

## 3. Detail-page data flow

Portrait:

`MusicSheetPage -> MusicList(Header=<metadata/actions>)`

Landscape:

`MusicSheetPage -> Split(primary=<metadata scroll + pinned actions>, secondary=<MusicList>)`

The same `sheetInfo`, `musicList`, request state, retry and load-more callbacks flow into both branches. Metadata components gain presentation props instead of fetching or copying domain state. The local sheet detail follows the same layout contract while retaining its own `useSheetItem()` source and current-track highlighting.

## 4. Filtered result pages

Selected media/source/tag values stay as local React state at the nearest page owner.

-   Portrait feeds those values into the existing `TabView` trees.
-   Landscape renders the shared vertical rail on the left and the already existing active result component on the right.
-   Search keeps result atoms and `useSearch()` unchanged. Only the controlled media/source selection moves upward so the right pane can render the selected `ResultWrapper` directly.
-   Recommendation tag loading and selected tag remain scoped to the active plugin. Switching plugin restores a valid default tag and never reuses an incompatible tag id.
-   Ranking data remains owned by `pluginsTopListAtom` and `useGetTopList()`.

## 5. Settings

Each setting screen owns its meaningful landscape directory rather than creating a new global settings subsystem.

-   Basic settings reuse `basicOptions` for a vertical left directory and right `SectionList`. A stable ref guards programmatic scrolling. `onViewableItemsChanged` updates the active directory item during manual scroll without starting a feedback loop.
-   Theme, backup and About split their existing sections or metadata from their scrollable controls/content.
-   Plugin nested navigation remains unchanged. List, sort and subscription screens use responsive content/action geometry inside their current stack screens.

No setting value is copied into new persistent state.

## 6. Ordered rows and actions

`MusicItem` receives an explicit presentation variant from its list owner. In landscape table mode it uses stable flex columns for title, artist, album and source, with fixed index and action columns. Lower-priority columns can be omitted by the list owner for narrow landscape widths; title and actions remain.

`MusicList` reads orientation once and passes the variant to rows. Direct consumers such as list search and the editor do the same at their list boundary. Playback callbacks, item identity, sorting, highlighting and panel payloads do not change.

The editor and file selector keep their current atoms/local state. Only the action container changes from a bottom row in portrait to a right column in landscape.

## 7. Overlays

-   `PanelBase`: portrait translation Y and placement remain; landscape uses translation X from the right, a bounded width, left-side rounded corners and all relevant safe-area insets.
-   Dialog base: centered in both orientations with max width and max content height derived from the current window, while action rows remain reachable.
-   Fullscreen panel: keeps full width/height and existing dismissal behavior.
-   Drawer: landscape width is bounded rather than always `80%`; its content remains one scroll view.

Animation shared values, Android back subscriptions, mask dismissal and unmount callbacks remain the same ownership boundaries.

## 8. Compatibility and performance

-   Shared code targets Android and iOS. Android manual/build baseline is API 24+.
-   No new runtime dependency is required.
-   Orientation updates cause page-level layout re-rendering only. Virtualized row components do not add window listeners.
-   Long lists stay virtualized and ordered; no nested same-axis long-list scroll views are introduced.
-   Business and playback managers are not modified, limiting rollback to UI files.

## 9. Rollback strategy

Implementation is grouped by shared foundation and page families. Each family can be reverted independently after its verification checkpoint. Portrait branches remain available throughout, so a landscape family can be rolled back without touching data or migrations.
