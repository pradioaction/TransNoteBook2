# TSBook2 API — 状态管理、Hooks 与服务层

## 4. 状态管理 API (store/)

### 4.1 useNotebookStore (notebookStore.ts)

基于 Zustand 的笔记本状态 hook，管理打开的笔记本文件、单元格选择和内容更新。

```typescript
import { useNotebookStore } from '@/store/notebookStore'

function Example() {
  const notebook = useNotebookStore((s) => s.notebook)
  const selectCell = useNotebookStore((s) => s.selectCell)
  const selectedIndices = useNotebookStore((s) => s.selectedIndices)

  // 选择单元格
  selectCell(0)

  // 使用 CellService 插入/删除单元格
  const { insertBelow, deleteSelected } = useCellService()
  insertBelow()
  deleteSelected()
}
```

完整接口定义参见 `@/types/notebook.ts` 中的 `NotebookStore`。

### 4.2 useWorkspaceStore (workspaceStore.ts)

管理工作区路径、文件列表和侧边栏/面板可见性。

```typescript
import { useWorkspaceStore } from '@/store/workspaceStore'

// 设置工作区
const setWorkspace = useWorkspaceStore((s) => s.setWorkspace)
setWorkspace('/path/to/workspace')
```

### 4.3 useThemeStore (themeStore.ts)

管理亮色/暗色主题切换。

```typescript
import { useThemeStore } from '@/store/themeStore'

function ThemeToggle() {
  const { theme, setTheme, colors } = useThemeStore()
  setTheme('light')   // 切换为亮色
  setTheme('dark')    // 切换为暗色
}
```

### 4.4 useSettingStore (settingStore.ts)

管理应用设置，支持磁盘持久化（500ms 防抖自动保存）。

```typescript
import { useSettingStore } from '@/store/settingStore'

const { translation, cellWidthRatio, promptTemplates } = useSettingStore()
```

默认值：

```typescript
// translation
{
  enabled: false,
  currentProvider: 'system_Ollama',
  ollama: { baseUrl: 'http://localhost:11434', model: 'qwen2.5:0.5b' },
  openai: {
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    timeout: 60,
    proxy: '',
  },
}

// promptTemplates
{
  translation: '请翻译{input}',
  analysis: '请解析{input}',
  scenery: '请完成一篇包含{input}的文章',
}

// cellWidthRatio: 70
// readingFontSize: 14
```

### 4.5 useOutputStore (outputStore.ts)

```typescript
interface LogEntry {
  id: string
  timestamp: string
  message: string
  level: 'info' | 'warn' | 'error'
  color?: string      // v1.4: 自定义颜色，优先级高于 level 默认色
}

interface OutputStore {
  logs: LogEntry[]
  addLog: (message: string, level?: 'info' | 'warn' | 'error', color?: string) => void
  clearLogs: () => void
}
```

颜色约定: `#4caf50` 成功(绿), `#d4a017` 警告(琥珀), `#e06c75` 错误(红).

### 4.7 useWorkspaceConfigStore (workspaceConfigStore.ts, v1.4 新增)

工作区级配置 Store，存储 notebook 模块的配置，数据位于 `{workspace}/.TransRead/workspace-config.json`。
独立于背诵模块的 `studywordmode.json`。

```typescript
interface WorkspaceConfigStore {
  bookmarkFilePath: string | null  // 收藏夹目标 .transnb 文件路径
  loaded: boolean                  // 是否已从磁盘加载
  load(): Promise<void>
  setBookmarkFilePath(path: string | null): Promise<void>
}
```

### 4.6 useRecitationStore (recitationStore.ts)

背诵模式状态管理，包含 v1.3 完整字段。

```typescript
interface RecitationStore {
  // === 模式状态 ===
  active: boolean
  phase: 'book-manager' | 'quiz' | 'review'

  // === 当前选中词书 ===
  selectedBookId: number | null
  selectedBookName: string | null

  // === 右侧侧边栏数据 ===
  sidebarData: WordSidebarData | null
  sidebarMode: WordSidebarMode

  // === 检测状态 ===
  quizState: QuizState | null
  floatingAnimationEnabled: boolean
  articleQuizSource: boolean

  // === 单词选择 ===
  toggleWordSelection: (wordId: number, isNewWord: boolean) => void
  selectWordRange: (fromIndex: number, toIndex: number, isNewWord: boolean, batchStage?: number) => void
  selectAllWords: (type: 'new' | 'review') => void
  deselectAllWords: (type: 'new' | 'review') => void
  invertWordSelection: (type: 'new' | 'review') => void

  // === 批量同步追踪 ===
  pendingSyncResults: Record<number, boolean>  // wordId -> isCorrect
  markWordsAsSynced: (wordIds: number[]) => void
  getPendingSyncCount: () => number

  // === 检测结果（按词书分组） ===
  quizResultsByBook: Record<number, Record<number, boolean>>  // bookId -> { wordId -> isCorrect }
  setQuizResults: (bookId: number, results: Record<number, boolean>) => void

  // === 检测操作 ===
  startQuiz: (questions: QuizQuestion[]) => void
  answerQuestion: (questionIndex: number, selectedOptionId: string) => void
  nextQuestion: () => void
  prevQuestion: () => void
  toggleFloatingAnimation: () => void
  completeQuiz: () => void

  // === 操作 ===
  activate: () => void
  deactivate: () => void
  setPhase: (phase: 'book-manager' | 'quiz' | 'review') => void
  selectBook: (bookId: number, bookName: string) => void
  setSidebarData: (data: WordSidebarData) => void
  setSidebarMode: (mode: WordSidebarMode) => void

  // === 重置 ===
  reset: () => void
}
```

