# TSBook2 服务层与业务模块设计

> 本文档是 [REFACTOR_PLAN.md](REFACTOR_PLAN.md) 的子文档，详细定义服务层接口、AI 翻译模块和背诵模块的设计。

---

## 1. 服务层接口定义

### 1.1 useFileService — 文件操作服务

**职责**: 统一管理所有文件操作，消除 `NotebookToolbar` 和 `FileExplorer` 之间的代码重复。

```typescript
// src/services/fileService.ts
export interface FileService {
  /** 打开文件对话框 → 读取 → 解析 → 载入编辑器 */
  openFile(): Promise<void>

  /** 保存当前文件（新文件弹对话框，已有文件直接写） */
  saveFile(): Promise<boolean>

  /** 另存为对话框 → 写入 */
  saveFileAs(): Promise<boolean>

  /** 导入文本 → 分割段落 → 创建单元格 → 载入 */
  importText(): Promise<void>

  /** 在工作区中创建新 .transnb 文件 */
  createFile(): Promise<void>

  /** 删除指定文件 */
  deleteFile(filePath: string): Promise<void>

  /** 重命名指定文件 */
  renameFile(oldPath: string, newName: string): Promise<void>

  /** 获取 electronAPI（用于组件内判断环境） */
  getApi(): ElectronAPI | null
}
```

**内部实现逻辑** (消除重复的关键):

```
openFile() {
  filePath = dialog → electronAPI.readFile → parse → notebookStore.setNotebook()
  workspaceStore.addRecentFile()
}

saveFile() {
  if has path: electronAPI.writeFile(path, serialize)
  else: saveFileAs()
  notebookStore.setModified(false)
}

importText() {
  result = importDialog → splitParagraphs → createCells
  notebookStore.setNotebook({ name, cells, isModified: true })
}
```

**组件使用方式**:
```typescript
// NotebookToolbar.tsx
const fileService = useFileService()
<button onClick={fileService.openFile}>Open</button>
<button onClick={fileService.saveFile}>Save</button>

// FileExplorer.tsx
const fileService = useFileService()
<div onClick={() => fileService.openFile(entry.path)}>{entry.name}</div>
```

---

### 1.2 useCellService — 单元格业务服务

**职责**: 封装所有单元格编辑业务逻辑，隐藏 Zustand 操作细节。

```typescript
// src/services/cellService.ts
export interface CellService {
  /** 下方插入空单元格 */
  insertBelow(): void
  /** 上方插入空单元格 */
  insertAbove(): void
  /** 删除选中的所有单元格 */
  deleteSelected(): void
  /** 复制指定索引的单元格到其下方 */
  copyCell(index: number): void
  /** 在光标位置拆分单元格 */
  splitCell(index: number, beforeText: string, afterText: string): void
  /** 合并选中的多个单元格 */
  mergeSelected(): void
  /** 移动单元格 */
  moveCell(from: number, to: number): void

  /** 切换整体折叠（含子节点联动） */
  toggleCollapse(index: number): void
  /** 切换原文折叠 */
  toggleInputCollapse(index: number): void
  /** 切换译文折叠 */
  toggleOutputCollapse(index: number): void
  /** 全部折叠/展开原文 */
  toggleInputCollapseAll(): void
  /** 全部折叠/展开译文 */
  toggleOutputCollapseAll(): void

  /** 切换从属关系 */
  toggleDependency(index: number): void
  /** 设定从属 */
  setDependent(childIndex: number, parentIndex: number): void
  /** 移除从属 */
  removeDependency(index: number): void

  /** 更新单元格原文 */
  updateContent(index: number, content: string): void
  /** 更新单元格译文 */
  updateOutput(index: number, output: string): void
}
```

**内部实现**:
```typescript
// cellService 内部操作 notebookStore
toggleCollapse(index) {
  const cells = [...useNotebookStore.getState().notebook.cells]
  cells[index].isCollapsed = !cells[index].isCollapsed
  // 联动子节点
  const parentId = cells[index].id
  for (let i = 0; i < cells.length; i++) {
    if (i !== index && cells[i].parentId === parentId) {
      cells[i].isCollapsed = !cells[i].isCollapsed
    }
  }
  useNotebookStore.getState().setCells(cells)
}
```

---

### 1.3 useTranslationService — AI 翻译服务

**职责**: 管理翻译提供者、执行翻译、管理翻译进度。

