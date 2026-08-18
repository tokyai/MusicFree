# MusicFree 音源交付文件

本目录保存当前线上 `1.js` 至 `9.js` 的仓库副本，并在不改变原有搜索、歌词和音频播放接口的前提下增加 `getMusicVideo`。这些文件不会随 APK 安装，也不会自动覆盖线上地址。

| 文件 | 平台 | MV 查询方式 |
| --- | --- | --- |
| `1.js` | 轻QQ | QQ 歌曲详情中的 `vid` + QQ MV 地址接口 |
| `2.js` | 轻酷狗 | 酷狗歌曲 `MvHash` + 官方 MV tracker |
| `3.js` | 轻酷我 | 酷我歌曲详情中的 MV ID + Kuwo CDN |
| `4.js` | 轻网易 | 网易歌曲详情中的 `mvid` + MV 地址接口 |
| `5.js` | 轻咪咕 | 咪咕平台内精确歌名/歌手匹配；仅返回匿名可访问资源 |
| `6.js` | 轻Bili | 当前 Bilibili 视频的带音频 progressive MP4 |
| `7.js` | 智QQ | ChKSz 音频能力 + QQ 官方 MV 接口 |
| `8.js` | 智酷狗 | ChKSz 音频能力 + 酷狗官方 MV 接口 |
| `9.js` | 智网易 | ChKSz 音频能力 + 网易官方 MV 接口 |

## 校验

```powershell
node .\music-sources\validate.cjs
node .\music-sources\validate.cjs --live
```

默认校验只检查九个文件可导入、基础插件字段和 MV 方法契约。`--live` 会访问各平台公开接口并输出不含签名 URL 的结果摘要，适合上传前复核接口是否仍然可用。

## 发布

验收后将九个文件分别上传为现有 `/yuan/1.js` 至 `/yuan/9.js`。文件内 `srcUrl` 保持现有在线地址，以便 MusicFree 后续更新。发布不属于本仓库构建流程。

平台接口可能因地区、版权、登录或会员状态返回空结果。插件在没有当前平台 MV 时返回 `null`，不会跨平台匹配同名视频。咪咕匿名 CDN 限制较多，上传前应重点运行 live 校验。
