# TSBook2 API — 类型定义

> 本文档定义 TSBook2 应用的全部核心 TypeScript 类型。类型定义分散在 `src/types/notebook.ts`、`src/types/electron.ts`、`src/recitation/types.ts`、`src/store/` 等文件中，本文聚合展示以供 API 查阅。

---

## 2.1 核心数据模型

核心数据模型定义在 `src/types/notebook.ts`。

### NotebookCell

单个单元格，当前仅支持 markdown 类型（预留富文本扩展）。

```typescript
interface NotebookCell {
  id: string                    // UUID
  type: 'markdown'
  content: string
  output: string
  parentId: string | null
  indentLevel: number
  isCollapsed: boolean
  isInputCollapsed: boolean
  isOutputCollapsed: boolean
}
```

### NotebookData

.transnb 文件的序列化格式。`wordMeta` 用于文章检测场景。

```typescript
interface NotebookData {
  version: string
  cells: NotebookCell[]
  wordMeta?: ArticleWordMeta
}

interface ArticleWordMeta {
  bookId: number
  bookName: string
  newWords: { id: number; word: string }[]
  reviewWords: { id: number; word: string }[]
}
```

### NotebookFile

运行时文件元数据，由 `notebookStore` 管理。

```typescript
interface NotebookFile {
  path: string | null
  name: string
  isModified: boolean
  cells: NotebookCell[]
  wordMeta?: ArticleWordMeta
}
```

---

## 2.2 Electron IPC 类型

IPC 共享类型定义在 `src/types/electron.ts`，供 `electron/` 主进程和 `src/` 渲染进程共同引用。

```typescript
interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface DirEntry {
  name: string
  path: string
}

interface ImportResult {
  filePath: string
  content: string
}

interface RecitationWordInput {
  word: string
  phonetic: string
  definition: string
  example: string
}
```

---

## 2.3 主题配置类型

`ThemeConfig` 定义在 `src/types/notebook.ts`，包含全部颜色键。分为以下颜色组：

### 基础色

```typescript
interface ThemeConfig {
  foreground: string
  background: string
  border: string
```

### 编辑器

```typescript
  editorBackground: string
  editorForeground: string
```

### 侧边栏

```typescript
  sidebarBackground: string
  sidebarHeader: string
  sidebarBorder: string
```

### 活动栏

```typescript
  activityBarBackground: string
  activityBarForeground: string
  activityBarActiveBorder: string
```

### 状态栏

```typescript
  statusBarBackground: string
  statusBarForeground: string
```

### 单元格

```typescript
  cellBackground: string
  cellSelectedBackground: string
  cellBorder: string
```

### 译文区

```typescript
  cellOutputBackground: string
  cellOutputBorder: string
  cellGutter: string
```

### 工具栏

```typescript
  toolbarBackground: string
  toolbarHover: string
```

### 按钮

```typescript
  primaryButton: string
  primaryButtonHover: string
```

### 错误

```typescript
  errorBackground: string
  errorBorder: string
  errorText: string
```

### 输入框

```typescript
  inputBackground: string
  inputBorder: string
```

### 面板

```typescript
  panelBackground: string
  panelBorder: string
```

### 列表

```typescript
  listItemHover: string
  listItemSelected: string
```

### 滚动条

```typescript
  scrollbar: string
```

### 背诵模式颜色

```typescript
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
```

### 背诵阶段颜色（6 阶段）

```typescript
  stageUnstudied: string
  stageBeginner: string
  stageReview: string
  stageConsolidate: string
  stageProficient: string
  stageMastered: string
}
```

---

## 2.4 设置相关类型

设置相关类型定义在 `src/types/notebook.ts`。渲染进程通过 `settingStore`（`src/store/settingStore.ts`）读写。

### TranslationSettings

翻译服务配置。`currentProvider` 格式为 `"system_Ollama"`、`"system_OpenAI"` 或 `"custom_{name}"`。

```typescript
interface TranslationSettings {
  enabled: boolean
  currentProvider: string
  ollama: { baseUrl: string; model: string }
  openai: {
    apiKeyEnv: string           // 环境变量名，如 "OPENAI_API_KEY"
    baseUrl: string             // API 端点 URL
    model: string               // 模型名
    timeout: number             // 超时时间（秒）
    proxy: string               // HTTP 代理（空字符串表示不使用）
  }
}
```

### CustomModel

用户自定义模型。支持 `ollama` 和 `ark`（火山引擎）两种后端。

```typescript
interface CustomModel {
  name: string                  // 自定义模型名称
  apiKeyEnv: string             // API Key 环境变量名
  endpoint: string              // 端点 URL
  model: string                 // 模型名 / 推理接入点 ID
  timeout: number               // 超时时间（秒）
  backend: string               // 后端类型: "ollama" | "ark"
  enabled: boolean              // 是否启用
}
```

### PromptTemplates

三个提示词模板，分别用于翻译、解析和场景文章生成。