```typescript
// src/services/translationService.ts
export interface TranslationService {
  /** 获取当前提供者列表 */
  listProviders(): ProviderInfo[]

  /** 设置当前翻译提供者 */
  setCurrentProvider(providerId: string): void

  /** 翻译单个单元格（更新 output） */
  translateCell(index: number): Promise<void>

  /** 翻译所有未翻译单元格 */
  translateAll(): Promise<void>

  /** 批量翻译指定单元格 */
  translateCells(indices: number[]): Promise<void>

  /** 测试连接 */
  testConnection(providerId: string): Promise<boolean>

  /** 获取翻译状态 */
  getStatus(): TranslationStatus

  /** 取消当前翻译 */
  cancel(): void
}

interface TranslationStatus {
  state: 'idle' | 'translating' | 'error'
  currentIndex: number
  totalCount: number
  progress: number           // 0-100
  error: string | null
}

interface ProviderInfo {
  id: string
  name: string
  type: 'system' | 'custom'
  backend: 'ollama' | 'openai' | 'ark'
}
```

**翻译流程**:
```
translateCell(index) {
  status.state = 'translating'
  try {
    text = notebookStore.notebook.cells[index].content
    template = settingStore.promptTemplates.analysis
    // 获取当前提供者 → translate(text, template)
    result = await currentProvider.translate(text, template)
    notebookStore.updateCellOutput(index, result)
    status.progress = 100
  } catch (e) {
    status.error = e.message
  } finally {
    status.state = 'idle'
  }
}
```

---

## 2. AI 翻译提供者设计

### 2.1 提供者抽象接口

```typescript
// src/translation/types.ts
export interface TranslationProvider {
  readonly id: string
  readonly name: string
  readonly type: 'system' | 'custom'
  readonly backend: string

  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

### 2.2 OllamaProvider

```typescript
// src/translation/providers/ollama.ts
export class OllamaProvider implements TranslationProvider {
  id = 'system_Ollama'
  name = 'Ollama (Local)'
  type = 'system' as const
  backend = 'ollama'

  private config: { baseUrl: string; model: string; timeout: number }

  constructor(config?: Partial<OllamaConfig>)
  
  async translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  // POST {baseUrl}/api/generate
  // body: { model, prompt: promptTemplate.replace('{input}', text), stream: false }
  
  async testConnection(): Promise<boolean>
  // GET {baseUrl}/api/tags

  getInfo(): ProviderInfo
}
```

### 2.3 OpenAIProvider

```typescript
// src/translation/providers/openai.ts
export class OpenAIProvider implements TranslationProvider {
  id = 'system_OpenAI'
  name = 'OpenAI Compatible'
  type = 'system' as const
  backend = 'openai'

  private config: {
    baseUrl: string; model: string; apiKeyEnv: string
    timeout: number; proxy: string
  }

  constructor(config?: Partial<OpenAIConfig>)

  private resolveApiKey(): string
  // 从 process.env 或 window.__ENV__ 读取 apiKeyEnv 指定的变量

  async translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  // POST {baseUrl}/chat/completions
  // headers: { Authorization: Bearer {apiKey} }
  // body: { model, messages: [{role: 'user', content: ...}], stream: false }

  async testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

### 2.4 ArkProvider

```typescript
// src/translation/providers/ark.ts
export class ArkProvider implements TranslationProvider {
  id = 'custom_{name}'
  name = '自定义: {name}'
  type = 'custom' as const
  backend = 'ark'

  async translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  // POST {endpoint}/chat/completions (VolcEngine Ark 兼容 API)
  // 与 OpenAI 格式兼容，但 apiKey 解析优先使用 ARK_API_KEY

  async testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

### 2.5 提供者工厂

```typescript
// src/translation/providerFactory.ts
export function buildProvider(modelConfig: CustomModel): TranslationProvider
// backend === 'ark' → new ArkProvider(config)
// else → new OllamaProvider({ baseUrl: endpoint, model, timeout })

export function createSystemProviders(): TranslationProvider[]
// 创建 system_Ollama + system_OpenAI

export function createCustomProviders(customModels: CustomModel[]): TranslationProvider[]
// 遍历 customModels，按 backend 分支创建
```

---

## 3. 背诵模式模块 (Recitation)

### 3.1 数据模型

```typescript
// src/recitation/models.ts
export interface Book {
  id?: number
  name: string
  path: string
  count: number
  createTime?: Date
}

export interface Word {
  id?: number
  bookId: number
  word: string
  phonetic: string
  definition: string
  example: string
  rawData: string
}

export interface UserStudy {
  id?: number
  bookId: number
  wordId: number
  stage: number          // 0-8 艾宾浩斯阶段
  weight: number         // 复习权重
  lastReview?: Date
  nextReview?: Date
}

export interface BookProgress {
  total: number
  studied: number
  reviewDue: number
  progress: number       // 百分比
}
```

### 3.2 IndexedDB 数据库封装

```typescript
// src/recitation/database.ts
export class RecitationDatabase {
  private dbName = 'TSBook2_Recitation'
  private version = 1

