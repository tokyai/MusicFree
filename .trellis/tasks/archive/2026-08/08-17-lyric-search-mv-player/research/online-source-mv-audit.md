# 1–9 号在线音源 MV 能力审计

## 审计方式

- 读取 `http://23.254.235.247:6080/yuan/1.js` 至 `9.js` 的公开源码。
- 在 Node 中只读加载 1–6 号匿名插件，并以“晴天 周杰伦”执行真实单曲搜索，检查返回字段。
- 7–9 号依赖用户 API Key，本次只检查代码结构和导出能力，未使用用户凭据请求。

## 当前结果

| 文件 | 平台 | 当前可用于 MV 查询的身份 | 当前缺口 |
| --- | --- | --- | --- |
| `1.js` | 轻QQ | `songMid`、`songId` | 未保留 QQ 搜索结果中的 MV vid，未导出 MV 方法 |
| `2.js` | 轻酷狗 | `hash`、`audioId`、`albumId` | 未保留 mvHash，未导出 MV 方法 |
| `3.js` | 轻酷我 | `rid` | 未保留 MV 标记/ID，未导出 MV 方法 |
| `4.js` | 轻网易 | `rid` | 未保留歌曲详情的 `mv` ID，未导出 MV 方法 |
| `5.js` | 轻咪咕 | `contentId`、`copyrightId` | 未保留 MV 资源字段，未导出 MV 方法 |
| `6.js` | 轻Bili | `bvid`、`aid`、`cid` | 已有原视频身份，但当前只解析音频流 |
| `7.js` | ChKSz QQ | 内部 `source + id` | 只有音乐搜索/播放/详情，无 MV 方法 |
| `8.js` | ChKSz 酷狗 | 内部 `source + id` | 只有音乐搜索/播放/详情，无 MV 方法 |
| `9.js` | ChKSz 网易 | 内部 `source + id` | 只有音乐搜索/播放/详情，无 MV 方法 |

## 所需改造

- App 插件协议新增可选 `getMusicVideo(musicItem)`，统一返回视频清晰度、URL、请求头和平台元数据。
- 1–6 号在各自平台适配器内查询 MV；7–9 号按它们固定的平台和原始歌曲 ID 查询，不跨平台回退。
- Bilibili 返回原视频的可播放组合流；如果匿名接口只提供分离的 DASH 音视频，插件契约需要允许分别返回 video/audio URL，或优先请求带音频的 progressive URL。
- 所有源都必须在返回前过滤空 URL、未知清晰度和非 HTTP(S) 地址。

## 交付约束

- 九个插件的 `srcUrl` 指向 `23.254.235.247:6080/yuan/*.js`，当前仅确认 HTTP GET 可用。
- `D:\Sync\Tianyi\MusicFree`、`D:\Sync\Tianyi` 和旧工作区均未找到这些源码的本地副本。
- 没有服务器 FTP/SSH/同步目录或其他写入渠道时，只能在仓库内交付更新后的 1–9 文件，不能让现有在线 URL 自动获得 MV 能力。
