# TSBook2 API — 类型定义 (v2.2)

> v2.2 变更：`ArticleWordMeta` 增加 `sentences`；`QuizQuestion` 增加 `clozeSentence`；`QuizQuestionType` 增加 `'cloze'`。
> 本节同时收录 **v2.1 文档与代码不符之处的勘误**（v2.1 文档保持冻结，此处集中修正）。

## 2.1 核心数据模型 — [types/notebook.ts](../../../src/types/notebook.ts)

```typescript
export interface NotebookCell {
  id: string
  type: 'markdown'             // 当前仅支持 markdown
  content: string
  output: string
  parentId: string | null
  indentLevel: number
  isCollapsed: boolean
  isInputCollapsed: boolean
  isOutputCollapsed: boolean
}

export interface ArticleWordMeta {
  bookId: number
  bookName: string
  newWords: { id: number; word: string; sentences?: string[] }[]     // v2.2：新增 sentences
  reviewWords: { id: number; word: string; sentences?: string[] }[]  // v2.2：新增 sentences
}

export interface NotebookData {
  version: string              // 序列化时固定写 "2.0"
  cells: NotebookCell[]
  wordMeta?: ArticleWordMeta   // 文章检测元数据（可选）
}

export interface NotebookFile {
  path: string | null
  name: string
  isModified: boolean
  cells: NotebookCell[]
  wordMeta?: ArticleWordMeta
}
```

> **v2.1 文档勘误**：`NotebookData` 与 `NotebookFile` 均早已包含 `wordMeta?: ArticleWordMeta` 字段，v2.1 文档未记录。

## 2.2 Electron IPC 类型 — [types/electron.ts](../../../src/types/electron.ts)

```typescript
interface FileEntry { name: string; path: string; isDirectory: boolean }
interface DirEntry  { name: string; path: string }
interface ImportResult { filePath: string; content: string }
```

## 2.3 主题配置 — [types/notebook.ts](../../../src/types/notebook.ts) / [styles/themes.ts](../../../src/styles/themes.ts)

`ThemeConfig` 除 v1.x 的 32 个基础键外，另含**背诵模式与阶段配色**共 27 个键：

```typescript
// === 背诵模式 ===
recitationBackground: string
recitationSidebarBackground: string
recitationSidebarBorder: string
quizCardBackground: string
quizCardBorder: string
quizOptionBackground: string
quizOptionHover: string
quizOptionSelected: string
quizOptionCorrect: string
quizOptionWrong: string
wordNewColor: string
wordReviewBatch0: string
wordReviewBatch1: string
wordReviewBatch2: string
wordReviewBatch3: string
wordCorrectBackground: string
wordWrongBackground: string
bookProgressBarFill: string
bookProgressBarTrack: string

// === 背诵阶段颜色（6 阶段） ===
stageUnstudied: string
stageBeginner: string
stageReview: string
stageConsolidate: string
stageProficient: string
stageMastered: string
```

## 2.4 设置相关类型

```typescript
export interface PromptTemplates {
  translation: string
  analysis: string
  scenery: string
  review: string               // AI 写作批阅提示词（已实现，默认值见下）
}

export interface CustomModel {
  name: string
  apiKeyEnv: string
  endpoint: string
  model: string
  timeout: number
  backend: string              // "ollama" | "ark" | "openai"
  enabled: boolean
}

export interface EnvVar { name: string; value: string; description: string }

export interface AppSettings {          // electron/state.ts:getDefaultSettings()
  theme: string
  readingFontSize: number
  translation: TranslationSettings
  promptTemplates: PromptTemplates
  customModels: CustomModel[]
  recentFiles: string[]
  envVars: EnvVar[]
}
```

`review` 模板默认值（[settingStore.ts](../../../src/store/settingStore.ts) / [state.ts](../../../electron/state.ts)）：

```
请对以下英文写作进行批改，包括语法检查、句式优化、用词建议和总体评分（满分10分）

原文：
{input}
```

### 服务层运行状态类型（**重要更名**）

