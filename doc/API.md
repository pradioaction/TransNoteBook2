# TSBook2 API 接口文档

本文档为 TSBook2 API 的章节索引。完整内容请参阅 [doc/v1.3/API.md](v1.3/API.md)。

---

## 1. Electron IPC API

Electron 主进程与渲染进程之间的 IPC 通信接口。

### 1.1 主进程 IPC Handlers (electron/main.ts)

涵盖文件操作（read-file / write-file / delete-file / rename-file）、对话框（open-file-dialog / save-file-dialog / open-folder-dialog / open-import-dialog）、目录遍历（read-directory / read-directory-recursive）、设置读写（get-settings / set-settings）、剪贴板（read-clipboard）、以及背诵模式 IPC（词书 CRUD、单词 CRUD、学习流程、配置、阶段分布、已测标记等）。

> 完整 IPC 通道表见 [v1.3/API.md §1.1](v1.3/API.md#11-主进程-ipc-handlers-electronmaints)

### 1.2 预加载桥接 (electron/preload.ts)

通过 `contextBridge.exposeInMainWorld('electronAPI', {...})` 暴露类型安全的 API 对象，含文件操作、对话框、设置读写、菜单事件、背诵模式 API（recitationAPI）。

> 完整接口定义见 [v1.3/API.md §1.2](v1.3/API.md#12-预加载桥接-electronpreloadts)

---

## 2. 类型定义 API (types/notebook.ts)

应用核心类型定义。

### 2.1 核心数据模型

- **NotebookCell**: 单元格（id, content, output, parentId, indentLevel, 折叠状态）
- **NotebookData**: 文件序列化格式（version, cells, wordMeta）
- **NotebookFile**: 文件元数据（path, name, isModified, cells）

### 2.2 Electron IPC 类型

`FileEntry`、`DirEntry`、`ImportResult`、`RecitationWordInput`

### 2.3 主题配置类型

`ThemeConfig` — 40 个颜色键，含基础色、编辑器、侧边栏、背诵模式配色、6 阶段颜色等。

### 2.4 设置相关类型

`TranslationSettings`、`CustomModel`、`PromptTemplates`、`EnvVar`、`AppSettings`

### 2.5 背诵模式数据模型

`Book`、`Word`、`UserStudy`、`BookProgress`、`BookWithProgress`、`StageDistribution`、`StageSummary`、`StageFilter`、`TodayWordsResult`（含 `testedNewWordIds`/`testedReviewWordIds`）

另有 `QuizState`、`QuizQuestion`、`QuizOption`、`WordSidebarData` 等 UI 类型。

> 完整类型定义见 [v1.3/API.md §2.5](v1.3/API.md#25-背诵模式数据模型)

### 2.6 状态管理接口

`NotebookStore`、`ThemeStore`、`WorkspaceStore`、`SettingStore`（含回调解耦，500ms debounced 持久化）

> 完整 Store 接口见 [v1.3/API.md §2.6](v1.3/API.md#26-状态管理接口)

---

## 3. 文件工具 API (utils/fileUtils.ts)

- **parseNotebookFile**: 解析 .transnb JSON（兼容 v1.0/v2.0）
- **serializeNotebookFile**: 序列化为 JSON（缩进 2 空格）
- **splitTextIntoParagraphs**: 按双换行分割文本

---

## 4. 状态管理 API (store/)

Zustand 状态管理 Hooks。

### 4.1 useNotebookStore
单元格数据、文件管理、多文件支持、选择管理。

### 4.2 useWorkspaceStore
工作区路径、文件列表、侧边栏/面板可见性、最近文件。

### 4.3 useThemeStore
主题切换（light/dark），提供颜色配置。

### 4.4 useSettingStore
应用设置（翻译、提示词、自定义模型、环境变量），500ms debounced 磁盘持久化。

### 4.5 useOutputStore
日志输出（info/warn/error），底部 Panel 显示。

### 4.6 useRecitationStore
背诵 UI 状态：阶段切换、侧边栏数据、单词选择（含 `selectWordRange`）、检测状态、测验结果追踪（`quizResultsByBook`）、批量同步（`pendingSyncResults`）。

> 完整 Store 接口见 [v1.3/API.md §4.6](v1.3/API.md#46-userecitationstore-recitationstorets)

---

## 5. React Hooks API (hooks/)

### 5.1 useTheme
将 ThemeConfig 映射为 CSS 变量，提供主题切换和颜色获取。

### 5.2 useKeyboard
全局键盘快捷键（Ctrl+N/D/M/E/Q/W 等），自动跳过编辑状态。

### 5.4 useRecitationService
背诵服务模块级单例 Hook，封装所有词书/单词/IPC 通信，含 `markWordsAsTested`、`getStageDistribution` 等 v1.3 新增方法。

> 完整接口见 [v1.3/API.md §5.4](v1.3/API.md#54-userecitationService)

---

## 6. 主题系统 API (styles/themes.ts)

`lightTheme` 和 `darkTheme` 两套完整主题配置，各 40 个颜色键。

---

## 7. 配置设置 API (electron/main.ts)

默认设置结构（theme, readingFontSize, cellWidthRatio, translation, promptTemplates, customModels 等），持久化到 `{userData}/settings.json`，JSON 格式缩进 2 空格。

---

## 8. 典型调用流程

- 8.1 打开 .transnb 文件（对话框 → 读取 → 解析 → 打开到编辑器）
- 8.2 保存文件（直接保存 / 另存为）
- 8.3 导入文本（对话框 → 分割 → 创建单元格 → 打开）
- 8.4 编辑单元格内容（TipTap onChange → updateCellContent → isModified）
- 8.5 切换主题（setTheme → CSS 变量更新）
- 8.6 翻译单元格（translateCell → Provider → HTTP → updateCellOutput + 状态同步）

> 完整代码示例见 [v1.3/API.md §8](v1.3/API.md#8-典型调用流程)

---

## 9. 单元测试 API (tests/)

Vitest + jsdom + @testing-library/jest-dom。运行：`npm run test`。覆盖 notebookStore 和 fileUtils。

---

## 10. Electron 配置说明

BrowserWindow 配置（1400×900, contextIsolation, preload）、开发/生产模式（Vite dev server / dist/index.html）、启动流程（tsc → vite → wait-on → electron）。

---

## 11. 服务层 API (services/)

服务层接口定义及实现。

### 11.1 类型导出
导入 `FileService`、`CellService`、`TranslationService`、`RecitationService`。

### 11.2 FileService
文件操作（open/save/import/create/delete/rename），实现在 `hooks/useFileService.ts`。

### 11.3 CellService
单元格操作（insert/delete/copy/split/merge/move/collapse/dependency），实现在 `hooks/useCellService.ts`。

### 11.4 TranslationService
翻译服务（translateCell/translateAll/testConnection/cancel），含逐单元格状态追踪（200ms 轮询同步）。

### 11.5 RecitationService
背诵服务 IPC 代理，含 v1.3 新增方法：`markWordsAsTested`、`getStageDistribution`、`getWordsByStage`。

> 完整接口见 [v1.3/API.md §11.5](v1.3/API.md#115-re Citationservice)

---

## 12. 翻译服务 API (translation/)

策略模式设计，定义 `TranslationProvider` 接口。

### 12.1 TranslationProvider 接口
translate / testConnection / getInfo

### 12.2 OllamaProvider
本地 Ollama 服务（system，默认 qwen2.5:0.5b）

### 12.3 OpenAIProvider
OpenAI 兼容 API（system，支持代理）

### 12.4 ArkProvider
火山引擎 Ark（custom，通过 ProviderFactory 创建）

### 12.5 ProviderFactory
buildProvider / createSystemProviders / createCustomProviders

### 12.6 useTranslationService Hook
响应式 Hook，status 通过 200ms 轮询同步。

---

## 13. 代码风格与约定

PascalCase 组件命名、camelCase 文件命名、`use` 前缀 Hook、`create*Service()` 工厂函数、`@/` 路径别名映射 `src/`。
