# Android MV 播放引擎调研

## 当前工程约束

- React Native 0.76.5，`newArchEnabled=false`。
- Android minSdk 24，通用包同时包含 `armeabi-v7a`、`arm64-v8a`、`x86`、`x86_64`。
- 当前没有视频播放依赖，Release 通用 APK 基线约 31.9 MB。

## ExoPlayer / Media3

- `react-native-video` 6.19.2 是维护中的开源 React Native 组件，支持 RN 旧架构和新架构兼容层。
- Android 端使用 ExoPlayer，覆盖远程 URL、HLS、DASH、请求头、缓冲事件和可控播放 UI，最贴合现有 TypeScript 页面结构。
- 主要成本是一个常规 RN 原生依赖和 MV 页面状态管理，不需要随四个 ABI 重复打包一套 FFmpeg/libmpv 解码库。
- 适合作为默认引擎和第一实现。

## mpv / libmpv

- `mpv-android` 官方 README 明确说明该项目不是可直接导入的 library/AAR。
- 集成到 MusicFree 需要移植 `MPVLib`、`BaseMPVView`、JNI/native code 和它自己的 native build scripts，再封装 React Native View。
- libmpv/FFmpeg 需要针对四个 ABI 构建和打包，会显著增加 APK、构建时间和后续升级验证面。
- 优点是格式/协议兼容面和软解兜底能力强，适合作为用户明确需要的兼容引擎，不适合当最低成本首版。
- Maven Central 有第三方 `dev.jdtech.mpv:libmpv:0.4.1` AAR，可降低移植成本，但 AAR 本身约 44.2 MB 且 `minSdk=26`；该项目所有已发布标签均要求 API 26。
- 当前官方 `mpv-android` 应用仍支持 `minSdk=23`。若 MusicFree 必须保留 API 24，则只能移植/维护官方应用的可复用代码和 native 产物，不能直接采用上述 AAR。

## IJKPlayer

- 上游正式使用文档仍以 0.8.8、JCenter、旧 `compile` 语法、NDK r10e、Android Studio 2.1 和 FFmpeg 3.4 为基线。
- 可找到的 React Native wrapper 多数停更多年；较新的 wrapper 仍处于早期 beta，不能视为当前 RN 0.76 的稳定依赖。
- 与当前 Gradle 8/NDK 26/compileSdk 35 组合存在明显适配成本，且与 mpv 重复携带 FFmpeg 类 native 能力。
- 不建议在同一首版同时加入 IJK 和 mpv。

## 推荐

1. 最小且稳妥：只集成 ExoPlayer。没有第二引擎时不提供无意义的播放器切换项。
2. 若“默认播放器切换”是硬需求：集成 ExoPlayer + mpv，ExoPlayer 默认，mpv 作为兼容模式；明确接受包体和 native 构建复杂度。
3. 不推荐 ExoPlayer + IJK，也不推荐三引擎同时集成。

## 待实测

- 取得实际 MV URL 后，用 QQ/网易/Bilibili 样本验证 ExoPlayer 对 URL、请求头、重定向和容器格式的覆盖率。
- 只有出现 ExoPlayer 无法播放且平台端无法改为 HLS/MP4 的真实样本，才有证据支持引入 mpv。
- 选定引擎后记录各 ABI APK 增量、首次加载时间、1080p 硬解占用和 Android 7 兼容性。