```typescript
// src/services/types.ts
export interface OperationStatus {          // v2.1 文档写作 TranslationStatus，实际已更名为 OperationStatus
  state: 'idle' | 'running' | 'error'       // 注意：不是 'translating'
  operationType?: 'translate' | 'review'    // 用于区分翻译 / 写作批阅
  currentIndex: number
  totalCount: number
  progress: number
  error: string | null
  cellStates: Record<number, 'pending' | 'running' | 'done' | 'error'>
  cellErrors: Record<number, string>
  currentContent?: string                   // 当前内容预览（前 80 字符）
}
```

> **v2.1 文档勘误**：v2.1 文档（及 doc/API.md 第 11.4 节）称 `TranslationStatus`，`state` 取值为 `'translating'`。实际类型名为 `OperationStatus`，`state` 为 `'running'`，并新增 `operationType` 字段。

## 2.5 状态管理接口（实际定义）

### NotebookStore — [store/notebookStore.ts](../../../src/store/notebookStore.ts)

```typescript
export interface NotebookStore {
  openFiles: Map<string, NotebookFile>
  activeFilePath: string | null
  selectedIndices: Set<number>
  notebook: NotebookFile | null
  openFileCount: number

  // 搜索相关状态已于 v2.2 迁出至 SearchStore（见下）：
  // 原 searchHighlightText / scrollToCellIndex / setSearchHighlight / clearSearchHighlight / setScrollToCell

  // 文件打开回调（由 hook 注入）
  _onFileOpened: ((path: string) => void) | null
  setOnFileOpened: (cb: ((path: string) => void) | null) => void

  openFile: (file: NotebookFile) => void
  closeFile: (key: string) => void
  closeNotebook: () => void
  switchToFile: (key: string) => void
  setNotebook: (notebook: NotebookFile) => void
  setCells: (cells: NotebookCell[]) => void
  setFilePath: (path: string | null) => void
  setModified: (modified: boolean) => void
  selectCell: (index: number) => void
  selectCellRange: (from: number, to: number) => void
  toggleCellSelection: (index: number) => void
  clearSelection: () => void
  updateCellContent: (index: number, content: string) => void
  updateCellOutput: (index: number, output: string) => void
}
```

> **勘误**：`createEmptyNotebook()` **未在 `NotebookStore` 接口中声明**（store 实现里存在同名方法，但接口无此签名，文档引用会造成类型不匹配）。

### SearchStore — [store/searchStore.ts](../../../src/store/searchStore.ts)（v2.2 新增）

```typescript
export interface SearchResult {
  cellIndex: number
  matchedText: string
  matchCount: number
  contextSnippet: string
}

interface SearchStore {
  keyword: string                          // 搜索输入框
  results: SearchResult[]                  // 结果列表（300ms 防抖后写入）
  selectedIndex: number | null             // 结果列表选中项（cellIndex）
  highlightText: string                    // 阅读态注入 <mark> 的关键词
  scrollToCellIndex: number | null         // NotebookEditor 滚动目标
  setKeyword: (keyword: string) => void    // 关键词为空时顺带清除高亮
  setResults: (results: SearchResult[]) => void
  selectResult: (cellIndex: number, matchedText: string) => void
  setScrollToCell: (index: number | null) => void
  clearHighlight: () => void
  resetSearch: () => void                  // 全量归零
}
```

**迁移说明（v2.0 → v2.2）**：v2.0 的搜索状态被拆成两处——`keyword` / `results` / `selectedIndex` 在 `SearchPanel` 局部 state，`highlightText` / `scrollToCellIndex` 在 `NotebookStore`。进入检测模式时 `SearchPanel` 随侧边栏卸载而丢失关键词，全局高亮却保留，导致退出检测返回阅读后「搜索框已空却满屏高亮」。v2.2 将五个成员统一收敛到 `SearchStore`，并通过以下时机单点清理：

| 时机 | 调用点 |
|---|---|
| 切换/打开/关闭文件 | [notebookStore.ts](../../../src/store/notebookStore.ts) 的 `openFile` / `closeNotebook` / `switchToFile` / `setNotebook` |
| 进入检测模式（含「检测文章」恢复进度分支） | [recitationStore.ts](../../../src/store/recitationStore.ts) 的 `activate()` / `restoreQuizProgress()` → `enterRecitationMode()` |
| 清空搜索输入框 | `SearchStore.setKeyword('')` |