```typescript
interface PromptTemplates {
  translation: string           // 翻译提示词（含 {input} 占位符）
  analysis: string              // 解析提示词
  scenery: string               // 场景文章生成提示词
}
```

### EnvVar

环境变量，用于存储 API Key 等敏感信息，仅保存在内存中，不持久化到 settings.json。

```typescript
interface EnvVar {
  name: string                  // 环境变量名
  value: string                 // 环境变量值
  description: string           // 描述说明
}
```

### AppSettings

完整设置结构，对应 `userData/settings.json` 的持久化格式。

```typescript
interface AppSettings {
  theme: string
  readingFontSize: number
  cellWidthRatio: number
  translation: TranslationSettings
  promptTemplates: PromptTemplates
  customModels: CustomModel[]
  recentFiles: string[]
  lastOpenFilePath: string | null
  envVars: EnvVar[]
}
```

---

## 2.5 背诵模式数据模型

背诵模式数据模型定义在 `src/recitation/types.ts`，与原始 Python 版本 `dataclass` 完全对应。

### Book

词书。v1.4 新增 `description` 字段。

```typescript
interface Book {
  id?: number
  name: string
  path: string
  count: number
  create_time?: string | null     // ISO datetime string
  description?: string            // v1.4 新增：词书描述
}
```

### Word

单词。`raw_data` 保留原始 JSON 导入数据，用于后续扩展。

```typescript
interface Word {
  id?: number
  book_id: number
  word: string
  phonetic: string
  definition: string
  example: string
  raw_data: string
}
```

### UserStudy

用户学习记录。`stage` 为艾宾浩斯阶段 0-8，`weight` 为复习权重。

```typescript
interface UserStudy {
  id?: number
  book_id: number
  word_id: number
  stage: number                   // 艾宾浩斯阶段 0-8
  weight: number                  // 复习权重
  last_review: string | null      // ISO datetime string
  next_review: string | null      // ISO datetime string
}
```

### BookProgress

词书进度摘要。

```typescript
interface BookProgress {
  total: number                   // 单词总数
  studied: number                 // 已学单词数
  review_due: number              // 待复习单词数
}
```

### BookWithProgress

词书附带进度信息，用于词书管理面板列表展示。

```typescript
interface BookWithProgress {
  book: Book
  total: number
  studied: number
  review_due: number
  progress: number                // 进度百分比（0-100）
}
```

### StageDistribution

10 阶段原始分布（未学 + stage 0-8），由数据层统计。

```typescript
interface StageDistribution {
  unstudied: number
  stage0: number
  stage1: number
  stage2: number
  stage3: number
  stage4: number
  stage5: number
  stage6: number
  stage7: number
  stage8: number
}
```

### StageSummary

合并后的 6 阶段摘要，用于 UI 展示。

```typescript
interface StageSummary {
  unstudied: number
  beginner: number                // stage 0-1
  review: number                  // stage 2-3
  consolidate: number             // stage 4-5
  proficient: number              // stage 6-7
  mastered: number                // stage 8
}
```

### StageFilter

按阶段过滤单词的参数。

```typescript
interface StageFilter {
  min: number
  max: number
  label: string
}
```

### mergeToSixStages

将 10 阶段原始分布合并为 6 阶段摘要的工具函数。

```typescript
function mergeToSixStages(dist: StageDistribution): StageSummary
```

### TodayWordsResult

今日单词结果，含新学单词和复习单词列表，以及已测单词 ID 列表和检测结果。

```typescript
interface TodayWordsResult {
  newWords: Word[]
  reviewWords: Word[]
  testedNewWordIds: number[]      // 今日已检测的新学单词 ID
  testedReviewWordIds: number[]   // 今日已检测的复习单词 ID
  quizResults: Record<number, boolean>  // v1.4 新增：检测结果（wordId -> isCorrect）
}
```

### BatchOperationResult

v1.4 新增：批量操作返回结果。

```typescript
interface BatchOperationResult {
  success: number                // 成功数
  failed: number                 // 失败数
  errors?: string[]              // 错误信息列表
}
```

### RecitationAPI

电子主进程 recitationAPI 接口（`src/recitation/types.ts` 中的 `RecitationAPI`）。

```typescript
interface RecitationAPI {
  init(workspacePath: string): Promise<boolean>
  addBook(book: Book): Promise<Book | null>
  getBookById(bookId: number): Promise<Book | null>
  getAllBooks(): Promise<Book[]>
  deleteBook(bookId: number): Promise<boolean>
  getBookProgress(bookId: number): Promise<BookProgress>
  getAllBooksWithProgress(): Promise<BookWithProgress[]>
  importBookFromFile(filePath: string): Promise<Book | null>
  getWordsByBook(bookId: number): Promise<Word[]>
  getUnstudiedWords(bookId: number, limit?: number): Promise<Word[]>
  getWordsForReview(bookId: number, limit?: number): Promise<Word[]>
  searchWords(searchText: string, bookId?: number): Promise<Word[]>
  startStudyWord(bookId: number, wordId: number): Promise<UserStudy | null>
  reviewWord(bookId: number, wordId: number, isCorrect: boolean): Promise<UserStudy | null>
  getConfig(): Promise<Record<string, unknown>>
  setConfig(key: string, value: unknown): Promise<boolean>
  getTodayWords(bookId: number, forceRefresh?: boolean): Promise<TodayWordsResult>
  refreshTodayWords(bookId: number): Promise<TodayWordsResult>
  markWordsAsTested(bookId: number, testedNewIds: number[], testedReviewIds: number[], quizResults?: Record<number, boolean>): Promise<boolean>
  addWord(bookId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<Word | null>
  updateWord(wordId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<boolean>
  deleteWord(wordId: number): Promise<boolean>
}
```

