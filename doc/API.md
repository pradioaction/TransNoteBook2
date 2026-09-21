# TSBook2 API 接口文档

> 当前版本: v2.2 | 最后更新: 2026-09-21

本文档为 TSBook2 API 的章节索引，完整内容按模块拆分到版本目录下。

| 版本 | 定位 | 入口 |
|------|------|------|
| **v2.2**（当前） | 检测体验与数据健壮性 + v2.1 文档勘误 | [v2.2/api/](v2.2/api/electron-ipc.md) |
| v2.1 | TTS / Store 拆分 / 解耦 | [v2.1/api/](v2.1/api/electron-ipc.md) |
| v2.0 | 远程词书导入 / 搜索 / TTS | [v2.0/api/](v2.0/api/electron-ipc.md) |
| v1.4 | IPC 模块化 / 收藏 / 日志 | [v1.4/api/](v1.4/api/electron-ipc.md) |
| v1.3 | — | [v1.3/api/](v1.3/api/electron-ipc.md) |

> 历史版本目录（v1.3–v2.1）为**冻结快照**，不再修改；与当前代码的差异统一记录在 [v2.2/api/*](v2.2/api/electron-ipc.md) 的勘误段落与 [v2.2/architecture/modules.md §3.26](v2.2/architecture/modules.md) 的勘误清单。

---

## 1. Electron IPC API

主进程 `ipcMain.handle` 通道全量清单（文件/对话框/设置/工作区配置/背诵/TTS/EdgeTTS）、`preload.ts` 的 `contextBridge` 桥接签名、TTS 数据类型。

> 完整内容 → [v2.2/api/electron-ipc.md](v2.2/api/electron-ipc.md)

**核对结论**：v2.1/更早文档中列出的通道**均已实现**；此前遗漏的通道已在 v2.2 文档补全（`append-file`、`read-clipboard`、`open-book-dialog`、`workspace-config:get/set`、`recitation:*` 共 20 余个、`tts:*` 5 个、`tts:edge*` 2 个）。

---

## 2. 类型定义 API

`NotebookCell` / `NotebookData` / `NotebookFile` / `ArticleWordMeta` / `ThemeConfig` / `PromptTemplates` / `CustomModel` / `EnvVar` / `AppSettings` / `OperationStatus`，以及背诵模式数据模型 `Book` / `Word` / `UserStudy` / `TodayWordsResult` / `StageDistribution`。

> 完整内容 → [v2.2/api/types.md](v2.2/api/types.md)

**核对结论（文档有误，已在 v2.2 修正）**：

| 文档原述 | 实际实现 |
|---|---|
| `TranslationStatus`，`state: 'idle' \| 'translating' \| 'error'` | `OperationStatus`，`state: 'idle' \| 'running' \| 'error'`，另有 `operationType: 'translate' \| 'review'` |
| `TodayWordsResult { new_words, review_words }` | camelCase 五字段 `newWords` / `reviewWords` / `testedNewWordIds` / `testedReviewWordIds` / `quizResults` |
| `WorkspaceStore` 含 `recentFiles` / `addRecentFile` | 已迁至 `SettingStore`；`WorkspaceStore` 另有 `sidebarWidth` |
| `NotebookData` / `NotebookFile` 无 `wordMeta` | 均含 `wordMeta?: ArticleWordMeta`（且 `newWords[].sentences?` 为 v2.2 新增） |
| `ThemeConfig` 仅 32 键 | 实际另含背诵模式与 6 阶段配色共 27 键 |
| `NotebookStore.createEmptyNotebook()` | 实现存在，但 `NotebookStore` 接口**未声明** |

---

## 3. 工具函数 API

`parseNotebookFile` / `serializeNotebookFile` / `splitTextIntoParagraphs`（`fileUtils.ts`），`processArticleText` / `extractClozeSentences`（`articleUtils.ts`）。

> 完整内容 → [v2.2/api/utilities-examples.md](v2.2/api/utilities-examples.md)

**核对结论**：v2.2 新增 `extractClozeSentences(paragraphs, words)`；`serializeNotebookFile` 支持第二参数 `wordMeta`、`splitTextIntoParagraphs` 支持第二参数 `SplitMode`（文档此前均记为单参数）。

---

## 4. 状态管理 API（store/）

`useNotebookStore` / `useSearchStore` / `useWorkspaceStore` / `useThemeStore` / `useSettingStore` / `useTTSSettingStore` / `useOutputStore` / `useRecitationStore` / `useWorkspaceConfigStore` / `useReadingTimerStore`。

> 搜索会话状态（v2.2 新增 `SearchStore`）→ [v2.2/api/stores-hooks-services.md](v2.2/api/stores-hooks-services.md) §4.5、[types.md §2.5](v2.2/api/types.md)

> 完整内容 → [v2.2/api/stores-hooks-services.md](v2.2/api/stores-hooks-services.md) §4
> 检测状态与进度槽位 → [v2.2/api/recitation.md](v2.2/api/recitation.md)

---

## 5. React Hooks API（hooks/）

`useTheme` / `useKeyboard` / `useFileService` / `useCellService` / `useTranslationService` / `useRecitationService` / `useBookmark` / `useTTSService` / `useSpeek`。

> 完整内容 → [v2.2/api/stores-hooks-services.md](v2.2/api/stores-hooks-services.md) §5

**核对结论（文档有误，已在 v2.2 修正）**：快捷键表此前把 `Ctrl+S` / `Ctrl+Shift+S` / `Ctrl+O` / `Ctrl+Shift+I` / `Ctrl+Enter` / `Ctrl+B` / `Ctrl+J` 列为「待添加」，实际**均已实现**；当前仅 `Ctrl+Shift+E`（切换编辑/阅读模式）仍未实现。

---

## 6. 主题系统 API（styles/themes.ts）

`lightTheme` / `darkTheme`（`ThemeConfig` 实例），`useTheme()` 的 24 个 CSS 变量映射。

> 完整内容 → [v2.2/api/types.md](v2.2/api/types.md) §2.3、[v2.2/api/stores-hooks-services.md](v2.2/api/stores-hooks-services.md) §5

---

## 7. 配置设置 API

`{userData}/settings.json` 的读写（`get-settings` / `set-settings`），默认设置结构见 [electron/state.ts](../electron/state.ts) 的 `getDefaultSettings()`，TTS 配置见 `ttsSettingStore`，工作区级配置见 `workspace-config:get/set`。

> 完整内容 → [v2.2/api/electron-ipc.md](v2.2/api/electron-ipc.md)、[v2.2/api/types.md](v2.2/api/types.md) §2.4
> 默认设置结构原文 → [v2.0/api/utilities-examples.md](v2.0/api/utilities-examples.md) §7

**核对结论**：默认设置中还包含 `promptTemplates.review`（AI 写作批阅提示词），且 `AppSettings` 实际**不含** `lastOpenFilePath`（该字段仅存在于渲染侧 `SettingStore`）。

---

## 8. 典型调用流程

打开文件 / 保存文件（含 `wordMeta`）/ 导入文本 / 编辑单元格 / 切换主题 / 翻译单元格 / JSONL 词书导入。

> 完整内容 → [v2.2/api/utilities-examples.md](v2.2/api/utilities-examples.md) §5

---

## 9. 单元测试

| 项 | 值 |
|---|---|
| 框架 | Vitest（`environment: 'jsdom'`，`globals: true`） |
| 配置 | [vitest.config.ts](../vitest.config.ts) |
| 用例目录 | `tests/**/*.{test,spec}.{ts,tsx}` |
| 已有用例 | [notebookStore.test.ts](../tests/store/notebookStore.test.ts)、[themeStore.test.ts](../tests/store/themeStore.test.ts)、[fileUtils.test.ts](../tests/components/fileUtils.test.ts)、[setup.ts](../tests/setup.ts) |

```bash
npm run test         # 单次运行
npm run test:watch   # 监听模式
npm run typecheck    # tsc --noEmit
```

> **勘误**：v2.1 及更早文档的 vitest 配置链接指向已废弃的绝对路径（`g:/program/QSDReader-All/...`），已更正为仓库内相对路径。

---

## 10. Electron 配置与开发启动

```typescript
// electron/main.ts
new BrowserWindow({
  width: 1400, height: 900, minWidth: 800, minHeight: 600,
  title: 'TSBook2',
  webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  show: false, backgroundColor: '#1e1e1e',
})

const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
const distIndex = path.join(__dirname, '../dist/index.html')
if (isDev) { loadURL(devServerUrl); openDevTools() }
else if (fs.existsSync(distIndex)) { loadFile(distIndex) }
else { loadURL(devServerUrl); openDevTools() }
```

启动流程（`npm run electron:dev`）：

```
tsc -p tsconfig.node.json            编译主进程
    ↓
concurrently -k "vite" "node scripts/dev-electron.js"
    ↓
scripts/dev-electron.js：检测 5173 端口 → 未占用则 wait-on 等待 TCP 就绪（超时 30s）
    ↓
注入 VITE_DEV_SERVER_URL 后 spawn electron .
```

> 完整原文 → [v2.0/api/utilities-examples.md](v2.0/api/utilities-examples.md) §10
> **勘误**：v2.1 及更早文档记为「`wait-on` → `electron .`」，实际由 [scripts/dev-electron.js](../scripts/dev-electron.js) 统一负责端口检测、等待与启动，并可能跳过等待（端口已被占用时）。

---

## 11. 服务层 API（services/）

`FileService` / `CellService` / `TranslationService` / `RecitationService` / `TTSService` / `LogService` 的接口定义与实现位置。

> 完整内容 → [v2.2/api/stores-hooks-services.md](v2.2/api/stores-hooks-services.md) §11

**核对结论（文档有误，已在 v2.2 修正）**：

| 文档原述 | 实际实现 |
|---|---|
| `TranslationStatus` | `OperationStatus`（更名） |
| `TranslationService` 无 `reviewCell` | 已实现 `reviewCell(index, promptTemplate?)`（AI 写作批阅） |
| `FileService` 无 `saveImportAsTransnb` | 已实现 `saveImportAsTransnb(options)` |
| `RecitationService` 方法清单不全 | 实现另有 `createBook` / `searchBooks` / `addWord` / `updateWord` / `deleteWord` / `getStageDistribution` / `getOverallStageDistribution` / `getWordsByStage`（`services/types.ts` 接口声明待补齐） |

---

## 12. 翻译服务模块（translation/）

`TranslationProvider` 策略接口、`OllamaProvider` / `OpenAIProvider` / `ArkProvider`、`providerFactory`、`TranslationServiceDeps`。

> 完整内容 → [v2.2/api/translation.md](v2.2/api/translation.md) | v2.1 版 → [v2.1/api/translation.md](v2.1/api/translation.md)

**核对结论**：v2.2 起三个 Provider 的配置值与 API Key 解析统一 `trim()` 归一化；其余与 v2.1 一致。

---

## 13. 语音朗读模块（TTS）

`TTSProvider` 接口、`WebSpeechProvider` / `KokoroTrtProvider` / `EdgeTTSProvider`、`getTTSService()` 单例、`useTTSService` / `useSpeek`、`ttsSettingStore`、Kokoro C++ Napi Addon。

> 完整内容 → [v2.2/api/tts.md](v2.2/api/tts.md)、[v2.1/api/tts.md](v2.1/api/tts.md) | 引擎专题 → [docs/tts-kokoro-20260722.md](../docs/tts-kokoro-20260722.md)

**核对结论**：Kokoro / Edge 两个 Provider 受 `SHOW_DEV_TTS_PROVIDERS = false` 隐藏，**默认仅 WebSpeechProvider 生效**。

**v2.2 新增**：答题自动朗读开关 `TTSAutoReadSettings`（`question` / `hint` / `answer` / `flip`），随 `ttsSettingStore.tts.autoRead` 持久化，由 `useTTSService` 暴露给 `QuizPanel` 与设置页 → [tts.md §13.5](v2.2/api/tts.md#135-答题自动朗读开关autoread--v22-新增)。

---

## 14. 检测（测验）模块（recitation/）

题型（`word-to-meaning` / `meaning-to-word` / `cloze`）、`DONT_KNOW_ANSWER`、`quizEngine` 纯函数、检测进度多槽位暂存、题目生成与日志、`QuizPanel` 交互。

> 完整内容 → [v2.2/api/recitation.md](v2.2/api/recitation.md) | 词书管理 → [v2.1/api/recitation.md](v2.1/api/recitation.md)、[v2.0/api/recitation.md](v2.0/api/recitation.md)

---

## 15. 代码风格与约定

- **组件命名**: PascalCase（如 `CellContainer`, `NotebookEditor`）
- **文件命名**: camelCase（如 `notebookStore.ts`, `useKeyboard.ts`）；Store 文件以 `Store` 结尾，Hook 以 `use` 开头
- **状态管理**: 使用 `use` 前缀的 Hook 获取 store（如 `useNotebookStore`）
- **服务层**: 接口定义在 `src/services/types.ts`，实现使用 `create*Service()` 工厂函数，React Hook 封装使用 `use*Service()` 命名
- **类型文件**: 全局类型在 `src/types/notebook.ts`，翻译相关类型在 `src/translation/types.ts`，TTS 相关类型在 `src/tts/types.ts`，背诵相关类型在 `src/recitation/types.ts`
- **样式**: React inline styles + ThemeConfig，避免 CSS 文件扩散
- **路径别名**: `@/` 映射到 `src/`（`tsconfig.json` + `vite.config.ts` + `vitest.config.ts`）

---

## 附：本次核对发现的差异汇总

> 详细说明见 [v2.2/architecture/modules.md §3.26](v2.2/architecture/modules.md)（14 项）。

| 类别 | 数量 | 说明 |
|---|---|---|
| IPC 通道未记录 | 20+ | `append-file` / `read-clipboard` / `open-book-dialog` / `workspace-config:*` / 全部背诵通道 / `tts:*` / `tts:edge*` |
| 类型/接口更名或字段不符 | 6 | `OperationStatus`、`TodayWordsResult`、`WorkspaceStore`、`wordMeta`、`ThemeConfig`、`createEmptyNotebook` |
| 方法遗漏 | 3 | `reviewCell`、`saveImportAsTransnb`、`RecitationService` 的 8 个方法 |
| 函数签名过时 | 2 | `serializeNotebookFile`、`splitTextIntoParagraphs` |
| 快捷键表过时 | 1 | 7 个快捷键标为「待添加」，实际已实现 |
| 链接失效 | 4 | ARCHITECTURE §9/§10/§11、API §9 的 vitest 配置绝对路径 |
| 已实现但未文档化 | 1 | 检测页翻转卡片自动朗读（v2.1 提交引入） |
