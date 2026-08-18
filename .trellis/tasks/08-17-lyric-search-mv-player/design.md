# 技术设计

## 1. 边界与取舍

- 保持一个 Trellis 任务：歌词改造和 MV 改造会在同一个播放详情页、插件协议、设置与最终 APK 中集成验收，拆成独立发布会增加中间不兼容状态。
- 歌词搜索复用 `SearchLrc`、`lyricManager`、`ILyricItem` 和现有歌词缓存，不建立第二套歌词存储。
- MV 平台查询属于插件，App 只定义/校验通用结果并负责播放。平台 API 不硬编码到 React 页面或 `TrackPlayer`。
- Android 使用 ExoPlayer + MPV 两个独立画面适配器，共享一个 React 控制层。ExoPlayer 默认；MPV 是兼容模式。
- MPV 采用 `dev.jdtech.mpv:libmpv:0.5.1`：它仍使用当前工程兼容的 Kotlin/AndroidX 依赖，AAR 约 44.3 MB、`minSdk=26`。不采用 1.0.0，避免把 Kotlin 2.2.10 和 compileSdk 36 一并带入当前 RN 0.76 工程。
- 九个音源以仓库根目录 `music-sources/1.js` 至 `9.js` 交付，不打入 APK，也不直接发布到远端服务器。

## 2. 歌词数据流

```text
歌词工具栏搜索按钮
  -> SearchLrc（默认当前 alias/title，可编辑）
  -> lyricSearchService（请求序号 + 所有已启用 lyric 插件）
  -> Plugin.methods.search(query, 1, "lyric")
  -> 候选校验、去重、相关性评分、稳定降序排序
  -> 单一 FlashList
  -> 用户点选
  -> Plugin.methods.getLyric(candidate) 先验证有效歌词
  -> lyricManager.associateLyric(currentMusic, candidate)
  -> refreshLyric
```

### 候选与排序

- 新增页面视图模型，携带 `musicItem`、`pluginHash`、插件顺序、原结果顺序和 `relevance`，不把 UI 排序字段写回媒体对象。
- 仅接受含非空 `id/platform/title` 的候选；同一 `platform@id` 去重，不合并不同平台候选。
- 复用 `lyricMatch.ts` 的 NFKC/标点归一化和编辑距离，暴露 `0..1` 相似度。
- 相关性由可编辑查询、当前歌名、歌手、专辑组成；建议权重为 55%/20%/20%/5%。缺失字段不贡献分数，相同分数按插件顺序、原结果顺序稳定排列。
- 每次搜索增加 revision；旧请求和面板卸载后的结果只能结束自身 Promise，不能覆盖新列表。
- 点选时捕获当前歌曲身份。先取得非空 `rawLrc/lrc`，再次确认当前歌曲未变化，再写关联；失败不改旧关联。

### 删除 ID 入口

- 播放页和歌曲操作面板统一打开 `SearchLrc`。
- 删除 `AssociateLrc` 面板注册及“关联歌词方式”设置项；历史 `associatedLrc` 数据仍由 `lyricManager` 读取/解除。
- 旧 MMKV 配置键可留在存储中但不再消费；不为删除的 UI 增加迁移副作用。

## 3. MV 插件契约

在 `IPlugin.IPluginDefine` 和 `PluginMethodsWrapper` 增加可选方法：

```ts
interface IMusicVideoSource {
    quality: string;
    height: number;
    url: string;
    headers?: Record<string, string>;
    mimeType?: string;
}

interface IMusicVideoResult {
    id: string;
    title?: string;
    artist?: string;
    artwork?: string;
    sources: IMusicVideoSource[];
}

getMusicVideo(
    musicItem: IMusic.IMusicItemBase,
): Promise<IMusicVideoResult | null>;
```

Wrapper 是唯一不可信边界：只接受 HTTP(S) URL、有限长度字符串、正数高度和字符串请求头；过滤空项，按高度去重并排序。日志不得打印完整带签名 URL 或鉴权头。MV URL 通常短时有效，不写入 `mediaCache` 或备份。

Bilibili 首版只返回匿名接口可提供的带音频 progressive URL，保证 Exo 和 MPV 使用同一 source；不在首版实现 DASH 分离音视频合流。

## 4. MV 会话与路由

- 新增 `src/core/musicVideoManager.ts`，持有单个短生命周期会话和 Jotai 状态。
- 新增路由 `music-video`，参数只有 `{ sessionId: string }`。MV 地址和 headers 不进入 Navigation state。
- 会话包含原歌曲身份、已校验 MV 结果、选中清晰度、会话引擎、已尝试档位、进入前音频状态和错误状态。
- 按钮点击先通过当前插件 `getMusicVideo` 获取结果；成功后暂停音频、创建会话并导航。失败只提示，不中断当前音频。
- 路由卸载必须释放播放器和会话；原歌曲未变化且进入前在播放时才恢复音频。
- App 进入后台时暂停视频；返回前台不自动播放，避免车机切换应用后突然出声。