## 5. React Hooks API (hooks/)

### 5.1 useTheme

返回当前主题、颜色配置、主题切换函数和 CSS 变量。

```typescript
function useTheme(): {
  theme: 'light' | 'dark'
  colors: ThemeConfig
  setTheme: (theme: 'light' | 'dark') => void
  cssVars: React.CSSProperties
}
```

CSS 变量映射表：

| CSS 变量                            | 来源                          |
|-------------------------------------|-------------------------------|
| `--foreground`                      | `colors.foreground`           |
| `--background`                      | `colors.background`           |
| `--editor-background`               | `colors.editorBackground`     |
| `--editor-foreground`               | `colors.editorForeground`     |
| `--border`                          | `colors.border`               |
| `--sidebar-background`              | `colors.sidebarBackground`    |
| `--sidebar-header`                  | `colors.sidebarHeader`        |
| `--sidebar-border`                  | `colors.sidebarBorder`        |
| `--activity-bar-background`         | `colors.activityBarBackground`|
| `--status-bar-background`           | `colors.statusBarBackground`  |
| `--status-bar-foreground`           | `colors.statusBarForeground`  |
| `--cell-background`                 | `colors.cellBackground`       |
| `--cell-selected-background`        | `colors.cellSelectedBackground`|
| `--cell-border`                     | `colors.cellBorder`           |
| `--cell-output-background`          | `colors.cellOutputBackground` |
| `--cell-output-border`              | `colors.cellOutputBorder`     |
| `--cell-gutter`                     | `colors.cellGutter`           |
| `--toolbar-background`              | `colors.toolbarBackground`    |
| `--toolbar-hover`                   | `colors.toolbarHover`         |
| `--primary-button`                  | `colors.primaryButton`        |
| `--primary-button-hover`            | `colors.primaryButtonHover`   |
| `--scrollbar`                       | `colors.scrollbar`            |
| `--panel-background`                | `colors.panelBackground`      |
| `--panel-border`                    | `colors.panelBorder`          |

使用示例：

```typescript
import { useTheme } from '@/hooks/useTheme'

function MyComponent() {
  const { theme, setTheme, cssVars } = useTheme()
  return <div style={cssVars}>...</div>
}
```

### 5.2 useKeyboard

全局键盘快捷键 hook。

```typescript
function useKeyboard(): { shortcuts: KeyboardShortcut[] }
```

快捷键表：

| 快捷键             | 操作                       |
|--------------------|----------------------------|
| `Ctrl+N`           | 插入下方单元格             |
| `Ctrl+Shift+A`     | 插入上方单元格             |
| `Delete`           | 删除选中单元格             |
| `Ctrl+D`           | 复制单元格                 |
| `Ctrl+M`           | 合并选中单元格             |
| `Ctrl+F`           | 切换单元格依赖             |
| `Ctrl+E`           | 切换单元格折叠             |
| `Ctrl+Q`           | 切换输入区折叠             |
| `Ctrl+Shift+Q`     | 切换全部输入区折叠         |
| `Ctrl+W`           | 切换输出区折叠             |
| `Ctrl+Shift+W`     | 切换全部输出区折叠         |
| `Ctrl+Enter`       | 翻译选中单元格             |
| `Ctrl+Shift+Enter` | 翻译所有单元格             |
| `Ctrl+S`           | 保存文件                   |
| `Ctrl+Shift+S`     | 另存为                     |
| `Ctrl+O`           | 打开文件                   |
| `Ctrl+Shift+I`     | 导入文本                   |
| `Up`               | 移动到上一个单元格         |
| `Down`             | 移动到下一个单元格         |
| `Shift+Up`         | 向上扩展选择               |
| `Shift+Down`       | 向下扩展选择               |
| `Ctrl+B`           | 切换侧边栏                 |
| `Ctrl+J`           | 切换底部面板               |

**注意**：当焦点位于 TipTap 编辑器、`<input>` 或 `<textarea>` 元素内时，快捷键自动跳过，以避免与编辑器内快捷键冲突。

