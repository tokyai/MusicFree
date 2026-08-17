# Technical Design

## UI Mode

`music-list-editor` 增加可选 `mode: "edit" | "source-switch"`。换源模式复用现有勾选、
全选和响应式分栏，但使用不可拖拽列表，并只展示“选择目标音源/开始换源”操作。
收藏页仅在 `favorite` 歌单显示入口。

## Matching Contract

每首歌曲先用 `title + artist` 搜索目标插件第一页，无合格结果时再用 `title` 搜索；
候选按目标 `platform@id` 去重。

- 文本使用 NFKC、大小写、全半角、空白、标点、歌手分隔符及 `feat./ft.` 归一化。
- 从标题/别名提取 `live`、`remix`、`acoustic`、伴奏/纯音乐、翻唱、DJ、edit、demo
  等版本标记；两侧标记集合必须相同。
- 基础标题相似度至少 `0.90`，歌手相似度至少 `0.85`。
- 双方时长有效时，差值不得超过 `max(4 秒, 原时长的 4%)`。
- 总分为标题 55%、歌手 30%、时长 10%、专辑 5%；至少 `0.90`，且领先第二个
  合格候选至少 `0.05`。不满足领先度视为歧义失败。

阈值偏向漏配而不是误配，符合严格同录音版本要求。纯函数负责标准化、版本门禁、
评分和候选选择，并通过 Jest 覆盖同名异歌手及版本差异。

## Validation And Cancellation

- 按用户播放音质顺序检查候选已有 URL/source/qualities 或调用目标插件取流；只要一个
  合法 URL 可用即通过。
- 最多两个歌曲任务并发。`AbortSignal` 在每次搜索、候选验证和新任务领取前检查；
  插件调用本身不可中断，但取消后不再启动请求且最终结果标记为取消。
- 服务只返回候选与统计，不写收藏。UI 仅在未取消的正常结果上调用持久化。

## Persistence

`MusicSheet.replaceMusicItems` 根据旧 `platform@id` 定位，拒绝目标身份与现有收藏或
本批目标重复，保留目标插件返回的完整对象及原 `$timestamp`/`$sortIndex`。更新后的
列表一次写入存储，重建 `SortedMusicList` 身份索引，保持当前位置并发送身份变更事件。
验证阶段得到的临时 URL 不回写歌曲对象。