  async initialize(): Promise<void>
  // CREATE objectStores: books (id), words (id, bookId), userStudies (id, bookId)

  async getConnection(): Promise<IDBDatabase>

  // 通用的 CRUD 帮助方法
  async add<T>(storeName: string, item: T): Promise<number>
  async get<T>(storeName: string, id: number): Promise<T | null>
  async getAll<T>(storeName: string): Promise<T[]>
  async update<T>(storeName: string, item: T): Promise<void>
  async delete(storeName: string, id: number): Promise<void>
}
```

### 3.3 BookService

```typescript
// src/recitation/bookService.ts
export class BookService {
  constructor(private db: RecitationDatabase)

  /** 从 JSON 文件导入词书 */
  async importBook(filePath: string): Promise<Book>

  /** 获取所有词书（带进度） */
  async getAllBooks(): Promise<Book[]>

  /** 获取词书进度 */
  async getBookProgress(bookId: number): Promise<BookProgress>

  /** 删除词书 */
  async deleteBook(bookId: number): Promise<void>

  /** 导出词书为 JSON */
  async exportBook(bookId: number): Promise<void>
}
```

### 3.4 StudyService

```typescript
// src/recitation/studyService.ts
export class StudyService {
  constructor(private db: RecitationDatabase)

  /** 获取今日学习单词 (new + review) */
  async getTodayWords(bookId: number): Promise<{ newWords: Word[]; reviewWords: Word[] }>

  /** 开始学习一个单词 */
  async startStudy(bookId: number, wordId: number): Promise<UserStudy>

  /** 复习一个单词（正确/错误） */
  async reviewWord(bookId: number, wordId: number, isCorrect: boolean): Promise<UserStudy>

  /** 批量开始学习 */
  async startBatch(bookId: number, wordIds: number[]): Promise<UserStudy[]>

  /** 批量复习 */
  async reviewBatch(bookId: number, results: Array<{ wordId: number; isCorrect: boolean }>): Promise<UserStudy[]>
}
```

### 3.5 艾宾浩斯算法

```typescript
// src/recitation/ebbinghaus.ts
export class EbbinghausAlgorithm {
  // 8 个复习阶段的时间间隔
  static STAGES = [
    5 * 60 * 1000,           // 阶段 0: 5 分钟
    30 * 60 * 1000,          // 阶段 1: 30 分钟
    12 * 60 * 60 * 1000,     // 阶段 2: 12 小时
    24 * 60 * 60 * 1000,     // 阶段 3: 1 天
    2 * 24 * 60 * 60 * 1000, // 阶段 4: 2 天
    4 * 24 * 60 * 60 * 1000, // 阶段 5: 4 天
    7 * 24 * 60 * 60 * 1000, // 阶段 6: 7 天
    15 * 24 * 60 * 60 * 1000, // 阶段 7: 15 天
    30 * 24 * 60 * 60 * 1000, // 阶段 8: 30 天
  ]

  /** 初始学习状态 (stage=0, next=5min) */
  static getInitialState(): { stage: number; weight: number; nextReview: Date }

  /** 复习结果计算 */
  static calculateReview(
    currentStage: number,
    currentWeight: number,
    isCorrect: boolean
  ): { newStage: number; newWeight: number; nextReview: Date }