### 5.4 useBookmark (v1.4 新增)

单元格收藏 Hook。

```typescript
function useBookmark(): {
  addCurrentCellToBookmark(): Promise<void>
}
```

`addCurrentCellToBookmark()` 流程：
1. 检查 `bookmarkFilePath` 是否已设置 → 未设置则输出琥珀色警告
2. 读取目标 `.transnb` 文件 → 解析 → 追加新 Cell（仅 content + output，丢弃层级）→ 写回磁盘
3. 若目标文件当前已打开 → 仅更新 `openFiles` 中对应条目，不触动当前活动文件
4. 输出面板绿色反馈

### 5.5 useRecitationService

背诵服务 hook，封装 `RecitationService` 单例。

```typescript
// 返回完整的 RecitationService 接口
function useRecitationService(): RecitationService
```

使用示例：

```typescript
import { useRecitationService } from '@/hooks/useRecitationService'

function RecitationApp() {
  const service = useRecitationService()

  useEffect(() => {
    async function load() {
      // 初始化
      await service.init('/path/to/workspace')

      // 获取所有词书及进度
      const books = await service.getAllBooksWithProgress()
      console.log(books)

      // 获取今日单词
      if (books.length > 0) {
        const todayWords = await service.getTodayWords(books[0].id)
        console.log(todayWords)
      }
    }
    load()
  }, [])
}
```

完整方法列表见第 11.5 节。

## 11. 服务层 API (services/)

### 11.1 类型导出

```typescript
import type {
  FileService,
  CellService,
  TranslationService,
  TranslationStatus,
  ProviderInfo,
  RecitationService,
} from '@/services/types'
```

### 11.2 FileService

文件操作服务，实现在 `hooks/useFileService.ts`。

```typescript
interface FileService {
  openFile(filePath?: string): Promise<void>
  saveFile(): Promise<boolean>
  saveFileAs(): Promise<boolean>
  importText(): Promise<void>
  saveImportAsTransnb(options: ImportTextOptions): Promise<void>
  createFile(name?: string): Promise<void>
  deleteFile(filePath: string): Promise<void>
  renameFile(oldPath: string, newName: string): Promise<void>
}
```

### 11.3 CellService

单元格操作服务，实现在 `hooks/useCellService.ts`。

```typescript
interface CellService {
  insertBelow(): void
  insertAbove(): void
  deleteSelected(): void
  copyCell(index: number): void
  splitCell(index: number, beforeText: string, afterText: string): void
  mergeSelected(): void
  moveCell(from: number, to: number): void
  toggleCollapse(index: number): void
  toggleInputCollapse(index: number): void
  toggleOutputCollapse(index: number): void
  toggleInputCollapseAll(): void
  toggleOutputCollapseAll(): void
  toggleDependency(index: number): void
  setDependent(childIndex: number, parentIndex: number): void
  removeDependency(index: number): void
  updateContent(index: number, content: string): void
  updateOutput(index: number, output: string): void
}
```

### 11.4 TranslationService

翻译服务，实现在 `services/translationService.ts`，通过 `useTranslationService` hook 使用。

```typescript
// 翻译状态
interface TranslationStatus {
  state: 'idle' | 'translating' | 'error'
  currentIndex: number
  totalCount: number
  progress: number
  error: string | null
  cellStates: Record<number, 'pending' | 'translating' | 'done' | 'error'>
  cellErrors: Record<number, string>
  currentContent?: string
}

// 提供者信息
interface ProviderInfo {
  id: string
  name: string
  type: 'system' | 'custom'
  backend: string
}

// 翻译服务接口
interface TranslationService {
  listProviders(): ProviderInfo[]
  setCurrentProvider(providerId: string): void
  translateCell(index: number): Promise<void>
  translateAll(): Promise<void>
  translateCells(indices: number[]): Promise<void>
  testConnection(providerId: string): Promise<{ success: boolean; error?: string }>
  getStatus(): TranslationStatus
  cancel(): void
  /** 预留接口：供背诵模块生成场景文章 */
  generateSceneText(words: string[], promptTemplate?: string): Promise<string>
}
```

### 11.5 RecitationService

背诵服务接口，实现在 `services/recitationService.ts`，包含 v1.3 新增方法。

```typescript
interface RecitationService {
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
  addWord(bookId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<Word | null>
  updateWord(wordId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<boolean>
  deleteWord(wordId: number): Promise<boolean>

  // === v1.3 新增 ===
  markWordsAsTested(bookId: number, testedNewIds: number[], testedReviewIds: number[]): Promise<boolean>
  getStageDistribution(bookId: number): Promise<StageDistribution>
  getOverallStageDistribution(): Promise<StageDistribution>
  getWordsByStage(bookId: number, minStage: number, maxStage: number): Promise<Word[]>
}
```