> **选择器约束**：zustand v5 的 `useStore` 直接把选择器结果交给 `useSyncExternalStore`，选择器必须返回稳定引用。禁止 `useXxxStore((s) => s.x ?? [])` 这类每次新建引用的写法（v2.2 曾因此导致搜索面板挂载即无限重渲染），空值兜底请使用模块级常量。

### WorkspaceStore — [store/workspaceStore.ts](../../../src/store/workspaceStore.ts)

```typescript
export interface WorkspaceStore {
  workspacePath: string | null
  workspaceFiles: FileEntry[]
  sidebarActiveTab: string
  sidebarVisible: boolean
  sidebarWidth: number          // 新增：侧边栏宽度
  panelVisible: boolean
  setWorkspace: (path: string | null) => void
  scanWorkspaceFiles: () => Promise<void>
  setSidebarTab: (tabId: string) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  togglePanel: () => void
  refreshFiles: () => Promise<void>
}
```

> **v2.1 文档勘误**：`recentFiles` / `addRecentFile` **已不在 WorkspaceStore 中**，实际位于 `SettingStore`。v2.2 起 `setWorkspace(path)` 还会在设置工作区后立即调用 `createRecitationService().init(path)`（模块级单例 `_recitationService`），失败仅 `console.error`，不阻塞 UI。

### 其余 Store 一览

| Store | 文件 | 说明 |
|---|---|---|
| ThemeStore | `store/themeStore.ts` | `theme: 'light' \| 'dark'`、`colors: ThemeConfig`、`setTheme`、`getColors` |
| SettingStore | `store/settingStore.ts` | 见 [stores-hooks-services.md](./stores-hooks-services.md) |
| TTSSettingStore | `store/ttsSettingStore.ts` | `tts: TTSSettings`、`setTTS`、`loadFromDisk`、`saveToDisk` |
| OutputStore | `store/outputStore.ts` | `logs`、`addLog`、`clearLogs` |
| RecitationStore | `store/recitationStore.ts` | 见 [recitation.md](./recitation.md) |
| WorkspaceConfigStore | `store/workspaceConfigStore.ts` | `bookmarkFilePath`、`loaded`、`load`、`setBookmarkFilePath` |
| ReadingTimerStore | `store/readingTimerStore.ts` | `running`、`elapsed`、`notebookPath`、`startTimer`、`stopTimer`、`tick` |

## 2.6 背诵模式数据模型 — [recitation/types.ts](../../../src/recitation/types.ts)

```typescript
export interface Book {
  id?: number
  name: string
  path: string
  count: number
  create_time?: string | null
  description?: string
}

export interface Word {
  id?: number
  book_id: number
  word: string
  phonetic: string
  definition: string
  example: string
  raw_data: string
}

export interface UserStudy {
  id?: number
  book_id: number
  word_id: number
  stage: number           // 艾宾浩斯阶段 0-8
  weight: number
  last_review: string | null
  next_review: string | null
}

export interface BookProgress { total: number; studied: number; review_due: number }

export interface BookWithProgress {
  book: Book
  total: number
  studied: number
  review_due: number
  progress: number        // 进度百分比
}

/** 10 阶段原始分布（未学 + stage 0-8） */
export interface StageDistribution {
  unstudied: number
  stage0: number; stage1: number; stage2: number; stage3: number; stage4: number
  stage5: number; stage6: number; stage7: number; stage8: number
}

/** 合并后的 6 阶段摘要 */
export interface StageSummary {
  unstudied: number; beginner: number; review: number
  consolidate: number; proficient: number; mastered: number
}

export interface TodayWordsResult {
  newWords: Word[]
  reviewWords: Word[]
  testedNewWordIds: number[]
  testedReviewWordIds: number[]
  quizResults: Record<number, boolean>
}

export interface BatchOperationResult { success: number; failed: number; errors?: string[] }
```

> **v2.1 文档勘误**：v2.1 文档沿用 v2.0 的 `TodayWordsResult { new_words, review_words }`（snake_case、两个字段）。实际为 **camelCase 的 5 个字段**（`newWords` / `reviewWords` / `testedNewWordIds` / `testedReviewWordIds` / `quizResults`）。此外还存在 `StageDistribution` / `StageSummary` / `BatchOperationResult` / `BookDetailedStats` / `StudyWordResult` / `ImportBookResult` 等未被 v2.1 文档收录的类型。