  /** 权重更新（指数衰减） */
  static updateWeight(stage: number, nextReview: Date): number
}
```

### 3.6 文章生成器

```typescript
// src/recitation/articleGenerator.ts
export class ArticleGenerator {
  /** AI 生成包含今日单词的场景文章 → 保存为 .transnb 并打开 */
  static async generateAndOpen(
    bookId: number,
    studyService: StudyService,
    translationService: TranslationService,
    fileService: FileService
  ): Promise<void>
}
```

---

## 4. 服务层 Hook 实现示例

### 4.1 useCellService

```typescript
// src/hooks/useCellService.ts
import { useNotebookStore } from '@/store/notebookStore'
import type { CellService } from '@/services/cellService'

export function useCellService(): CellService {
  const store = useNotebookStore()

  return {
    insertBelow: () => {
      const indices = [...store.selectedIndices]
      const index = indices.length > 0 ? Math.max(...indices) : 0
      const cells = [...store.notebook.cells]
      cells.splice(index + 1, 0, createEmptyCell())
      store.setCells(cells)
      store.selectCell(index + 1)
    },

    toggleCollapse: (index) => {
      const cells = [...store.notebook.cells]
      if (!cells[index]) return
      const newVal = !cells[index].isCollapsed
      cells[index] = { ...cells[index], isCollapsed: newVal }
      // 联动子节点
      const pid = cells[index].id
      for (let i = 0; i < cells.length; i++) {
        if (i !== index && cells[i].parentId === pid) {
          cells[i] = { ...cells[i], isCollapsed: newVal }
        }
      }
      store.setCells(cells)
    },

    // ... 其他方法类似
  }
}
```

### 4.2 useFileService

```typescript
// src/hooks/useFileService.ts
import { useNotebookStore } from '@/store/notebookStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { parseNotebookFile, serializeNotebookFile } from '@/utils/fileUtils'
import type { FileService } from '@/services/fileService'

export function useFileService(): FileService {
  const notebookStore = useNotebookStore()
  const workspaceStore = useWorkspaceStore()
  const api = window.electronAPI

  const openFile = async () => {
    if (!api) return
    const filePath = await api.openFileDialog()
    if (!filePath) return
    const content = await api.readFile(filePath)
    const data = parseNotebookFile(content)
    const name = filePath.split(/[/\\]/).pop() || 'untitled.transnb'
    notebookStore.openFile({ path: filePath, name, isModified: false, cells: data.cells })
    workspaceStore.addRecentFile(filePath)
  }

  const saveFile = async () => {
    if (!api) return
    const nb = notebookStore.notebook
    if (nb.path) {
      await api.writeFile(nb.path, serializeNotebookFile(nb.cells))
      notebookStore.setModified(false)
      workspaceStore.refreshFiles()
    } else {
      await saveFileAs()
    }
  }

  const saveFileAs = async () => {
    if (!api) return false
    const p = await api.saveFileDialog()
    if (!p) return false
    await api.writeFile(p, serializeNotebookFile(notebookStore.notebook.cells))
    notebookStore.setFilePath(p)
    notebookStore.setModified(false)
    workspaceStore.addRecentFile(p)
    workspaceStore.refreshFiles()
    return true
  }

  // ... importText, createFile, deleteFile, renameFile

  return { openFile, saveFile, saveFileAs, importText, createFile, deleteFile, renameFile, getApi: () => api }
}
```

---

## 5. 设置 Store 优化

```typescript
// src/store/settingStore.ts 的修改方案

// 新增防抖保存
let saveTimer: ReturnType<typeof setTimeout> | null = null

const debouncedSave = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    get().saveToDisk()
    saveTimer = null
  }, 500)
}

// 各 set* 方法改为调用 debouncedSave 而非直接 saveToDisk()
setReadingFontSize: (size) => {
  set({ readingFontSize: size })
  debouncedSave()
}

// saveToDisk 本身保留（供 App 关闭时强制调用）
saveToDisk: async () => {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  // 原有保存逻辑...
}
```

---

## 6. 与原项目设计对比

| 模块 | TransNb (PyQt5) | TSBook2 重构后 |
|------|-----------------|---------------|
| 翻译提供者 | `BaseTranslationProvider` 抽象类 | `TranslationProvider` 接口 |
| 翻译时长 | `TranslationService.translate()` async | `Provider.translate()` + AbortSignal |
| 数据持久化 | SQLite (recitation) | IndexedDB |
| 艾宾浩斯 | 独立类 + datetime 计算 | 纯函数 + Date 计算 |
| 工作线程 | QThread 系列 Worker | AbortSignal + async/await |
| 信号通信 | Qt 信号/槽 | React Hook + Zustand subscribe |
| 文件格式 | .transnb v2.0 | .transnb v2.0（兼容） |

---

## 7. 目录结构变更

重构后将新增以下目录和文件：

```
src/
├── services/                  # 新增：服务层
│   ├── index.ts
│   ├── types.ts
│   ├── fileService.ts
│   ├── cellService.ts
│   ├── translationService.ts
│   └── recitationService.ts
├── translation/               # 新增：翻译模块
│   ├── types.ts
│   ├── providerFactory.ts
│   ├── promptTemplates.ts
│   └── providers/
│       ├── base.ts
│       ├── ollama.ts
│       ├── openai.ts
│       └── ark.ts
├── recitation/                # 新增：背诵模块
│   ├── models.ts
│   ├── database.ts
│   ├── bookService.ts
│   ├── studyService.ts
│   ├── ebbinghaus.ts
│   └── articleGenerator.ts
├── hooks/                     # 新增 Hook
│   ├── useFileService.ts
│   ├── useCellService.ts
│   ├── useTranslationService.ts
│   └── useRecitationService.ts
└── components/
    └── recitation/            # 新增：背诵 UI
        ├── RecitationMainPage.tsx
        ├── QuizPage.tsx
        └── RecitationSettingsPanel.tsx
```

**共新增 20 个文件**（不含对应的测试文件）。
