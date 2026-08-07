# TSBook2 API — Electron IPC 通信

> v2.1: 新增 TTS IPC 通道（Kokoro GPU 加速引擎），其余与 v2.0 一致。

## 1.1 主进程 IPC Handlers (electron/handlers/)

Electron 主进程注册的 IPC 处理器，渲染进程通过 `window.electronAPI` 调用。

### ⭐ TTS 引擎 (ttsHandlers.ts) — v2.1 新增

Kokoro ONNX Runtime + CUDA GPU TTS 引擎的 IPC 通道。

| 通道 (Channel) | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `tts:init` | — | `Promise<EngineStatus>` | 初始化 TTS 引擎（加载 ONNX 模型，配置 CUDA EP）。返回 GPU 设备名、VRAM 用量等 |
| `tts:synthesize` | `{text, voiceId, speed, lang}` | `Promise<{sampleRate, channels, samples: number[], duration}>` | 文本合成语音。返回 24000Hz PCM float32 采样 |
| `tts:getVoices` | `lang?: string` | `Promise<VoiceInfo[]>` | 获取可用语音列表（46 个，覆盖 8 种语言） |
| `tts:getStatus` | — | `Promise<EngineStatus>` | 查询引擎运行状态（GPU 设备、VRAM 等） |
| `tts:destroy` | — | `Promise<boolean>` | 释放 GPU 资源 |

**数据类型**：

```typescript
interface EngineStatus {
  initialized: boolean
  modelLoaded: boolean
  trtAvailable: boolean
  deviceName: string     // e.g. "NVIDIA GeForce RTX 3060"
  vramUsed: number       // MB
}

interface VoiceInfo {
  voiceId: string        // e.g. "af_heart"
  name: string           // e.g. "Heart"
  lang: string           // e.g. "en"
  gender: string         // "F" | "M"
}
```

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
| `recitation:fetch-remote-books` | `source: BookSource` | `Promise<{success: boolean, books: RemoteBookFile[], error?: string}>` | 获取远程仓库所有 JSON 词书文件列表（递归扫描全仓库，v2.0 新增） |
| `recitation:import-remote-book` | `downloadUrl: string, bookName: string` | `Promise<{success: boolean, book?: Book, error?: string}>` | 从远程 URL 下载并导入词书 JSON（v2.0 新增） |

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

    // === Kokoro TTS 引擎 ★ v2.1 新增 ===
    tts: {
      init(): Promise<EngineStatus>
      synthesize(req: { text: string; voiceId: string; speed: number; lang: string }): Promise<SynthesizeResult>
      getVoices(lang?: string): Promise<VoiceInfo[]>
      getStatus(): Promise<EngineStatus>
      destroy(): Promise<boolean>
    }

    // === 背诵模式 API ===
    recitationAPI: {
      // ...（同 v2.0）
    }
  }
}
```
