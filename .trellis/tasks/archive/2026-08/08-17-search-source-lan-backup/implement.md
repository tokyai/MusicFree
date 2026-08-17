# 实施计划

## 执行顺序

1. **搜索导航回归**
   - 扩展搜索路由参数和导航 push 选项。
   - 改造搜索页焦点触发逻辑，作者/专辑入口携带唯一 request id。
   - 增加搜索页相关的最小回归测试或可测试的纯请求触发 helper。

2. **换源匹配修复**
   - 先更新 `musicSourceMatch` 的评分/门槛和现有测试，再更新 `musicSourceSwitcher` 的选中项占用键处理。
   - 增加轻 QQ -> 轻酷狗、轻酷狗 -> 轻 QQ 的等价插件 mock，验证曲名/歌手相同但时长/专辑不同仍可替换。
   - 复核 `SortedMusicList.replace` 及 UI 统计，不改变未选歌曲和提交事务边界。

3. **LAN 原生桥**
   - 新建 `android/.../lanBackup/LanBackupModule.kt` 与 `LanBackupPackage.kt`，实现令牌、临时 HTTP 路由、上传/下载、超时、取消、invalidate 清理。
   - 在 `MainApplication.kt` 注册包；新增 `src/native/lanBackup/index.ts` 类型化 wrapper 和 Android 能力判断。
   - 先写/运行原生协议解析的局部测试或可编译验证，再接入 core。

4. **LAN core 与设置 UI**
   - 新建 `src/core/lanBackup.ts`，复用 `Backup.backup/parseBackupPayload/resume`，不复制备份 schema。
   - 新增临时传输对话框、设置页入口、错误映射和四语文案/类型。
   - 确保取消对话框、返回键、原生超时都结束 promise 并关闭服务。

5. **整体验证与回归**
   - 执行 TypeScript、Jest、ESLint、Kotlin 编译。
   - 在模拟器/Android 设备上验证横竖屏设置页、同网手机浏览器下载和上传；记录不能自动化的手工步骤。
   - 用 `git diff` 检查仅包含本任务代码和任务文档，完成 Trellis quality check。

## 验证命令

```powershell
npx tsc --noEmit
npx jest --runInBand src/utils/musicSourceMatch.test.ts src/core/musicSourceSwitcher.test.ts src/core/lanBackup.test.ts
npx eslint src --ext .js,.jsx,.ts,.tsx
cd android
.\gradlew.bat :app:compileDebugKotlin
```

完成原生桥后再执行完整 `npx jest --runInBand`；如构建环境允许，执行 `:app:assembleRelease` 生成车机 APK。

## 风险文件与回滚点

- `src/pages/searchPage/index.tsx`、`src/core/router/index.ts`：全局导航/搜索生命周期；若回归手动搜索，优先回滚焦点触发改动而保留 request id 类型。
- `src/utils/musicSourceMatch.ts`、`src/core/musicSourceSwitcher.ts`：会影响所有批量换源；保留旧阈值逻辑的独立 commit/差异段，便于恢复严格匹配。
- `android/.../lanBackup/*`、`MainApplication.kt`、`src/native/lanBackup/*`：跨层桥注册错误会导致应用启动或 JS 初始化失败；先通过 Kotlin 编译和 `isSupported` guard，再接入设置 UI。
- `src/core/lanBackup.ts` 与设置页：任何 restore 入口必须经过 `parseBackupPayload`；发现异常时只禁用 LAN 入口，不改动 FTP/WebDAV。
- i18n 文件和 ambient 类型必须成组更新，避免 TypeScript 编译出现缺失键。

## 完成门槛

- 规划文档通过用户确认后，才运行 `task.py start` 进入 `in_progress`。
- 实现完成后先运行 `trellis-check` 规定的质量检查，修复失败再进入提交阶段。
- 不在本任务内实现旧版收藏迁移、二维码扫描或云端服务。

## 实际验证结果

- `npx tsc --noEmit` 通过。
- 聚焦 Jest 共 5 个测试套件、28 个测试通过；完整 Jest 共 12 个测试套件、79 个测试通过。
- 完整只读 ESLint 为 0 个错误；保留仓库已有的 102 个警告。
- `:app:compileDebugKotlin` 与 `:app:assembleRelease` 均通过，`git diff --check` 通过。
- Android 1920x1080 模拟器验证作者“周杰伦”和专辑“叶惠美”均可从播放面板进入搜索页、自动填词并自动请求结果。
- LAN 手工验证覆盖页面访问、错误令牌 403 后继续服务、942 字节备份下载、有效备份还原、无效 JSON 在 JS 校验层拒绝且收藏不变，以及取消后端口立即释放。
- 最终通用 Release APK 已安装并正常启动；包名 `fun.upup.musicfree.car`，版本 `0.6.2`（versionCode `400011`），最低 Android 7.0（API 24）。
- APK 大小为 31,904,099 字节，SHA-256 为 `25C491D9B3C8E5E60090FC2E41CB07268F2E18BCA311E673B61499EA0B06C5B7`；v2 签名和 ZIP alignment 验证通过。仓库未配置私有 release keystore，因此当前产物使用 Android debug 证书签名。
