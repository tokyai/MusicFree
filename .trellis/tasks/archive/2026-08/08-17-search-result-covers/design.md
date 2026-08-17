# Technical Design

在 `MusicItem` 增加默认关闭的 `showArtwork` 属性。普通模式和横屏表格模式均复用
`ListItem.ListItemImage`，使用 `ImgAsset.albumDefault` 处理空值和加载失败；图片保持
在现有大号列表行内，不修改虚拟列表的行高估算。歌曲搜索结果是唯一启用方。
