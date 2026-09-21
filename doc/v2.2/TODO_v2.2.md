# TSBook2 v2.2 开发路线图

> 基于 v2.1 | 最后更新: 2026-09-20

## ✅ 已完成 — v2.2 检测体验与数据健壮性

| 优先级 | 项目 | 说明 | 提交 |
|--------|------|------|------|
| P0 | 检测进度多槽位暂存 | `savedQuizProgress` 单快照 → `Record<slotKey, snapshot>`；`article` / `book_${bookId}` 独立暂存，恢复即消费；启动时机改为 `recitationService.init()` 成功后回填 | `1ca3621` |
| P1 | 完形填空题型 | 新增 `cloze` 题型；`extractClozeSentences()` 从已标注文章提取句子；`wordMeta.sentences` 随 `.transnb` 持久化；旧文件现场兜底提取 | `c5188de` |
| P1 | 「不认识」按钮与 F/0 键 | `DONT_KNOW_ANSWER = 'N'` 哨兵作答（后台记错、不高亮错误项）；F/0 键作答前 = 不认识 / 作答后 = 翻转详情（0 供右手区单手操作） | `1ca3621` |
| P1 | 最后一题停留复习 | 最后一题答完按 Enter/Space/下一题不再无响应，进入完成页 | `3cad3a7` |
| P1 | 远程词书 JSONL | `BookImporter._parseContent()` JSON → JSON Lines 降级解析；远程扫描与本地对话框均支持 `.jsonl` | `110b801` |
| P2 | 检测日志归属 | 日志从 ReviewPanel 迁至 QuizPanel（开始 / 完成各一条，`useRef` 防 StrictMode 重复） | `3cad3a7` |
| P2 | 工作区自动初始化背诵库 | `workspaceStore.setWorkspace()` 后立即 `init()`，保证进度回填有数据基础 | `1ca3621` |
| P2 | 设置与 Provider 输入归一化 | SettingsDialog 输入 `trim()`；ollama/openai/ark 配置与 API Key 解析 `trim()` | `110b801` |
| P2 | 侧边栏单词显示优化 | 长单词优先完整展示，释义按剩余空间省略 | `bac66dc` |
| P0 | 搜索面板稳定性修复 | zustand v5 选择器禁止返回不稳定引用；`SearchPanel` 空值兜底改为模块级常量，修复「点击搜索即整页白屏」（`getSnapshot` 无限循环 → `Maximum update depth exceeded`） | — |
| P0 | 搜索会话收口 | 新增 `SearchStore` 统一 `keyword` / `results` / `selectedIndex` / `highlightText` / `scrollToCellIndex`；文件切换与进入检测时 `resetSearch()`，修复退出检测返回阅读后高亮残留 | — |
| P1 | 分区 ErrorBoundary | 新增 `components/common/ErrorBoundary.tsx`（`sidebar` / `reading` / `recitation`），单面板异常不再卸载整棵 React 树 | — |
| P1 | 检测模式快捷键守卫 | `useKeyboard` 在 `recitationStore.active` 为真时跳过全部快捷键，避免检测中 `Delete` 误删阅读稿单元格 | — |
| P1 | 计时器生命周期 | `ReadingTimer` 卸载时真正 `stopTimer()`；「检测文章」恢复进度分支同样停表（收口到 `enterRecitationMode()`） | — |
| P1 | 待同步结果不丢失 | `QuizPanel` 待同步结果改为「渲染期快照 + 消费」，修复「退出」先 `reset()` 清空 `pendingSyncResults` 导致未满 10 条的已答单词丢失 | — |
| P2 | 高亮注入安全化 | `<mark>` 注入改为文本节点级（`TreeWalker`），关键词命中标签名/属性时不再破坏 HTML 结构 | — |
| P2 | 出题纯函数化 | 旧文章兜底提取的句子与完形填空选句不再原地改写 `wordMeta.sentences` | — |
| P2 | v2.1 文档勘误 | 14 项差异集中修正，见 [architecture/modules.md](architecture/modules.md#326-v21-文档勘误补记)；另补 E-15（v2.0 搜索高亮行为） | — |

### ✅ 搜索稳定性与搜索会话收口 (Search Stability & Session Scoping)

**文件**：`src/store/searchStore.ts`（新建）、`src/components/common/ErrorBoundary.tsx`（新建）

**功能**：
- [x] 修复点击侧边栏「搜索」图标导致整页白屏（zustand v5 选择器返回不稳定引用 → `getSnapshot` 无限循环 → React 卸载整棵树）
- [x] 搜索会话统一到 `SearchStore`（`keyword` / `results` / `selectedIndex` / `highlightText` / `scrollToCellIndex`）
- [x] 三条清理边界：清空关键词、文件切换/关闭、进入检测模式（`enterRecitationMode()`）
- [x] 分区 `ErrorBoundary`：侧边栏内容区 / 阅读区 / 检测区隔离，fallback 提供「重试」
- [x] 检测模式快捷键守卫（`useKeyboard`）
- [x] 阅读计时器生命周期修正（卸载即停表；恢复进度分支同样停表）
- [x] `QuizPanel` 待同步结果快照化，退出检测不再丢未满 10 条的已答单词
- [x] `<mark>` 高亮改为文本节点级注入；出题流程不再原地改写 `wordMeta`
- [x] 单测：`tests/store/searchStore.test.ts`、`tests/components/SearchPanel.test.tsx`

**新增/修改文件**：
- `src/store/searchStore.ts`（新建）
- `src/components/common/ErrorBoundary.tsx`（新建）
- `src/store/notebookStore.ts`（修改：移除搜索成员，四个文件切换入口接入 `resetSearch()`）
- `src/store/recitationStore.ts`（修改：新增 `enterRecitationMode()`）
- `src/components/search/SearchPanel.tsx`（修改）
- `src/components/cells/CellEditor.tsx`（修改）
- `src/components/notebook/NotebookEditor.tsx`（修改）
- `src/components/notebook/NotebookToolbar.tsx`（修改）
- `src/components/recitation/QuizPanel.tsx`（修改）
- `src/components/reading/ReadingTimer.tsx`（修改）
- `src/components/layout/AppShell.tsx` / `Sidebar.tsx`（修改）
- `src/hooks/useKeyboard.ts`（修改）
- `src/types/notebook.ts`（修改）
- `src/locales/zh-CN.json` / `en-US.json`（修改：`errorBoundary.*`）
- `tests/store/searchStore.test.ts`（新建）
- `tests/components/SearchPanel.test.tsx`（新建）

> 架构说明 → [architecture/modules.md §3.27](architecture/modules.md#327-搜索面板稳定性与搜索会话收口--v22-补记)

## ⏳ 待办（从 v2.0 / v2.1 继承）

### 基础功能
- [ ] 翻译错误重试机制
- [ ] 翻译缓存
- [ ] 提示词模板变量替换预览

### 背诵模式
- [ ] 背诵设置面板（SettingsDialog 集成）
- [ ] 文章生成器集成：AI 生成场景文章 → .transnb（当前已有 `generateSceneText` + `processArticleText` 链路，待收口）
- [ ] 新建连线形状类（绘制/渲染答题连线）
- [ ] 设置面板添加答题连线模式选项
- [ ] `RecitationService` 接口补齐（`addWord` / `updateWord` / `deleteWord` / `getStageDistribution` / `getOverallStageDistribution` / `getWordsByStage` 等已在实现与 UI 中使用，但未在 `services/types.ts` 声明）
- [ ] `NotebookStore` 接口补齐 `createEmptyNotebook()`

### 快捷键
- [ ] `Ctrl+Shift+E` 切换编辑/阅读模式
  （`Ctrl+S` / `Ctrl+Shift+S` / `Ctrl+O` / `Ctrl+Shift+I` / `Ctrl+Enter` / `Ctrl+B` / `Ctrl+J` 已实现）

### UI/UX
- [ ] SVG 图标美化
- [ ] 用户自定义主题
- [ ] 环境变量配置 UI 增强

### 编辑区右键菜单
- [ ] 编辑态右键菜单从占位项（`bold`/`italic`/`underline`，空实现）改为领域标记操作：标记为新词（`**`）/ 标记为复习词（`<u>`）；菜单顶部补充复制 / 粘贴 / 全选
- [ ] **标记落库与检测验证**：确认编辑区产生的 `**word**` / `<u>word</u>` 标记已随单元格内容持久化到 `.transnb` 存储，用于检测背诵模块能否正确识别；若无法识别，需补充落库或同步逻辑
- [ ] （二期）**清除标记**：首期菜单暂不展示。基于选区定向剥离 `**` / `<u>` 标记字符，需处理标记成对感知（避免留下孤立半截标记）与跨块选区（按 textblock 逐块处理）

## 🔧 Kokoro TTS 引擎 — 待办

### 当前状态：⚠️ Electron 集成失败

| 阶段 | 状态 | 说明 |
|------|------|------|
| C++ Addon 编译 | ✅ 通过 | cmake-js build 成功 |
| Node.js 独立测试 | ✅ 通过 | RTX 3060 合成成功：24000 Hz, 45000 samples, 1.88s |
| Electron 集成测试 | ❌ 失败 | 点击测试按钮无反应，无错误，无崩溃 |

**附带说明（v2.2）**：Kokoro 与 Edge TTS Provider 目前由 [providerFactory.ts](../../../src/tts/providerFactory.ts) 的 `SHOW_DEV_TTS_PROVIDERS = false` 统一隐藏，即便修复集成问题也需将该项改为 `true` 才会出现在设置面板。

| 项目 | 优先级 | 说明 |
|------|--------|------|
| 排查 Electron IPC | 🔴 高 | 确认 `window.electronAPI.tts` 在 dev 模式下是否可用；检查 preload 脚本是否正确注入；验证 `registerTtsHandlers()` 是否被执行 |
| 启用 Provider 开关 | 🟡 中 | `SHOW_DEV_TTS_PROVIDERS` 改为 `true`（Kokoro / Edge 一起对外） |
| 中文 Phonemizer | 🟡 中 | 解析 `phone-zh.fst` 以实现完整中文音素转换 |
| 音频输出验证 | 🟡 中 | 将 PCM 写入 WAV 文件试听确认音质 |
| ORT 手动清理 | 🟢 低 | 解决 `destroy()` atexit 冲突，避免依赖 `process.exit(0)` |
| TensorRT 后续尝试 | 🟢 低 | 关注 TRT 新版本对 ConvTranspose 兼容性修复 |

> 专题文档：[docs/tts-kokoro-20260722.md](../../docs/tts-kokoro-20260722.md)
