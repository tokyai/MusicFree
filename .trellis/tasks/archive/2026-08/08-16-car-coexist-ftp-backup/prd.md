# 车机共存包、FTP/FTPS 备份与大屏布局修正

## Goal

生成一个能与原版 MusicFree 同时安装的车机版本；在目标车机缺失或禁用系统文件管理能力时，备份、还原和其他页面不再启动系统文件/媒体选择器；同时让 1920×1080、14.6 英寸车机上的横屏分栏、抽屉、面板和文字控件比例合理。

## Background

- 当前 Android `applicationId`、namespace 和 Kotlin package 都是 `fun.upup.musicfree`。用户已确认共存版本使用 `fun.upup.musicfree.car`，显示名称使用 `MusicFree车机版`，namespace 和 Kotlin package 保持不变。
- 当前本地备份进入应用内文件夹页，本地还原、插件本地安装、歌词上传、歌单封面和主题背景选择会启动系统文档/媒体选择器；目标车机执行后者可能直接闪退。
- 下载目录和本地音乐目录使用应用内 `FileSelector` 直接读取目录，不启动系统文件管理器，可以保留。
- 仓库已存在 URL/WebDAV 恢复和 WebDAV 备份。它们不连接 FTP，但也不启动系统文件选择器；本任务新增 FTP/FTPS 主路径，不要求删除这些已有的非文件选择器路径。
- 参考项目 `D:\Sync\Tianyi\gupiao\hermes-config-ui` 使用系统 SSH/SCP 和 SSH 隧道，不是 FTP/SFTP；Android 端不复用其 Python/OpenSSH 实现。
- 当前工程最低版本为 API 24（Android 7.0），不是 Android 6/API 23。本任务保持现有兼容下限。

## Requirements

### R1. Android 共存身份

- Android application ID 固定为 `fun.upup.musicfree.car`，显示名称固定为 `MusicFree车机版`。
- 保留 React Native 组件名 `MusicFree`、Android namespace 和 Kotlin package，避免无必要迁移。
- 新旧应用可同时安装，配置、插件、数据库、缓存和播放状态使用各自的应用沙箱，互不覆盖。

### R2. FTP/FTPS 配置

- 设置页提供模式、主机、端口、用户名、密码和远程目录配置；固定远程文件名为 `MusicFreeBackup.json`，默认目录为 `/MusicFree`，默认端口为 21。
- 模式支持普通 FTP 和显式 FTPS（AUTH TLS）；未设置时默认 FTPS。两种模式共用其余配置，切换后立即用于下一次测试、备份和还原。
- 设置页提供连接测试，并对缺少配置、无效端口和目录格式给出可读提示。
- 地址、账号和密码只保存在现有应用配置存储中，不硬编码、不写入日志或提交记录。
- FTPS 使用系统信任库和主机名校验，同时加密控制与数据连接；证书或 TLS 握手失败时不得自动降级为 FTP。
- 普通 FTP 仅在用户主动选择时使用，并明确提示账号、密码和备份内容会以明文传输。

### R3. FTP/FTPS 备份

- 点击 FTP/FTPS 备份后，直接上传 `Backup.backup()` 产生的 JSON，不打开文件或目录选择器。
- 网络连接和文件传输在 Android 后台线程执行，采用被动模式、二进制传输、连接/读写超时、取消和确定性资源清理。
- 先上传唯一临时文件，再通过同目录重命名替换正式文件；失败或取消时清理临时数据并保留上一份成功备份。
- 备份期间显示加载状态；成功、认证失败、超时、断网、目录不存在、TLS 失败、上传失败和替换失败均有明确结果且不闪退。

### R4. FTP/FTPS 还原

- 还原前显示确认提示，确认后从固定远程文件下载到应用缓存，不打开系统文件选择器。
- 下载结果必须是可解析且结构有效的 UTF-8 JSON，随后沿用现有三种 `ResumeMode` 并调用 `Backup.resume()`。
- 成功、失败或取消后均清理本地临时文件；远程文件不存在、认证失败、超时、断网、TLS 失败和无效 JSON 不得修改本地数据并应给出可读提示。

### R5. 系统文件选择器安全

