# 实施计划

## 执行顺序

1. **高风险依赖冒烟**
   - 将 Android `minSdkVersion` 提升为 26。
   - 安装并固定 `react-native-video@6.19.2`，加入 `dev.jdtech.mpv:libmpv:0.5.1`。
   - 建立最小 MPV Surface/ViewManager 与注册，先通过依赖解析、Kotlin 编译和 Android 空页面挂载/释放。
   - 记录 universal/各 ABI 包体基线；若 AAR 缺 ABI 或生命周期崩溃，停止扩展并回到设计。

2. **插件 MV 契约**
   - 更新 `src/types/plugin.d.ts`、Plugin wrapper 和能力检测。
   - 新增纯校验/规范化 helper，测试非法 URL、空 source、headers、去重、排序和异常插件。
   - 新增 `musicVideoManager` 的会话、清晰度选择、降级、引擎选择和音频恢复测试。

3. **歌词统一搜索**
   - 扩展 `lyricMatch` 相似度与稳定排序测试。
   - 把 `SearchLrc` 改为单列表，加入请求 revision、跨插件汇总、专辑展示和候选 loading。
   - 点选前获取/校验歌词，确认当前歌曲未变化后再关联。
   - 删除 ID 面板入口和“关联歌词方式”设置 UI，保留历史关联读取/解除。

4. **MV 页面与 ExoPlayer**
   - 增加 typed route、播放页 MV 图标、准备态和无 MV 提示。
   - 实现全屏 MV 页、共享 controls、AppState 暂停、Exo props/events、清晰度切换和错误降级。
   - 接入 `mv.defaultPlayer`、`mv.preferredHeight`、设置 UI 与三语 i18n/类型。

5. **MPV 完整适配**
   - 完成 Surface 生命周期、headers、load/seek/pause、属性观察、事件、错误和幂等清理。
   - 接入共享 controls；验证反复进入/退出、切清晰度、切引擎、旋转和后台切换没有泄漏或崩溃。

6. **1–9 号源文件**
   - 建立 `music-sources/`、README 和九个当前线上源码副本。
   - 逐平台实现并导出 `getMusicVideo`，提升版本号，不改变既有搜索/音频播放功能。
   - 增加 Node 解析/契约检查；匿名源做有 MV/无 MV live smoke，API Key 源至少完成无凭据安全失败和导入验证。

7. **集成与视觉检查**
   - 补齐插件设置能力显示、许可证说明、错误日志脱敏和所有文案。
   - 1920x1080 车机模式检查播放页 7 个操作按钮、歌词面板、MV 控制层和设置项；同时检查代表性竖屏/普通横屏。
   - 验证 MV 退出恢复原音频，切歌/无 MV/网络失败不会恢复错误歌曲。

8. **完整质量门**
   - TypeScript、聚焦 Jest、完整 Jest、只读 ESLint、Kotlin 编译、Release 构建、签名与 manifest 检查。
   - 在 Android 8+ 模拟器/设备分别用 Exo 和 MPV 播放一个普通平台 MV 与 Bilibili progressive 视频。
   - 检查最终 universal APK 体积、四 ABI、启动、反复进退资源释放和工作区范围。

## 验证命令

```powershell
npx tsc --noEmit
npx jest --runInBand src/utils/lyricMatch.test.ts src/core/musicVideoManager.test.ts src/core/pluginManager/musicVideoContract.test.ts
npx jest --runInBand
npx eslint src --ext .js,.jsx,.ts,.tsx
node .\music-sources\validate.cjs
cd android
.\gradlew.bat :app:compileDebugKotlin
.\gradlew.bat :app:assembleRelease
```

构建后还要检查 APK manifest 的 `minSdkVersion=26`、包名 `fun.upup.musicfree.car`、v2 签名、ZIP alignment 和 SHA-256。

## 风险文件与回滚点

- `package.json` / Android Gradle / `musicVideo` native package：完成步骤 1 后作为首个回滚点，不带着不可编译依赖继续写 UI。
- `src/types/plugin.d.ts` / `pluginManager/plugin.ts`：插件协议必须保持旧插件可选兼容；wrapper 测试通过后再改九个源。
- `src/core/lyricManager.ts` / SearchLrc：关联提交前必须先验证歌词，失败不能覆盖旧关联。
- `src/core/musicVideoManager.ts` / route：会话 ID 是敏感 URL 与生命周期的唯一桥，Navigation params 不直接携带 source。
- `music-sources/1.js`–`9.js`：每个源独立验证，不能因 MV 改造破坏原搜索、歌词或音频播放。

## 开始前检查

- PRD、设计和本计划经用户最终确认后才执行 `task.py start`。
- 实现阶段先加载 `trellis-before-dev`，完成后执行 `trellis-check`。
- 在线服务器上传、IJK、DASH 分离流合并、MV 下载/弹幕/评论/投屏/画中画不进入本任务。