## 5. 清晰度与失败恢复

- 新增配置 `mv.defaultPlayer: "exo" | "mpv"` 和 `mv.preferredHeight: number`，消费端默认 `exo` 与 `1080`。
- 首次选择最高的不超过偏好高度的档位；没有更低档时选择最低可用档。
- 用户手动切换清晰度后保存高度，并在同一时间点重载新 URL。
- 播放错误自动尝试下一个更低且未尝试的档位。全部失败后显示重试和“使用另一播放器”命令。
- 会话切换引擎不改变 `mv.defaultPlayer`；只有设置页选择才持久化默认值。

## 6. 双引擎播放层

### 共享页面

- `src/pages/musicVideo/` 负责黑色全屏页面、返回、标题、加载/错误、播放暂停、时间、进度、清晰度菜单和控制层显隐。
- 控件使用现有 `Icon`、`ThemeText`、Slider/Pressable 和 `useDisplayMetrics`；车机模式保持最小触控尺寸，长标题单行省略，布局不依赖 1920 像素判断。
- 两个引擎实现同一 TS props/events：`source`、`paused`、`seek`、`onLoad`、`onProgress`、`onEnd`、`onError`。

### ExoPlayer

- 固定使用 `react-native-video@6.19.2`，Android 后端为 ExoPlayer；关闭其原生 controls，使用共享 React 控制层。
- source 传递 URI 和 headers；切换清晰度时保留当前位置和暂停状态。

### MPV

- Android 新增 `musicVideo/MpvVideoView`、ViewManager 和 ReactPackage，JS 侧放在 `src/native/mpvVideo/`。
- View 使用 `SurfaceView`，按 `MPVLib.create -> options -> init -> attachSurface -> loadfile` 生命周期运行；销毁顺序为停止、移除 observer、detach surface、destroy。
- 只允许一个 MPV View 活跃；新实例先释放旧实例。观察 `time-pos`、`duration/full`、`pause` 和 file/error 事件并发送给 RN。
- 默认 profile 使用 fast、Android GPU surface、`mediacodec,mediacodec-copy` 硬解和受限 demuxer cache；headers 在 loadfile 前设置并在会话结束时清空。
- `isSupported` 同时检查 Android、API 26 和 native component 可用性；设置页只显示可用引擎。

## 7. 1–9 号音源

- 从当前线上文件建立仓库副本并保留各自 `srcUrl`，版本号递增。
- `1/7` 实现 QQ MV 查询，`2/8` 实现酷狗，`3` 实现酷我，`4/9` 实现网易，`5` 实现咪咕，`6` 返回 Bilibili 原视频。
- 每个文件保持单文件可导入，不依赖仓库相对模块；平台返回先转为统一 `sources`。
- 无 MV、会员/登录限制、接口变更或空 URL 返回 `null`，不跨平台回退。
- `music-sources/README.md` 记录文件到平台映射、上传路径和在线发布不在本任务内。

## 8. 错误与兼容矩阵

| 条件 | 行为 |
| --- | --- |
| 插件没有 `getMusicVideo` | MV 按钮提示当前音源不支持 |
| 返回结构或 URL 非法 | Wrapper 过滤；无有效 source 时视为无 MV |
| 查询期间切歌 | 丢弃旧结果，不暂停新歌曲、不导航 |
| 当前清晰度失败 | 自动降级；耗尽后显示错误页 |
| 默认 MPV 不可用 | 设置消费端回退 Exo，并提示一次 |
| MV 页面退出 | 释放 native/Exo 资源，按会话条件恢复音频 |
| Android 7 安装 | manifest minSdk 26，系统正常拒绝安装 |
| iOS | 不展示/不启用 Android MV 双引擎能力 |

## 9. 风险与回滚

- 最大风险是 MPV AAR 的 ABI、包体和 RN View 生命周期；先做依赖/空 View 编译与设备冒烟，再扩展页面。
- 第二风险是平台 MV API 的匿名访问稳定性；每个平台以真实有 MV/无 MV 样本验证，不把单个平台失败当成播放器失败。
- Exo 保持默认，MPV 失败不会影响音频 TrackPlayer。若 MPV 无法稳定集成，可单独回滚 MPV 依赖和设置选项，但这会改变已确认的双引擎范围，必须回到规划确认。
- 分发时补充 react-native-video、libmpv/mpv/FFmpeg 的第三方许可证说明。
