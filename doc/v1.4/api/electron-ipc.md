# TSBook2 API — Electron IPC 通信

## 1.1 主进程 IPC Handlers (electron/handlers/)

Electron 主进程注册的 IPC 处理器，渲染进程通过 `window.electronAPI` 调用。

### 文件操作 (fileHandlers.ts)

| 通道 (Channel) | 参数 | 返回值 | 说明 |
|---------------|------|--------|------|
| `read-file` | `filePath: string` | `Promise<string>` | 读取文件内容（UTF-8） |
| `write-file` | `filePath: string, content: string` | `Promise<boolean>` | 写入文件（自动创建目录） |
| `file-exists` | `filePath: string` | `Promise<boolean>` | 检查文件是否存在 |
| `delete-file` | `filePath: string` | `Promise<boolean>` | 删除文件 |
| `rename-file` | `oldPath: string, newPath: string` | `Promise<boolean>` | 重命名文件 |
| `append-file` | `filePath: string, content: string` | `Promise<boolean>` | 追加内容到文件尾部（v1.4 新增，用于日志写入） |
| `read-clipboard` | 无 | `Promise<string>` | 读取系统剪贴板内容 |

### 目录操作 (fileHandlers.ts)

| 通道 (Channel) | 参数 | 返回值 | 说明 |
|---------------|------|--------|------|
| `read-directory` | `dirPath: string` | `Promise<FileEntry[]>` | 读取目录，返回 .transnb 文件和目录（已排序） |
| `read-directory-recursive` | `dirPath: string` | `Promise<DirEntry[]>` | 递归遍历目录，返回所有 .transnb 文件 |

### 对话框操作 (dialogHandlers.ts)

| 通道 (Channel) | 参数 | 返回值 | 说明 |
|---------------|------|--------|------|
| `open-file-dialog` | 无 | `Promise<string \| null>` | 打开 .transnb 文件选择对话框 |
| `save-file-dialog` | 无 | `Promise<string \| null>` | 保存文件对话框，默认名 `untitled.transnb` |
| `open-folder-dialog` | 无 | `Promise<string \| null>` | 选择文件夹对话框 |
| `open-import-dialog` | 无 | `Promise<ImportResult \| null>` | 导入文本文件对话框（txt/md/html） |
| `open-book-dialog` | 无 | `Promise<string \| null>` | 导入词书 JSON 文件选择对话框（v1.4 新增） |

### 设置操作 (settingsHandlers.ts)

| 通道 (Channel) | 参数 | 返回值 | 说明 |
|---------------|------|--------|------|
| `get-settings` | 无 | `Promise<Record<string, unknown>>` | 读取 `userData/settings.json` |
| `set-settings` | `settings: Record<string, unknown>` | `Promise<boolean>` | 保存设置到 `userData/settings.json` |

### 工作区配置 (workspaceConfigHandlers.ts)

| 通道 (Channel) | 参数 | 返回值 | 说明 |
|---------------|------|--------|------|
| `workspace-config:get` | `workspacePath: string` | `Promise<Record<string, unknown>>` | 读取工作区配置 `{workspace}/.TransRead/workspace-config.json` |
| `workspace-config:set` | `workspacePath, key, value` | `Promise<boolean>` | 写入工作区配置项 |

### 背诵模式 (recitationHandlers.ts)

| 通道 (Channel) | 参数 | 返回值 | 说明 |
|---------------|------|--------|------|
| `recitation:init` | `workspacePath: string` | `Promise<{success: boolean, error?: string}>` | 初始化工作区数据库 |
| `recitation:add-book` | `book: Book` | `Promise<Book \| null>` | 添加词书 |
| `recitation:get-book-by-id` | `bookId: number` | `Promise<Book \| null>` | 查询单个词书 |
| `recitation:get-all-books` | — | `Promise<Book[]>` | 获取所有词书 |
| `recitation:delete-book` | `bookId: number` | `Promise<boolean>` | 删除词书 |
| `recitation:get-book-progress` | `bookId: number` | `Promise<BookProgress>` | 获取词书进度 |
| `recitation:get-all-books-with-progress` | — | `Promise<BookWithProgress[]>` | 获取所有词书及进度 |
| `recitation:import-book-from-file` | `filePath: string` | `Promise<Book \| null>` | 从 JSON 文件导入词书 |
| `recitation:get-words-by-book` | `bookId: number` | `Promise<Word[]>` | 获取词书所有单词 |
| `recitation:get-unstudied-words` | `bookId, limit?` | `Promise<Word[]>` | 获取未学单词 |
| `recitation:get-words-for-review` | `bookId, limit?` | `Promise<Word[]>` | 获取待复习单词 |
| `recitation:search-words` | `searchText, bookId?` | `Promise<Word[]>` | 搜索单词 |
| `recitation:start-study-word` | `bookId, wordId` | `Promise<UserStudy \| null>` | 开始学习单词 |
| `recitation:review-word` | `bookId, wordId, isCorrect` | `Promise<UserStudy \| null>` | 复习单词 |
| `recitation:get-config` | — | `Promise<Record<string, unknown>>` | 获取完整配置 |
| `recitation:set-config` | `key, value` | `Promise<boolean>` | 设置配置项 |
| `recitation:get-today-words` | `bookId, forceRefresh?` | `Promise<TodayWordsResult>` | 获取今日单词 |
| `recitation:refresh-today-words` | `bookId` | `Promise<TodayWordsResult>` | 强制刷新今日单词 |
| `recitation:mark-words-as-tested` | `bookId, testedNewIds, testedReviewIds, quizResults?` | `Promise<boolean>` | 标记今日已测单词（v1.4 新增可选 `quizResults` 参数） |
| `recitation:add-word` | `bookId, word` | `Promise<Word \| null>` | 添加单词 |
| `recitation:update-word` | `wordId, word` | `Promise<boolean>` | 更新单词 |
| `recitation:delete-word` | `wordId` | `Promise<boolean>` | 删除单词 |
| `recitation:get-stage-distribution` | `bookId: number` | `Promise<StageDistribution>` | 获取词书阶段分布 |
| `recitation:get-overall-stage-distribution` | — | `Promise<StageDistribution>` | 获取全部词书阶段分布 |
| `recitation:get-words-by-stage` | `bookId, minStage, maxStage` | `Promise<Word[]>` | 按阶段范围查询单词 |
| `recitation:rename-book` | `bookId: number, newName: string` | `Promise<boolean>` | 重命名词书（v1.4 新增） |
| `recitation:export-book` | `bookId: number, exportPath: string` | `Promise<boolean>` | 导出词书为 JSON 文件到指定路径（v1.4 新增） |
| `recitation:export-book-to-dialog` | `bookId: number` | `Promise<string \| null>` | 弹出保存对话框选择路径后导出词书（v1.4 新增） |
| `recitation:batch-delete-words` | `bookId: number, wordIds: number[]` | `Promise<{success: number, failed: number, errors?: string[]}>` | 批量删除单词（v1.4 新增） |

