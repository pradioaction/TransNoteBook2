# TSBook2 API — 状态管理、Hooks 与服务层 (v2.2)

> v2.2 变更：`WorkspaceStore.setWorkspace()` 工作区就绪后自动初始化背诵数据库；`RecitationStore` 检测进度槽位化（详见 [recitation.md](./recitation.md)）；搜索会话状态由 `NotebookStore` 迁出至新增的 `SearchStore`。
> 本节同时收录 **v2.1 文档与代码不符之处的勘误**（如快捷键表、`TranslationStatus` 更名、WorkspaceStore 字段迁移）。

## 4. 状态管理 API — Store 清单（实际）

| Store | 文件 | 职责 |
|---|---|---|
| `useNotebookStore` | `store/notebookStore.ts` | 多文件打开、单元格选择、纯状态更新 |
| `useSearchStore` | `store/searchStore.ts` | 侧边栏搜索会话（关键词/结果/高亮/滚动目标，v2.2 新增） |
| `useWorkspaceStore` | `store/workspaceStore.ts` | 工作区路径/文件列表/侧边栏与面板可见性/侧边栏宽度 |
| `useThemeStore` | `store/themeStore.ts` | 主题 light/dark + ThemeConfig |
| `useSettingStore` | `store/settingStore.ts` | UI 偏好、翻译配置、提示词模板、自定义模型、环境变量、最近文件、工作区路径 |
| `useTTSSettingStore` | `store/ttsSettingStore.ts` | TTS 配置（v2.1 从 settingStore 拆分） |
| `useRecitationStore` | `store/recitationStore.ts` | 背诵模式 UI 状态 + 检测状态 + 进度槽位 |
| `useOutputStore` | `store/outputStore.ts` | 底部面板日志（文件写入见 `subscribe`） |
| `useWorkspaceConfigStore` | `store/workspaceConfigStore.ts` | 工作区级配置（收藏夹文件路径） |
| `useReadingTimerStore` | `store/readingTimerStore.ts` | 阅读计时（v1.4 引入） |

### 4.1 useSettingStore — [settingStore.ts](../../../src/store/settingStore.ts)

```typescript
export interface SettingStore {
  readingFontSize: number
  cellWidthRatio: number
  translation: TranslationSettings
  promptTemplates: PromptTemplates
  customModels: CustomModel[]
  envVars: EnvVar[]
  lastOpenFilePath: string | null
  recentFiles: string[]
  workspacePath: string | null
  _onThemeChange: ((theme: 'light' | 'dark') => void) | null
  setOnThemeChange: (cb: ((theme: 'light' | 'dark') => void) | null) => void

  setReadingFontSize / setCellWidthRatio / setTranslation / setPromptTemplates
  setCustomModels / addCustomModel / removeCustomModel / setEnvVars
  setLastOpenFilePath / addRecentFile / setWorkspacePath

  loadFromDisk(): Promise<void>
  saveToDisk(): Promise<void>
}
```

- **无 `tts` / `setTTS`**（v2.1 起拆分至 `useTTSSettingStore`）。
- 所有 `set*` 通过 `debouncedSave()`（500ms 防抖）批量落盘。
- `saveToDisk()` 会一并写入 `theme`（读自 `useThemeStore`）与 `workspacePath`。
- `addRecentFile(path)` 去重前置、最多保留 10 条。

### 4.2 useWorkspaceStore — v2.2 变更

```typescript
setWorkspace: (path) => {
  set({ workspacePath: path, workspaceFiles: [] })
  if (path) {
    get().scanWorkspaceFiles()
    // v2.2：工作区加载后立即尝试初始化背诵数据库（无需等待首次点击背诵图标）
    getRecitationService().init(path).catch((err) => {
      console.error('[Recitation] 工作区加载后自动初始化数据库失败:', err)
    })
  }
}
```

> 模块级 `_recitationService` 惰性单例通过 `createRecitationService()` 创建，避免 Store 反复实例化。

### 4.3 useOutputStore — [outputStore.ts](../../../src/store/outputStore.ts)

```typescript
interface OutputStore {
  logs: LogEntry[]
  addLog: (message: string, level?: 'info' | 'warn' | 'error', color?: string) => void
  clearLogs: () => void
}

interface LogEntry {
  id: string          // `log-${++_logId}`
  timestamp: string   // HH:mm:ss
  message: string
  level: LogLevel
  color?: string
}
```