> **注意**: `markWordsAsTested` 在 v1.4 新增可选参数 `quizResults?: Record<number, boolean>`，用于同步检测结果。

### UI 相关的背诵模式类型

在 `src/recitation/quizTypes.ts` 和 `src/recitation/wordSidebarTypes.ts` 中还有 `QuizState`、`QuizQuestion`、`QuizOption`（含 `pairText` 字段支持悬停切换显示）、`WordSidebarData`（含 `quizResults?: Record<number, boolean>`）、`WordSidebarMode` 等 UI 相关的背诵模式类型。

---

## 2.6 状态管理接口

### NotebookStore

定义在 `src/types/notebook.ts`，实现于 `src/store/notebookStore.ts`。纯状态容器，单元格增/删/改/复制/合并/拆分等业务操作已迁移到 `useCellService()` Hook，文件读写 I/O 已迁移到 `useFileService()` Hook。

```typescript
interface NotebookStore {
  // === 状态 ===
  openFiles: Map<string, NotebookFile>
  activeFilePath: string | null
  selectedIndices: Set<number>
  notebook: NotebookFile | null
  openFileCount: number

  // === 文件管理 ===
  openFile(file: NotebookFile): void
  closeFile(key: string): void
  switchToFile(key: string): void
  setNotebook(notebook: NotebookFile): void
  setCells(cells: NotebookCell[]): void
  setFilePath(path: string | null): void
  setModified(modified: boolean): void

  // === 选择管理 ===
  selectCell(index: number): void
  selectCellRange(from: number, to: number): void
  toggleCellSelection(index: number): void
  clearSelection(): void

  // === 单元格内容操作（纯状态更新） ===
  updateCellContent(index: number, content: string): void
  updateCellOutput(index: number, output: string): void

  // === 文件创建 ===
  createEmptyNotebook(): void

  // === 回调解耦 ===
  _onFileOpened: ((path: string) => void) | null
  setOnFileOpened(cb: ((path: string) => void) | null): void
}
```

### ThemeStore

定义在 `src/types/notebook.ts`，实现于 `src/store/themeStore.ts`。

```typescript
interface ThemeStore {
  theme: 'light' | 'dark'
  colors: ThemeConfig
  setTheme(theme: 'light' | 'dark'): void
  getColors(): ThemeConfig
}
```

### WorkspaceStore

定义于 `src/store/workspaceStore.ts`。

```typescript
interface WorkspaceStore {
  workspacePath: string | null
  workspaceFiles: FileEntry[]
  sidebarActiveTab: string
  sidebarVisible: boolean
  panelVisible: boolean
  setWorkspace(path: string | null): void
  scanWorkspaceFiles(): Promise<void>
  setSidebarTab(tabId: string): void
  toggleSidebar(): void
  togglePanel(): void
  refreshFiles(): Promise<void>
}
```

### SettingStore

定义于 `src/store/settingStore.ts`。所有 `set*` 方法均使用 500ms debounced 持久化，避免频繁写盘。通过 `_onThemeChange` 回调解耦 themeStore 依赖。

```typescript
interface SettingStore {
  // === 设置状态 ===
  readingFontSize: number
  cellWidthRatio: number
  translation: TranslationSettings
  promptTemplates: PromptTemplates
  customModels: CustomModel[]
  envVars: EnvVar[]
  lastOpenFilePath: string | null
  recentFiles: string[]

  // === 回调解耦 ===
  _onThemeChange: ((theme: 'light' | 'dark') => void) | null
  setOnThemeChange(cb: ((theme: 'light' | 'dark') => void) | null): void

  // === 设置操作方法（500ms debounced 持久化） ===
  setReadingFontSize(size: number): void
  setCellWidthRatio(ratio: number): void
  setTranslation(settings: TranslationSettings): void
  setPromptTemplates(templates: PromptTemplates): void
  setCustomModels(models: CustomModel[]): void
  addCustomModel(model: CustomModel): void
  removeCustomModel(name: string): void
  setEnvVars(vars: EnvVar[]): void
  setLastOpenFilePath(path: string | null): void
  addRecentFile(path: string): void

  // === 持久化 ===
  loadFromDisk(): Promise<void>
  saveToDisk(): Promise<void>
}
```
