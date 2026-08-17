# Technical Design

- 将 `search-page` 路由参数改为可选 `initialQuery`。
- 搜索页挂载时先清空上次结果；存在初始关键词时同步查询框与页面状态，并显式调用
  `search(query, 1, "music")`。无参数时保持空白编辑状态。
- `MusicItemOptions` 中歌手和专辑仅在字段非空时展示；点击后依次关闭面板并导航。
- 结果面板首项已经是单曲，因此无需新增媒体类型全局状态。