- 车机共存版移除本地备份/还原入口，以及插件本地安装、原歌词/翻译歌词上传、歌单封面选择、自定义主题背景选择等所有会启动系统文档/媒体选择器的入口。
- 同时移除通过外部 JS 文件意图进行本地插件安装的入口；保留插件 URL 安装、订阅更新和 `musicfree://install` 网络链接。
- 保留应用内 `FileSelector`、本地音乐扫描、下载目录选择、音频文件打开和不依赖系统文件选择器的 URL/网络导入功能。

### R6. 车机大屏与横屏布局

- 对首页抽屉、首页操作区、所有 `ResponsiveSplitView` 页面、导航 rail、信息页、操作栏、Panel、Dialog、列表和固定宽度热点进行完整静态审计。
- 车机模式使用语义化分栏比例：导航 `24:76`、首页 `28:72`、信息 `30:70`、播放器/歌词 `42:58`、右侧操作栏 `74:26`、双表单 `50:50`；车机模式关闭时保持现有比例和竖屏行为。
- 首页抽屉约占可用宽度 24%～28% 并设置安全上下限；修正抽屉参数传递、标题边距和横向溢出。
- Panel/Dialog 根据安全区和实际可用宽度设定上下限；页面或面板容器中的遗留 `rpx(500/620/750)` 固定宽度不得造成裁切、重叠或不可点击空白。
- 分栏的每个 pane 及虚拟列表父级保持有界的 `flex`、`minWidth: 0`、`minHeight: 0`；不为列表行新增尺寸监听，不改变播放、请求、插件或歌词业务状态。
- 目标设备为 1920×1080、14.6 英寸；代码依据 React Native 逻辑尺寸和现有车机字号档位计算，不按物理像素硬编码。

### R7. 回归与交付

- 保持现有 URL/WebDAV 远程路径、竖屏、手机模式、车机模式开关及中/大字号档位行为可用。
- TypeScript、Jest、ESLint 和 Android Kotlin 编译通过；生成可安装的 debug 与 release universal APK，并验证最终 APK 的 application ID 和签名。

## Acceptance Criteria

- [ ] AC1: `fun.upup.musicfree.car` APK 可与 `fun.upup.musicfree` 同时安装，显示为 `MusicFree车机版`，两者应用数据互不覆盖。
- [ ] AC2: 设置中可在普通 FTP 与显式 FTPS 间切换；FTPS 使用系统证书和主机名校验且失败不降级，普通 FTP 有明文风险提示。
- [ ] AC3: 连接测试对成功、配置无效、认证失败、超时、目录不存在和 TLS 失败给出明确结果且不闪退。
- [ ] AC4: 备份成功后固定远程路径存在有效 `MusicFreeBackup.json`；上传、替换或取消失败时上一份成功数据仍保留。
- [ ] AC5: 还原在确认后下载并恢复歌单和插件，遵守当前 `ResumeMode`；无效/缺失文件和网络错误不修改本地数据。
- [ ] AC6: 在没有可用系统文件管理器的车机上，备份、还原和所有已确认的文件/图片入口均不会启动系统选择器；应用内目录选择与网络安装仍可用。
- [ ] AC7: 车机模式下首页抽屉、首页操作区、导航 rail、信息页、播放器/歌词和右侧操作栏采用对应语义比例，左栏不再明显过宽。
- [ ] AC8: 1920×1080 目标尺寸下没有横向裁切、重叠、越界面板、不可点击空白或过小关键文字/触控目标；竖屏和车机模式关闭时没有布局回归。
- [ ] AC9: 所有 FTP/FTPS 任务在成功、失败和取消后关闭连接并清理临时文件；日志和错误信息不包含密码。
- [ ] AC10: `npx tsc --noEmit`、`npx jest --runInBand`、只读 ESLint 和 Android Kotlin 编译通过；debug/release universal APK 构建并完成 application ID、签名检查。

## Out of Scope

- FTP/FTPS 服务端安装、账号、证书、目录权限、被动端口、防火墙和公网暴露配置。
- SFTP、隐式 FTPS/990、SSH 隧道、自签名证书信任开关或 FTPS 到明文 FTP 的自动降级。
- 多版本备份历史、冲突合并、后台定时备份、云账号和跨用户共享。
- 将最低 Android 版本从 API 24 降到 API 23；当前 APK 仍只支持 Android 7.0 及以上。
- 修改 React Native 组件名、Kotlin package/namespace 或现有 `musicfree://` 深链协议。