文件写入在模块底部通过 `useOutputStore.subscribe()` 完成（v2.1 解耦，v2.2 未变更）：

```typescript
useOutputStore.subscribe((state, prevState) => {
  if (state.logs.length <= prevState.logs.length) return
  const lastEntry = state.logs[state.logs.length - 1]
  const svc = getLogService()            // 惰性创建，绑定 workspaceStore.workspacePath
  const todayPath = svc.getLogPath()
  if (todayPath) svc.appendToFile(todayPath, `[${lastEntry.timestamp}] [${LEVEL}] ${msg}\n`)
})
```

### 4.4 useTTSSettingStore — [ttsSettingStore.ts](../../../src/store/ttsSettingStore.ts)

```typescript
export interface TTSAutoReadSettings {   // v2.2 新增
  question: boolean   // 切题时朗读题干单词（仅英文题干题型）
  hint: boolean       // 答题前朗读答案单词（提示模式，会泄露答案）
  answer: boolean     // 作答后朗读所选选项的单词
  flip: boolean       // 翻卡时朗读卡片上的单词
}

export interface TTSSettings {
  enabled: boolean
  provider: string
  rate: number
  volume: number
  voiceId: string
  autoRead: TTSAutoReadSettings   // v2.2 新增
}

setAutoRead(settings: Partial<TTSAutoReadSettings>): void   // v2.2 新增
```

默认值：`{ enabled: true, provider: 'system_WebSpeech', rate: 0.9, volume: 1.0, voiceId: '', autoRead: { question: true, hint: false, answer: true, flip: true } }`

`saveToDisk()` 先 `getSettings()` 读取全量，合并 `tts` 字段后再整体写回，避免覆盖其他设置。

