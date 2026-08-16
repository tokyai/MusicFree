# Car layout and picker audit

## Target and current metrics

- The requested physical target is 1920×1080 at 14.6 inches. React Native
  receives logical dp, which depends on the head unit's density; layout code
  must therefore use the existing `DisplayMetricsProvider`, not physical-pixel
  branches.
- `src/utils/displayMetrics.ts` currently uses a 36% drawer with a 360dp
  minimum, and `ResponsiveSplitView` defaults to 38:62. On a common 731dp
  logical width this makes the drawer minimum roughly half the screen and makes
  navigation rails visibly oversized.

## Split usage map

The following semantic presets are sufficient for the existing split pages and
apply only while `basic.carDisplayMode` is enabled; phone and legacy landscape
behavior remains unchanged:

| Preset | Primary:secondary | Consumers |
| --- | ---: | --- |
| `navigation` | 24:76 | search, top list, recommendation tags, basic settings |
| `home` | 28:72 | home operation shortcuts and playlists |
| `metadata` | 30:70 | artist/sheet/album/about/permission information panes |
| `player` | 42:58 | player controls and lyrics |
| `secondaryActions` | 74:26 | file selector, playlist editor, plugin list/sort/subscribe |
| `balanced` | 50:50 | theme, backup and other two-pane forms |

The artist tab view currently hard-codes `width * 0.62`; it must consume the
same resolved secondary width as its split preset.

## Fixed-width hotspots

- `PanelBase` already calculates a car-mode overlay width, but several panel
  bodies still declare `width: rpx(750)`, which can exceed a narrow landscape
  panel. Those body wrappers should use `width: "100%"` and bounded flex styles.
- Plugin sort rows use `rpx(500)` and top-list/panel children contain legacy
  `rpx(750)` wrappers. Replace only page/pane wrappers and rows that can
  overflow; retain fixed artwork/control sizes where they are content-sized.
- `HomeDrawer` passes `DrawerContentScrollView {...[props]}` and applies a
  `width: "100%"` header plus a car-mode left margin, which can overflow. Pass
  `{...props}` and put the margin into inner padding/width-safe styles.

## External picker entry points

The current code invokes system pickers at:

- `backupSetting.tsx`: local restore (`expo-document-picker`), plus the local
  folder route for local backup.
- `pluginList.tsx`: local plugin import (`expo-document-picker`).
- `musicItemLyricOptions.tsx`: raw and translation lyric upload
  (`expo-document-picker`).
- `editSheetDetail.tsx` and `editMusicSheetInfo.tsx`: playlist cover image
  (`react-native-image-picker`).
- `setCustomTheme/body.tsx`: custom background image
  (`react-native-image-picker`).

The in-app `src/pages/fileSelector` reads directories with RNFS and does not
launch the system document provider; it remains available for local music and
download directories. URL/network import paths remain available because they
do not open a picker.
