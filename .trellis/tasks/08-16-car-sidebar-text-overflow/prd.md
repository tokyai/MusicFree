# 修复车机侧栏文字溢出并审计类似布局

## Goal

确保车机模式在 1920x1080 横屏及中/大两档字体下，首页侧栏和其他
横屏窄栏中的图标、标题、选中背景都能完整、稳定地显示，不再出现中文
逐字竖排、内容溢出或多个入口视觉粘连。

## Background

- 用户实机截图显示：首页横屏左侧四个快捷入口被压成细长竖条，
  “推荐歌单”“播放历史”“本地音乐”等标题逐字换行。
- 当前首页车机分栏为 `28:72`，左侧仍使用两列百分比卡片；共享
  `ActionButton` 默认不可收缩，标题也没有行数或宽度约束。
- 上一任务已明确使用语义分栏和车机字体档位；本任务不得通过识别
  1920x1080 物理分辨率增加设备专用分支。

## Audit Findings

- **Confirmed defect:** `src/pages/home/components/ActionButton.tsx:38-59`
  centers children in a fixed-width tile. The Android UI tree on the 1920x1080
  test profile reports a 192px tile but only a 48px text node, proving that
  the title is measured at intrinsic single-glyph width and wraps vertically.
- **Same pattern:** `src/pages/musicListEditor/components/bottom.tsx:119-187`
  and `src/pages/fileSelector/index.tsx:247-421` center text inside narrow
  landscape action rails without a bounded text width.
- **Shared narrow-button risk:** `src/components/base/iconTextButton.tsx:17-65`
  is used by plugin-management and playlist action rails whose car preset is
  `secondaryActions` (`74:26`). Its text has no shrink, line, or ellipsis
  contract.
- **Shared navigation audit:** `src/components/base/landscapeNavigationRail.tsx`
  is used by search, top list, recommendation, and basic settings. Its
  pressables are width-bounded, but explicit `minWidth: 0` and text overflow
  behavior are missing; this will be hardened once for all consumers.
- **Lower-risk areas:** the drawer uses `ListItem.Content` with a single-line
  title and the app-name header already uses `adjustsFontSizeToFit`; no
  equivalent vertical-wrap defect was reproduced there.

## Requirements

- 修复首页车机横屏左侧快捷入口，四个标题必须可辨认，图标和文字不得
  重叠，卡片/选中背景不得塌缩成竖条。
- 审计所有横屏导航轨、侧栏、窄分栏操作区和百分比卡片布局，覆盖共享
  组件及全部调用点；发现同类风险时在本任务内一并修复。
- 车机模式的导航项必须满足当前字体档位和最小触控尺寸契约。
- 长标题可以在确有必要时换为两行，但不得逐字换行、被裁切或越过父容器。
- 保持非车机模式、竖屏页面、播放和导航行为不变。
- 复用现有显示指标和布局组件，不引入按具体物理分辨率判断的分支。
- 修改范围限于侧栏/导航/窄分栏的布局与直接相关测试，不扩展为无关页面重设计。

## Acceptance Criteria

- [x] 在 1920x1080 横屏车机环境中，中号和大号字体下首页四个快捷入口
      均完整显示，标题不逐字竖排，背景宽度稳定。
- [x] 共享导航轨及搜索、榜单、推荐、设置等全部调用点在中/大两档字体下
      不出现文字重叠、裁切、逐字换行或横向溢出。
- [x] 抽屉和其他带标题的窄栏经静态审计；所有发现的同类风险都有修复或
      有明确的安全依据记录。
- [x] 普通模式和竖屏布局保持现有行为。
- [x] 相关纯布局测试、TypeScript、Jest、ESLint 和 Android 编译通过。
- [x] 使用 1920x1080 模拟器验证首页及代表性共享导航页面，并重新生成
      Debug、Release 通用 APK。

## Out Of Scope

- 不调整 FTP/FTPS、音源、播放或备份业务逻辑。
- 不改变已确定的车机字体档位体系，也不为单一车型增加专用模式。