`setAutoRead()` 对 `autoRead` 做浅合并（不覆盖同组其他字段）；`loadFromDisk()` 对 `autoRead` 逐层兜底（`{ ...defaultAutoRead, ...(stored.autoRead ?? {}) }`），兼容不含该字段的旧 `settings.json`。开关语义与设计约束见 [tts.md §13.5](./tts.md#135-答题自动朗读开关autoread--v22-新增)。

### 4.5 useSearchStore — [searchStore.ts](../../../src/store/searchStore.ts)（v2.2 新增）

搜索会话的唯一状态源，字段与生命周期见 [types.md §2.5 SearchStore](./types.md#searchstore--storesearchstoretsv22-新增)。

要点：

- `setKeyword('')` 会同步清空 `highlightText`，补齐 v2.0 文档所述「清空搜索自动清除高亮」的行为。
- `resetSearch()` 在「切换/打开/关闭文件」与「进入检测模式」两个边界被调用，避免搜索状态跨文档、跨模式残留。
- **选择器规范**：`SearchPanel` 中的 `cells` 使用模块级常量兜底（`s.notebook?.cells ?? EMPTY_CELLS`）。zustand v5 + React 19 下，选择器每次返回新引用会触发 `getSnapshot` 无限循环并卸载整棵 React 树。

---

## 5. React Hooks API

| Hook | 文件 | 说明 |
|---|---|---|
| `useTheme` | `hooks/useTheme.ts` | ThemeConfig → CSS 变量映射 |
| `useKeyboard` | `hooks/useKeyboard.ts` | 全局快捷键（在 AppShell 调用一次） |
| `useFileService` | `hooks/useFileService.ts` | 文件操作（**每次调用新建对象**，非单例） |
| `useCellService` | `hooks/useCellService.ts` | 单元格操作（**每次调用新建对象**，非单例） |
| `useTranslationService` | `hooks/useTranslationService.ts` | 翻译 / 写作批阅（模块级单例 + 200ms 轮询状态） |
| `useRecitationService` | `hooks/useRecitationService.ts` | 背诵服务（模块级单例） |
| `useBookmark` | `hooks/useBookmark.ts` | 单元格收藏到收藏夹文件 |
| `useTTSService` | `hooks/useTTSService.ts` | TTS 朗读（配置读自 ttsSettingStore） |
| `useSpeek` | `hooks/useSpeek.ts` | 单词逐字母拼读 |

> 注：`useFileService` / `useCellService` 内部直接读取 Zustand store（`useNotebookStore()` 全量订阅）并每次返回新的服务对象，因此无需单例即可保证状态一致；而 `useTranslationService` / `useRecitationService` 因持有轮询定时器与 Provider 实例，采用模块级单例。

### 5.1 useKeyboard — 已注册快捷键（**v2.2 勘误后的全量表**）

| 快捷键 | 动作 | 实现 |
|---|---|---|
| `Ctrl+N` | 在选中单元格下方插入 | `cellService.insertBelow()` |
| `Ctrl+Shift+A` | 在选中单元格上方插入 | `cellService.insertAbove()` |
| `Delete` | 删除选中单元格 | `cellService.deleteSelected()` |
| `Ctrl+D` | 复制当前单元格 | `cellService.copyCell(first)` |
| `Ctrl+M` | 合并选中单元格（需 ≥2 个） | `cellService.mergeSelected()` |
| `Ctrl+F` | 切换从属关系 | `cellService.toggleDependency(first)` |
| `Ctrl+E` | 折叠/展开 | `cellService.toggleCollapse(first)` |
| `Ctrl+Q` | 折叠当前单元格原文区 | `cellService.toggleInputCollapse(first)` |
| `Ctrl+Shift+Q` | 全部折叠原文 | `cellService.toggleInputCollapseAll()` |
| `Ctrl+W` | 折叠当前单元格译文区 | `cellService.toggleOutputCollapse(first)` |
| `Ctrl+Shift+W` | 全部折叠译文 | `cellService.toggleOutputCollapseAll()` |
| `Ctrl+Enter` | 翻译选中单元格 | `translateCell(first)` |
| `Ctrl+Shift+Enter` | 翻译全部 | `translateAll()` |
| `Ctrl+S` | 保存文件 | `fileService.saveFile()` |
| `Ctrl+Shift+S` | 另存为 | `fileService.saveFileAs()` |
| `Ctrl+O` | 打开文件 | `fileService.openFile()` |
| `Ctrl+Shift+I` | 导入文本 | `fileService.importText()` |
| `↑` / `↓` | 上/下一个单元格 | `notebookStore.selectCell()` |
| `Shift+↑` / `Shift+↓` | 向上/下范围选择 | `notebookStore.selectCellRange()` |
| `Ctrl+B` | 切换侧边栏 | `workspaceStore.toggleSidebar()` |
| `Ctrl+J` | 切换底部面板 | `workspaceStore.togglePanel()` |

**跳过规则**：当焦点位于 TipTap 编辑器（`.tiptap`）、`INPUT` 或 `TEXTAREA` 内时全部跳过；**v2.2 新增**：检测模式（`recitationStore.active === true`）下全部跳过——此时阅读态已卸载，`Delete` / 方向键等不应再作用到阅读数据上（`QuizPanel` 自身另有 `←/↑/→/↓/Enter/Space` 语义）。

> **v2.1 文档勘误**：v2.1 文档（及 doc/API.md 第 5.2 节）将 `Ctrl+S` / `Ctrl+Shift+S` / `Ctrl+O` / `Ctrl+Shift+E` / `Ctrl+Enter` / `Ctrl+B` 列为「待添加」，实际除 `Ctrl+Shift+E`（切换编辑/阅读模式）外**均已实现**，并额外实现了 `Ctrl+Shift+Enter` / `Ctrl+Shift+I` / `Ctrl+J`。

### 5.2 useTranslationService — [useTranslationService.ts](../../../src/hooks/useTranslationService.ts)

```typescript
function useTranslationService(): {
  status: OperationStatus                       // 200ms 轮询 + 字段级比较
  translateCell(index: number): Promise<void>
  translateAll(): Promise<void>
  testConnection(providerId: string): Promise<{ success: boolean; error?: string }>
  cancel(): void
  listProviders(): ProviderInfo[]
  setCurrentProvider(providerId: string): void
  generateSceneText(words: string[], promptTemplate?: string): Promise<string>
  reviewCell(index: number, promptTemplate?: string): Promise<void>   // AI 写作批阅
}
```

> **勘误**：v2.1 文档漏记 `reviewCell`；`status` 类型应为 `OperationStatus`（见 [types.md](./types.md)）。

### 5.3 useTTSService — [useTTSService.ts](../../../src/hooks/useTTSService.ts)

```typescript
function useTTSService(): {
  speak(text: string, options?: SpeakOptions): Promise<void>
  stop(): void
  pause(): void
  resume(): void
  speaking: boolean
  supportsPause: boolean
  currentProvider: TTSProviderInfo | null
  providers: TTSProviderInfo[]
  setProvider(providerId: string): void
  voices: TTSVoice[]
  voiceId: string
  setVoice(voiceId: string): void
  rate: number;  setRate(rate: number): void
  volume: number; setVolume(volume: number): void
  autoRead: TTSAutoReadSettings                            // v2.2 新增
  setAutoRead(settings: Partial<TTSAutoReadSettings>): void // v2.2 新增
}
```

模块顶层 `const ttsService = getTTSService()`，与 `useSpeek` 共用同一实例。

`autoRead` 为响应式订阅（`useTTSSettingStore((s) => s.tts.autoRead)`）；`QuizPanel` 另用 `useRef` 持有其快照，仅在触发时机读取，避免把 `autoRead` 加入 `useEffect` 依赖导致副作用重跑（见 [tts.md §13.5](./tts.md#135-答题自动朗读开关autoread--v22-新增)）。

### 5.4 useSpeek — [useSpeek.ts](../../../src/hooks/useSpeek.ts)

```typescript
function useSpeek(): {
  speek(word: string, options?: { speed?: 'normal' | 'slow'; intervalMs?: number; readWordFirst?: boolean }): Promise<void>
  stopSpeek(): void
  speeking: boolean
}
```

实现：先整词朗读（`readWordFirst` 默认 `true`），再逐字母朗读，字母间隔 `slow=800ms / normal=400ms`，通过 `AbortController` 可中断。

---

## 11. 服务层 API

### 11.1 类型导出 — [services/index.ts](../../../src/services/index.ts)

```typescript
export type { FileService, CellService, TranslationService, OperationStatus, ProviderInfo, RecitationService } from './types'
export type { TTSService } from './ttsService'
export { getTTSService } from './ttsService'
```

### 11.2 FileService — [services/types.ts](../../../src/services/types.ts)

```typescript
export interface ImportTextOptions { text: string; filename: string; splitMode: SplitMode }

export interface FileService {
  openFile(filePath?: string): Promise<void>
  saveFile(): Promise<boolean>
  saveFileAs(): Promise<boolean>
  importText(): Promise<void>
  saveImportAsTransnb(options: ImportTextOptions): Promise<void>   // v1.4+
  createFile(name?: string): Promise<void>
  deleteFile(filePath: string): Promise<void>
  renameFile(oldPath: string, newName: string): Promise<void>
}
```

> **勘误**：v2.1 文档漏记 `saveImportAsTransnb(options)`。

### 11.3 CellService

与 v2.1 一致（`insertBelow` / `insertAbove` / `deleteSelected` / `copyCell` / `splitCell` / `mergeSelected` / `moveCell` / `toggleCollapse` / `toggleInputCollapse` / `toggleOutputCollapse` / `toggleInputCollapseAll` / `toggleOutputCollapseAll` / `toggleDependency` / `setDependent` / `removeDependency` / `updateContent` / `updateOutput`）。

### 11.4 TranslationService — [services/translationService.ts](../../../src/services/translationService.ts)

```typescript
export interface TranslationService {
  listProviders(): ProviderInfo[]
  setCurrentProvider(providerId: string): void
  translateCell(index: number): Promise<void>
  translateAll(): Promise<void>
  translateCells(indices: number[]): Promise<void>
  testConnection(providerId: string): Promise<{ success: boolean; error?: string }>
  getStatus(): OperationStatus                    // v2.1 文档写作 TranslationStatus
  cancel(): void
  generateSceneText(words: string[], promptTemplate?: string): Promise<string>
  reviewCell(index: number, promptTemplate?: string): Promise<void>   // AI 写作批阅
}

export interface TranslationServiceDeps {
  getSettingState: () => { translation: TranslationSettings; promptTemplates: PromptTemplates; customModels: CustomModel[] }
  getNotebook: () => NotebookFile | null
  updateCellOutput: (index: number, output: string) => void
  setModified: (v: boolean) => void
  onTranslateComplete?: () => Promise<void>       // v2.1 新增：翻译完成后回调
}
```

行为要点：
- 翻译与批阅均使用 `deps.getSettingState().promptTemplates.analysis` / `.review` 作为模板，默认模板内置兜底。
- `doTranslateCells()` 完成后调用 `await deps.onTranslateComplete?.()`；**服务本身不写文件**，保存在 [useTranslationService.ts](../../../src/hooks/useTranslationService.ts) 的 `getService()` 提供（`serializeNotebookFile(cells, wordMeta)` → `writeFile` → `setModified(false)`）。
- `reviewCell` 设置 `operationType: 'review'`，供底部 Panel 区分展示。

### 11.5 RecitationService — [services/recitationService.ts](../../../src/services/recitationService.ts)

```typescript
export interface RecitationService {
  init(workspacePath: string): Promise<boolean>
  getBooks(): Promise<Book[]>
  getBookById(bookId: number): Promise<Book | null>
  importBook(filePath: string): Promise<Book | null>
  deleteBook(bookId: number): Promise<boolean>
  getBookProgress(bookId: number): Promise<BookProgress>
  getAllBooksWithProgress(): Promise<BookWithProgress[]>
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
  markWordsAsTested(bookId, testedNewIds, testedReviewIds, quizResults?): Promise<boolean>

  // === v1.4 新增 ===
  createBook(name: string, description?: string): Promise<Book | null>
  renameBook(bookId: number, newName: string): Promise<boolean>
  exportBook(bookId: number): Promise<boolean>
  searchBooks(keyword: string): Promise<Book[]>
  batchDeleteWords(bookId: number, wordIds: number[]): Promise<BatchOperationResult>
  batchImportWords(bookId: number): Promise<BatchOperationResult>   // 仍为 stub

  // === 远程导入 ===
  fetchRemoteBooks(source): Promise<{ success: boolean; books: RemoteBookFile[]; error?: string }>
  importRemoteBook(downloadUrl: string, bookName: string): Promise<{ success: boolean; book?: Book | null; error?: string }>
}
```

> **类型与实现不一致**：`services/types.ts` 的 `RecitationService` 接口**未声明**以下方法，但 `createRecitationService()` 实际返回并已被 UI 调用：
> `getStageDistribution(bookId)`（[BookManagerPanel.tsx](../../../src/components/recitation/BookManagerPanel.tsx#L106) / [StatsPanel.tsx](../../../src/components/recitation/StatsPanel.tsx#L140)）、
> `getOverallStageDistribution()`、`getWordsByStage(bookId, minStage, maxStage)`（[WordManagerDialog.tsx](../../../src/components/recitation/WordManagerDialog.tsx#L75)）、
> `addWord` / `updateWord` / `deleteWord`（[WordEditorDialog.tsx](../../../src/components/recitation/WordEditorDialog.tsx#L41)、[ReviewPanel.tsx](../../../src/components/recitation/ReviewPanel.tsx#L215)）。
> 相关 `RecitationAPI`（electron 桥接）类型已在 [src/types/notebook.ts](../../../src/types/notebook.ts) 中声明，服务层接口定义待补齐。

> **勘误**：v2.1 文档未收录 `createBook` / `searchBooks` / `addWord` / `updateWord` / `deleteWord` / `getStageDistribution` / `getOverallStageDistribution` / `getWordsByStage` 等方法（`RecitationService` 实际方法数多于文档所列）。
> `searchBooks()` 为**渲染侧过滤**（先 `getAllBooks()` 再按 `name.toLowerCase().includes()` 过滤），非数据库查询。
> `exportBook(bookId)` 内部调用 IPC `recitation:export-book-to-dialog`，返回 `path !== null`。

### 11.6 LogService — [services/logService.ts](../../../src/services/logService.ts)

```typescript
export function createLogService(getWorkspacePath: () => string | null): LogService

export interface LogService {
  exists(filePath: string): Promise<boolean>
  getLogPath(date?: Date): string          // {workspace}/.TransRead/log/yyyy-MM-dd.log，无工作区返回 ''
  hasDateLog(date: Date): Promise<boolean>
  appendToFile(filePath: string, content: string): Promise<void>
  createFile(filePath: string): Promise<void>
  cleanupOldLogs(retentionDays?: number): Promise<void>   // 默认 30 天
}
```
