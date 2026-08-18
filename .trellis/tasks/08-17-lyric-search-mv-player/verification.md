# 最终验证记录

日期：2026-08-18

## 已完成

- `npx tsc --noEmit` 通过。
- 聚焦 Jest 4 个套件、20 个测试通过；完整 Jest 15 个套件、96 个测试通过。
- `npx eslint src --ext .js,.jsx,.ts,.tsx` 通过，0 错误；96 条警告均为既有警告。
- `node .\music-sources\validate.cjs` 通过，1–9 号音源均可导入并实现 MV 契约。
- `android\gradlew.bat :app:compileDebugKotlin` 通过。
- `android\gradlew.bat :app:assembleRelease` 通过。
- universal APK 静态核验：包名 `fun.upup.musicfree.car`、versionName `0.6.2`、minSdk `26`、四 ABI（`arm64-v8a`、`armeabi-v7a`、`x86`、`x86_64`）、ZIP 对齐和 v2 签名均通过。

## 按用户要求跳过

- 后续模拟器/车机上的 MV 实际播放、ExoPlayer/MPV 切换、Bilibili 视频和反复进退验证已按用户要求跳过；交付时不将这些项目标记为设备实测通过。
- 早先已完成的 1920×1080 车机模式截图仅作为布局抽查记录，不替代上述设备播放验收。

## Release 产物

- `android/app/build/outputs/apk/release/app-universal-release.apk`
- 大小：76,638,250 bytes（73.09 MiB）
- SHA-256：`A0749AF4F4B9BA5E282EF6821D9DCFD16CD521319125B2E86A76FE6F5FDD9428`
