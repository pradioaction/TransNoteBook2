# TSBook2 v2.0 开发路线图

> 当前版本: v2.0 | 最后更新: 2026-07-03

<br />

***

## v2.0 新增功能

### ✅ 远程词书导入 (Remote Book Import)

**文件**：`electron/recitation/gitHubBookFetcher.ts`、`src/components/recitation/ImportBookDialog.tsx`

**功能**：
- [x] GitHubBookFetcher 服务：封装 GitHub/Gitee API，支持递归扫描全仓库获取 JSON 文件列表、按目录分组展示
- [x] 两个预设源：GitHub (KyleBing/english-vocabulary) + Gitee (pradio/english-vocabulary)，支持自定义仓库 URL
- [x] ImportBookDialog 弹窗：含"本地导入"和"从远端获取"两个 tab，支持勾选多本、进度显示、错误处理
- [x] 无需 Token，仅用公开 API（60次/小时限额对低频导入操作完全足够）
- [x] 输出面板日志：每个操作记录耗时和结果（绿色成功/红色失败），便于排查网络问题

**新增 IPC 通道**：
- `recitation:fetch-remote-books` — 获取远程仓库 JSON 文件列表
- `recitation:import-remote-book` — 下载并导入指定 JSON 文件

**新增/修改文件**：
- `electron/recitation/gitHubBookFetcher.ts` (新建)
- `electron/recitation/bookImporter.ts` (新增 importFromContent)
- `electron/recitation/bookService.ts` (新增 importFromJsonContent)
- `electron/handlers/recitationHandlers.ts` (新增 2 个 IPC)
- `electron/preload.ts` (新增桥接方法)
- `src/services/types.ts` / `src/services/recitationService.ts` (新增接口方法)
- `src/recitation/types.ts` / `src/types/notebook.ts` (RecitationAPI 新增方法)
- `src/components/recitation/ImportBookDialog.tsx` (新建)
- `src/components/recitation/BookManagerPanel.tsx` (导入按钮改为弹窗)

### ✅ 词书界面 UI/UX 改进

- [x] RecitationShell 状态页面（loading/no-workspace/error）背景色跟随主题（`colors.recitationBackground`）
- [x] StatsPanel 无词书时不再无限加载，显示"尚无词书，请先导入或创建词书"提示
- [x] StatsPanel 词书列表在导入后自动刷新（依赖 selectedBookId 变化触发）

### ✅ 侧边栏搜索功能 (Sidebar Search)

**文件**：`src/components/search/SearchPanel.tsx`（新建）

**功能**：
- [x] SearchPanel 组件：300ms 防抖搜索输入、大小写不敏感匹配 cell 的 content（HTML 提纯后）和 output
- [x] 搜索结果展示：cell 序号 + 上下文片段（前后 ~30 字符）+ 匹配数统计
- [x] 点击结果触发滚动：NotebookEditor 使用 `scrollIntoView({ block: 'center' })` 居中定位
- [x] 匹配文本高亮：在目标 cell 的阅读模式中用 `<mark>` 标签渲染，清空搜索或双击编辑时自动清除
- [x] 全局搜索预留：搜索函数接受 `NotebookCell[]` 入参，方便扩展到多文件搜索

**新增/修改文件**：
- `src/components/search/SearchPanel.tsx`（新建）
- `src/store/notebookStore.ts`（新增 searchHighlightText / scrollToCellIndex 等 5 个状态）
- `src/types/notebook.ts`（NotebookStore 接口扩展）
- `src/components/notebook/NotebookEditor.tsx`（添加 data-cell-index 属性和滚动逻辑）
- `src/components/cells/CellEditor.tsx`（阅读模式添加 `<mark>` 高亮渲染）
- `src/components/layout/Sidebar.tsx`（替换占位输入框为 SearchPanel）
- `src/locales/zh-CN.json` / `src/locales/en-US.json`（新增 4 个 i18n key）

***

## P0 — 紧急修复（Bug & 数据安全）

（同 v1.4 P0 清单，已完成项已勾选）

### P0-1 🔴 服务接口重复定义 ✅
### P0-2 🔴 workspaceConfig 类型安全 ✅
### P0-3 🔴 架构加固：Service-Store 解耦
- [ ] 将 useNotebookStore 和 useSettingStore 改为依赖注入模式
### P0-4 🔴 架构加固：IPC Handler 模块化 ✅
### P0-5 🔴 日志模块 Bug 修复 ✅
### P0-6 🔴 preload 类型重复 ✅

## P1 — 高优先级（核心功能完善）

### P1-1 🟠 快捷键补全
- [ ] Ctrl+Shift+S 另存为 / Ctrl+O 打开文件 / Ctrl+Shift+I 导入文本
- [ ] Ctrl+Enter 翻译选中 / Ctrl+Shift+Enter 翻译全部
- [ ] Ctrl+B 切换侧边栏 / Ctrl+J 切换底部面板

### P1-2 🟠 翻译错误重试机制
- [ ] error 状态单元格显示重试按钮
- [ ] 底部面板"重试全部失败"按钮

### P1-3 🟠 翻译缓存
- [ ] contentHash 缓存结构设计
- [ ] 会话级内存缓存 + 可选磁盘持久化

### P1-4 🟠 环境变量配置 UI 增强
- [ ] 自定义模型编辑界面"测试连接"按钮
- [ ] API Key 密码模式

## P2 — 中优先级（增强功能）

### P2-1 🟢 文章生成器集成 ✅（v1.4 已完成）

### P2-2 🟡 AI 批阅功能
- [ ] 用户手写文章 AI 批改

### P2-3 🟡 提示词模板变量替换预览
- [ ] 实时预览 {input} 占位符替换效果

### P2-4 🟡 阅读功能增强
- [ ] 阅读计时器数据持久化

## P3 — 低优先级（加固与优化）

### P3-1 🟢 UI 图标美化
### P3-2 🟢 用户自定义主题
### P3-3 🟢 背诵设置面板（SettingsDialog 集成）
### P3-4 🟢 工程优化
