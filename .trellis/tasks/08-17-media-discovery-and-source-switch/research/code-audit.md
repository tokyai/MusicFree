# Code Audit

## Search result artwork

- `src/pages/searchPage/components/resultPanel/results/musicResultItem.tsx`
  reuses the shared `MusicItem` but does not request artwork rendering.
- `src/components/mediaItem/musicItem.tsx` has normal and landscape table
  layouts; neither renders `musicItem.artwork` today.
- `IMusicItem` already contains `artwork`. Existing `FastImage` and
  `ImgAsset.albumDefault` provide the required error/empty fallback.
- `ResultWrapper` uses a stable car-aware item-height estimate, so the cover
  must fit inside the existing row instead of changing height after load.

## Metadata navigation

- `src/components/panels/types/musicItemOptions.tsx` currently copies artist
  and album text to the clipboard on press.
- `search-page` currently has no route params. Search state is held in Jotai;
  `src/pages/searchPage/index.tsx` resets it on mount/unmount.
- `ResultPanel` owns the media-type tab. A routed search therefore needs both
  an initial query and initial media type; otherwise the request defaults to
  each plugin's default search type and the UI opens on the single-song tab.
- Existing artist and album results already navigate to their detail pages.

## Batch source switching

- `src/pages/sheetDetail/components/navBar.tsx` owns the local playlist menu.
  The favorite sheet id is `favorite`.
- `src/pages/musicListEditor/` already owns checkbox, select-all and car-safe
  batch layout. A dedicated mode can reuse selection without adding a fifth
  unrelated action to every editor screen.
- `PluginManager.getSortedSearchablePlugins("music")` returns enabled plugins
  that support single-song search.
- `TrackPlayer.getSimilarMusic` contains private playback-failover matching,
  but it searches every other plugin, checks only two results, uses weak raw
  string distance, and returns no validation/report details. It is not a safe
  persistence contract for batch migration.
- `MusicSheet.manualSort` assumes identities are unchanged;
  `SortedMusicList.manualSort` does not rebuild its platform/id index. Batch
  replacement needs a dedicated persistence method that updates both order and
  identity bookkeeping atomically.
- Search success does not prove playability. Validation must accept an existing
  candidate URL/source or resolve at least one quality through the target
  plugin, while avoiding persistence of an expiring validation URL.

## Historical context

`trellis mem` found no prior project decision for batch source switching,
source-failure persistence, metadata navigation, or search-cover behavior.
