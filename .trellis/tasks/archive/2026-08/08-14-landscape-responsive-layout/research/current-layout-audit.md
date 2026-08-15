# Current Landscape Layout Audit

## Repository facts

-   React Native `0.76.5`, React `18.3.1`, TypeScript `5.3.3`.
-   Direction is centralized by `useListenOrientationChange()` in `src/entry/bootstrap/BootstrapComponent.tsx` and exposed by `src/hooks/useOrientation.ts`.
-   `src/utils/rpx.ts` computes `rpx()` from the shorter window edge. This is suitable for control scale but not a full landscape page width.
-   Android `minSdkVersion` is 24 in `android/build.gradle`; no native layout change is needed for this task.
-   Long lists already use `FlashList`, `SectionList`, or `SortableFlatList`; responsive work should preserve those owners.

## Existing partial landscape support

| Area          | Existing behavior                                            | Main issue                                                                         |
| ------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Home          | `HomeBodyHorizontal` already separates operations and sheets | Hard-coded rail sizing and inconsistent 38:62 geometry                             |
| Music detail  | Left cover/control plus right lyric                          | Needs explicit 50:50 bounds and short-height verification                          |
| Artist detail | Header and tab results become a row                          | Header still uses several `rpx(750)` widths and has no independent scroll contract |
| About         | Author block and text become a row                           | Fixed left width and QR/image offsets can clip or leave excess space               |
| Panels        | `PanelBase` changes translation from Y to X                  | Width, corners, safe area, and keyboard details are still portrait-oriented        |
| Dialogs       | Landscape width changes to 80%                               | Needs bounded centered geometry and landscape content height                       |

## Page groups and evidence

### Detail family

-   Remote/plugin sheet, album and ranking detail all converge at `src/components/musicSheetPage/index.tsx`.
-   Their metadata is currently passed as `MusicList.Header` in `components/musicSheetPage/components/sheetMusicList.tsx`, so header and songs share one scroll surface.
-   Local sheet detail uses the same pattern separately in `src/pages/sheetDetail/components/sheetMusicList.tsx`.
-   A landscape split therefore needs to render the existing header outside the song list while retaining the current portrait header path.

### Filtered result pages

-   Rankings select plugin sources through a horizontal `TabView` in `src/pages/topList/components/topListBody.tsx`.
-   Recommendations nest source tabs in `recommendSheets/components/body/index.tsx` and tag chips in `sheetBody.tsx`.
-   Search nests media tabs in `resultPanel/index.tsx` and plugin tabs in `resultSubPanel.tsx`.
-   Landscape needs controlled selected keys at the page owner so the same request/result components can be rendered beside a vertical rail without duplicating data fetching.

### Settings

-   Basic settings already have a horizontal category `FlatList` and a content `SectionList` in `basicSetting.tsx`; `sectionListRef.scrollToLocation()` already handles directory-to-content navigation.
-   Landscape work can reuse the same `basicOptions` and add content-to-directory synchronization through viewability callbacks.
-   Plugin settings own a nested stack with list, sort and subscription screens; this stack should stay intact and only its screen layouts should respond.

### Ordered lists and work surfaces

-   `src/components/musicList/index.tsx` and `src/components/mediaItem/musicItem.tsx` are the shared playback list boundary.
-   History, local music and detail pages already reuse it. List-internal search and editor rows use `MusicItem` directly.
-   A landscape row variant should be passed from list owners so each row does not subscribe to orientation independently.
-   The editor currently places actions at the bottom; the file selector places confirmation at the bottom. Both can move the same actions into a right rail only in landscape.

## Fixed-width hotspots

Page-level `rpx(750)` usage exists in artist headers, downloading, ranking bodies, search empty states, About, custom theme and plugin subscription. Panel types also use it intentionally as a sheet width. The implementation must remove page-level misuse while reviewing overlay widths case by case instead of globally replacing every occurrence.

## Constraints from project specs

-   Reuse `AppBar`, `MusicBar`, `MusicList`, media items, loading/empty/footer components and existing managers.
-   Use actual available width and flex for page geometry.
-   Keep the global orientation listener centralized.
-   Preserve ordered music lists and playback orchestration.
-   Combine type/test checks with Android rotation screenshots because unit tests cannot establish visual correctness.