> **注意**: `recitation:init` 在 v1.4 改为返回 `{success, error}` 对象而非简单 boolean，以提供更详细的错误信息。

## 1.2 预加载桥接 (electron/preload.ts)

通过 `contextBridge.exposeInMainWorld` 暴露的类型安全 API：

```typescript
interface Window {
  electronAPI?: {
    // === 文件操作 ===
    readFile(filePath: string): Promise<string>
    writeFile(filePath: string, content: string): Promise<boolean>
    fileExists(filePath: string): Promise<boolean>
    deleteFile(filePath: string): Promise<boolean>
    renameFile(oldPath: string, newPath: string): Promise<boolean>
    appendFile(filePath: string, content: string): Promise<boolean>  // v1.4 新增

    // === 对话框 ===
    openFileDialog(): Promise<string | null>
    saveFileDialog(): Promise<string | null>
    openFolderDialog(): Promise<string | null>
    openImportDialog(): Promise<ImportResult | null>
    openBookDialog(): Promise<string | null>                        // v1.4 新增

    // === 目录 ===
    readDirectory(dirPath: string): Promise<FileEntry[]>
    readDirectoryRecursive(dirPath: string): Promise<DirEntry[]>
    readClipboard(): Promise<string>

    // === 设置 ===
    getSettings(): Promise<Record<string, unknown>>
    setSettings(settings: Record<string, unknown>): Promise<boolean>

    // === 工作区配置 ===
    getWorkspaceConfig(workspacePath: string): Promise<Record<string, unknown>>
    setWorkspaceConfig(workspacePath: string, key: string, value: unknown): Promise<boolean>

    // === 菜单事件 ===
    onMenuAction(callback: (action: string) => void): void

    // === 背诵模式 API ===
    recitationAPI: {
      // 基础
      init(workspacePath: string): Promise<boolean>
      addBook(book: Book): Promise<Book | null>
      getBookById(bookId: number): Promise<Book | null>
      getAllBooks(): Promise<Book[]>
      deleteBook(bookId: number): Promise<boolean>
      getBookProgress(bookId: number): Promise<BookProgress>
      getAllBooksWithProgress(): Promise<BookWithProgress[]>
      importBookFromFile(filePath: string): Promise<Book | null>

      // 单词操作
      getWordsByBook(bookId: number): Promise<Word[]>
      getUnstudiedWords(bookId: number, limit?: number): Promise<Word[]>
      getWordsForReview(bookId: number, limit?: number): Promise<Word[]>
      searchWords(searchText: string, bookId?: number): Promise<Word[]>
      startStudyWord(bookId: number, wordId: number): Promise<UserStudy | null>
      reviewWord(bookId: number, wordId: number, isCorrect: boolean): Promise<UserStudy | null>

      // 配置
      getConfig(): Promise<Record<string, unknown>>
      setConfig(key: string, value: unknown): Promise<boolean>

      // 今日单词
      getTodayWords(bookId: number, forceRefresh?: boolean): Promise<TodayWordsResult>
      refreshTodayWords(bookId: number): Promise<TodayWordsResult>
      markWordsAsTested(bookId: number, testedNewIds: number[], testedReviewIds: number[], quizResults?: Record<number, boolean>): Promise<boolean>

      // CRUD
      addWord(bookId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<Word | null>
      updateWord(wordId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<boolean>
      deleteWord(wordId: number): Promise<boolean>

      // 阶段分布
      getStageDistribution(bookId: number): Promise<StageDistribution>
      getOverallStageDistribution(): Promise<StageDistribution>
      getWordsByStage(bookId: number, minStage: number, maxStage: number): Promise<Word[]>

      // === v1.4 新增 ===
      renameBook(bookId: number, newName: string): Promise<boolean>
      exportBook(bookId: number, exportPath: string): Promise<boolean>
      exportBookToDialog(bookId: number): Promise<string | null>
      batchDeleteWords(bookId: number, wordIds: number[]): Promise<{success: number, failed: number, errors?: string[]}>
    }
  }
}
```
