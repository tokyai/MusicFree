# 技术设计

## 1. 边界与数据流

本任务保留现有三条边界，并只在各自 owner 处增加行为：

```text
作者/专辑入口
  -> typed router params + focus 生命周期
  -> search page atoms/useSearch
  -> 各启用插件搜索结果

收藏编辑器
  -> musicSourceSwitcher（查询、匹配、取流验证）
  -> MusicSheet.replaceMusicItems
  -> storage/music list

备份设置
  -> core/lanBackup（Backup JSON + 生命周期）
  -> src/native/lanBackup（类型化桥）
  -> Android LanBackupModule（临时 HTTP ServerSocket）
  -> 手机浏览器 GET 下载或 POST 上传
```

JSON 只在 `Backup`/`parseBackupPayload` 处拥有业务 schema；原生层不解析歌单字段，只负责令牌、请求边界、大小限制和 UTF-8 字节流。还原前仍由 TypeScript 调用 `parseBackupPayload`/`Backup.resume`，保证非法数据不会触发存储变更。

## 2. 搜索页导航

- 在 `RouterParams["search-page"]` 增加可选的 `searchRequestId`。
- `useNavigate` 增加一个明确的 `push` 选项（默认仍为 `navigation.navigate`），作者/专辑入口使用带唯一 request id 的新搜索栈项，避免同一路由和同一关键词被 React Navigation 去重。
- `searchPage` 用 `useFocusEffect` 处理带 `initialQuery` 的页面：每次重新获得焦点都清空旧结果、写入 query 并触发第 1 页音乐搜索；无 `initialQuery` 的手动搜索页不因返回焦点而重置。
- 保留现有卸载清理；不修改手动搜索提交和搜索历史逻辑。request id 只用于生命周期触发，不发送给插件。

## 3. 换源匹配与方向性修复

### 3.1 候选评分

- 继续使用 `normalizeMusicSourceText` 和艺人拆分，标题与歌手是硬门槛；采用稍宽的相似度下限以容忍平台标点、括号、feat 表达差异。
- 时长、专辑和版本标签只参与排序加分，不再因为单项不一致直接返回 `no-match`。候选排序优先标题/歌手，其次时长接近度和专辑相似度。
- 去掉仅因候选并列而失败的严格 ambiguity 阻断：在标题/歌手门槛通过后选择最高分；分数相同则保持插件返回顺序，避免“轻 QQ -> 轻酷狗”与反向因元数据差异走不同分支。
- 仍过滤缺少 `id/platform/title/artist` 的结果，并对每个候选执行现有 `getMediaSource` 可播放验证。

### 3.2 批量替换占用键

- 构建 `occupiedKeys` 时保留歌单内所有有效歌曲，包括本次选中但已经属于目标平台的歌曲；这些歌曲会按 `already-target` 跳过，仍必须阻止其他歌曲替换成相同目标身份。
- 并发结果在接受候选时立即把目标键加入 `occupiedKeys`，防止两首源歌曲映射到同一目标身份。
- 提交层继续使用 `SortedMusicList.replace` 重建索引并保留位置/元数据；若目标键仍与未选歌曲冲突，报告跳过而不覆盖。

## 4. 局域网 HTTP 传输

### 4.1 TypeScript/native 合约

`src/native/lanBackup/index.ts` 暴露 Android 能力：

```ts
startServer(options: {
  mode: "backup" | "restore";
  backupJson?: string;
}): Promise<{ url: string; expiresAt: number; mode: string }>;
waitForTransfer(): Promise<{ bytes: number; payload?: string }>;
stopServer(): void;
```

`src/core/lanBackup.ts` 负责：

- 备份模式把 `Backup.backup()` 传给桥并等待一次下载；
- 还原模式等待上传，检查 UTF-8 和 `parseBackupPayload` 后调用 `Backup.resume`；
- 暴露 `isSupported`、取消和统一错误码映射，清理所有挂起请求。

### 4.2 Android 协议

- `LanBackupModule` 使用单线程 executor、随机端口 `ServerSocket(0)` 和 `SecureRandom` 令牌；只允许一个活动服务。
- 选择第一个非 loopback 的 IPv4 地址，URL 形如 `http://<lan-ip>:<port>/?token=<token>`；无可用地址时仍返回 `127.0.0.1` 并让 UI 明确提示网络不可达。
- `GET /?token=...` 返回本地 HTML 页面。备份模式页面提供 `/download?token=...`；还原模式页面用 file input 和 `fetch` 将 JSON 原文 POST 到 `/upload?token=...`。
- 所有请求校验方法、路径和令牌；上传限制为固定最大字节数，支持 `Content-Length`，拒绝缺失/超限/非 UTF-8 请求；响应设置 `Connection: close` 和准确 `Content-Length`。
- 下载成功或上传接收后只完成一次 transfer promise，并关闭 socket；页面访问、错误请求不会完成传输，超时（默认 10 分钟）或 `stopServer` 会拒绝并释放资源。
- 原生层不记录 URL 令牌、备份正文或账号信息；`invalidate`、取消和异常路径都关闭 socket、executor 任务和挂起 Promise。

### 4.3 设置页交互

- 在现有 FTP/WebDAV 区块旁增加“局域网备份/局域网还原”两个入口，不改变原有方式。
- 新增一个轻量 `LanBackupDialog` 显示地址、复制按钮、同网段/可信网络提示和取消按钮；等待原生 transfer promise 完成后关闭并显示成功/失败 Toast。
- 还原仍遵守当前 `backup.resumeMode`；备份/还原按钮在 `LanBackup.isSupported` 为 false 时隐藏或给出明确提示。
- 所有新增文案同步简体中文、繁体中文、英文和 `src/types/core/i18n/index.d.ts`。

## 5. 兼容、失败和回滚

- Android 最低 API 24 不变；不声明 iOS 支持，iOS wrapper 返回 unsupported。
- LAN 服务是临时明文 HTTP，仅在用户主动操作时启动，令牌随机且单次使用；UI 明示只在可信局域网使用。
- 原生启动失败、无网卡、手机断开、超时和取消都不调用 `Backup.resume`；解析或恢复失败不修改现有歌单。
- 任何一层改动出现问题时可独立回滚：搜索和 matcher 改动不依赖 LAN，LAN 入口受 `isSupported` 保护；FTP/WebDAV 代码保持不变。

## 6. 验证策略

- matcher/service 单测覆盖双向换源、宽松元数据、重复键、取消和不可播放。
- LAN core 单测 mock native wrapper，覆盖 start/wait/parse/restore/cancel/unsupported；Kotlin 至少执行编译和协议解析纯函数测试（如可用）。
- TypeScript、ESLint、Jest、Kotlin compile 后在 Android 模拟器验证：同网手机浏览器下载、上传、取消和超时。
