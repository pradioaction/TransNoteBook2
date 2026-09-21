# TSBook2 API — Electron IPC 通信 (v2.2)

> v2.2 变更：`open-book-dialog` 文件过滤器扩展为 `json + jsonl`；新增 Edge TTS 通道（`tts:edgeSynthesize` / `tts:edgeGetVoices`）。
> 本节为**全量通道表**（v2.0/v2.1 文档中按版本分散罗列，此处汇总并核对到当前代码）。

## 1.1 主进程 IPC Handlers

所有处理器均为 `ipcMain.handle`（`invoke/handle` 请求-响应模式），按职责拆分在 `electron/handlers/` 下。

### 文件操作 — [fileHandlers.ts](../../../electron/handlers/fileHandlers.ts)

| 通道 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `read-file` | `filePath: string` | `Promise<string>` | 读取文件内容（UTF-8） |
| `write-file` | `filePath: string, content: string` | `Promise<boolean>` | 写入文件（自动创建目录） |
| `file-exists` | `filePath: string` | `Promise<boolean>` | 检查文件是否存在 |
| `delete-file` | `filePath: string` | `Promise<boolean>` | 删除文件 |
| `rename-file` | `oldPath: string, newPath: string` | `Promise<boolean>` | 重命名文件 |
| `append-file` | `filePath: string, content: string` | `Promise<boolean>` | 追加内容到文件尾部（日志写入） |
| `read-clipboard` | — | `Promise<string>` | 读取系统剪贴板 |
| `read-directory` | `dirPath: string` | `Promise<FileEntry[]>` | 读取目录，返回 `.transnb` 文件与子目录（已排序） |
| `read-directory-recursive` | `dirPath: string` | `Promise<DirEntry[]>` | 递归遍历，返回所有 `.transnb` 文件 |

### 对话框 — [dialogHandlers.ts](../../../electron/handlers/dialogHandlers.ts)

| 通道 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `open-file-dialog` | — | `Promise<string \| null>` | 打开 `.transnb` 文件 |
| `save-file-dialog` | — | `Promise<string \| null>` | 保存文件，默认名 `untitled.transnb` |
| `open-folder-dialog` | — | `Promise<string \| null>` | 选择文件夹 |
| `open-import-dialog` | — | `Promise<ImportResult \| null>` | 导入文本（txt/md/html） |
| `open-book-dialog` | — | `Promise<string \| null>` | 导入词书文件；**v2.2：过滤器由 `json` 扩展为 `Book Files (JSON/JSONL)` → `['json','jsonl']`** |

### 设置 — [settingsHandlers.ts](../../../electron/handlers/settingsHandlers.ts)

| 通道 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `get-settings` | — | `Promise<Record<string, unknown>>` | 读取 `{userData}/settings.json` |
| `set-settings` | `settings: Record<string, unknown>` | `Promise<boolean>` | 写入 `{userData}/settings.json` |

### 工作区配置 — [workspaceConfigHandlers.ts](../../../electron/handlers/workspaceConfigHandlers.ts)

| 通道 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `workspace-config:get` | `workspacePath: string` | `Promise<Record<string, unknown>>` | 读取 `{workspace}/.TransRead/workspace-config.json` |
| `workspace-config:set` | `workspacePath, key, value` | `Promise<boolean>` | 写入单个配置项 |

### 背诵模式 — [recitationHandlers.ts](../../../electron/handlers/recitationHandlers.ts)

| 通道 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `recitation:init` | `workspacePath: string` | `Promise<{success: boolean, error?: string}>` | 初始化工作区数据库 |
| `recitation:add-book` | `book: { name, path, count, description? }` | `Promise<Book \| null>` | 添加词书 |
| `recitation:get-book-by-id` | `bookId: number` | `Promise<Book \| null>` | 查询单个词书 |
| `recitation:get-all-books` | — | `Promise<Book[]>` | 获取所有词书 |
| `recitation:delete-book` | `bookId: number` | `Promise<boolean>` | 删除词书 |
| `recitation:get-book-progress` | `bookId: number` | `Promise<BookProgress>` | 获取词书进度 |
| `recitation:get-all-books-with-progress` | — | `Promise<BookWithProgress[]>` | 获取所有词书及进度 |
| `recitation:import-book-from-file` | `filePath: string` | `Promise<Book \| null>` | 从 JSON/JSONL 文件导入词书 |
| `recitation:get-words-by-book` | `bookId: number` | `Promise<Word[]>` | 获取词书所有单词 |
| `recitation:get-unstudied-words` | `bookId, limit?` | `Promise<Word[]>` | 未学单词 |
| `recitation:get-words-for-review` | `bookId, limit?` | `Promise<Word[]>` | 待复习单词 |
| `recitation:search-words` | `searchText, bookId?` | `Promise<Word[]>` | 搜索单词 |
| `recitation:start-study-word` | `bookId, wordId` | `Promise<UserStudy \| null>` | 开始学习单词 |
| `recitation:review-word` | `bookId, wordId, isCorrect` | `Promise<UserStudy \| null>` | 复习单词 |
| `recitation:get-config` | — | `Promise<Record<string, unknown>>` | 读取 `studywordmode.json` 全部配置 |
| `recitation:set-config` | `key, value` | `Promise<boolean>` | 写入单个配置项（检测进度槽位亦存于此） |
| `recitation:get-today-words` | `bookId, forceRefresh?` | `Promise<TodayWordsResult>` | 今日单词 |
| `recitation:refresh-today-words` | `bookId` | `Promise<TodayWordsResult>` | 强制刷新今日单词 |
| `recitation:mark-words-as-tested` | `bookId, testedNewIds, testedReviewIds, quizResults?` | `Promise<boolean>` | 标记今日已测单词 |
| `recitation:add-word` | `bookId, word` | `Promise<Word \| null>` | 添加单词 |
| `recitation:update-word` | `wordId, word` | `Promise<boolean>` | 更新单词 |
| `recitation:delete-word` | `wordId` | `Promise<boolean>` | 删除单词 |
| `recitation:get-stage-distribution` | `bookId: number` | `Promise<StageDistribution>` | 词书阶段分布 |
| `recitation:get-overall-stage-distribution` | — | `Promise<StageDistribution>` | 全部词书阶段分布 |
| `recitation:get-words-by-stage` | `bookId, minStage, maxStage` | `Promise<Word[]>` | 按阶段范围查询单词 |
| `recitation:rename-book` | `bookId, newName` | `Promise<boolean>` | 重命名词书 |
| `recitation:export-book` | `bookId, exportPath` | `Promise<boolean>` | 导出词书到指定路径 |
| `recitation:export-book-to-dialog` | `bookId` | `Promise<string \| null>` | 弹保存对话框并导出 |
| `recitation:batch-delete-words` | `bookId, wordIds` | `Promise<{success, failed, errors?}>` | 批量删除单词 |
| `recitation:fetch-remote-books` | `source: BookSource` | `Promise<{success, books, error?}>` | 递归扫描远程仓库词书文件列表；**v2.2：匹配 `.json` 与 `.jsonl`** |
| `recitation:import-remote-book` | `downloadUrl, bookName` | `Promise<{success, book?, error?}>` | 下载并导入远程词书 |

> **注意**：`recitation:init` 返回 `{success, error}` 对象而非 boolean（v1.4 起）。

### Kokoro GPU TTS 引擎 — [ttsHandlers.ts](../../../electron/handlers/ttsHandlers.ts)

Kokoro ONNX Runtime + CUDA 引擎通道（v2.1 引入）。渲染侧默认**不展示**该 Provider（见 [tts.md](./tts.md)）。

| 通道 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `tts:init` | — | `Promise<EngineStatus>` | 加载 ONNX 模型并配置 CUDA EP |
| `tts:synthesize` | `{text, voiceId, speed, lang}` | `Promise<SynthesizeResult>` | 合成 24000Hz PCM float32 |
| `tts:getVoices` | `lang?: string` | `Promise<VoiceInfo[]>` | 可用语音列表 |
| `tts:getStatus` | — | `Promise<EngineStatus>` | 引擎状态（GPU 设备名、VRAM） |
| `tts:destroy` | — | `Promise<boolean>` | 释放 GPU 资源（`before-quit` 亦会调用） |

### Edge TTS（实验，v2.2 补充记录）— [edgeTtsHandlers.ts](../../../electron/handlers/edgeTtsHandlers.ts)

| 通道 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `tts:edgeSynthesize` | `{text, voiceId, rate}` | `Promise<{audio: string}>` | 在线合成，返回 base64 MP3 |
| `tts:edgeGetVoices` | — | `Promise<EdgeVoiceInfo[]>` | 拉取在线语音列表（ShortName/FriendlyName/Locale） |

### TTS 数据类型

```typescript
interface EngineStatus {
  initialized: boolean
  modelLoaded: boolean
  trtAvailable: boolean
  deviceName: string     // 例 "NVIDIA GeForce RTX 3060"
  vramUsed: number       // MB
}

interface VoiceInfo {
  voiceId: string        // 例 "af_heart"
  name: string
  lang: string
  gender: string         // "F" | "M"
}

interface SynthesizeResult {
  sampleRate: number     // 24000
  channels: number
  samples: number[]      // Float32Array 结构化克隆后的普通数组
  duration: number       // 秒
}
```

---

## 1.2 预加载桥接 — [preload.ts](../../../electron/preload.ts)

通过 `contextBridge.exposeInMainWorld('electronAPI', ...)` 暴露；类型声明位于 [types/notebook.ts](../../../src/types/notebook.ts)（`declare global { interface Window }`）。

```typescript
interface Window {
  electronAPI?: {
    // 文件
    readFile(filePath: string): Promise<string>
    writeFile(filePath: string, content: string): Promise<boolean>
    fileExists(filePath: string): Promise<boolean>
    deleteFile(filePath: string): Promise<boolean>
    renameFile(oldPath: string, newPath: string): Promise<boolean>
    appendFile(filePath: string, content: string): Promise<boolean>

    // 对话框
    openFileDialog(): Promise<string | null>
    saveFileDialog(): Promise<string | null>
    openFolderDialog(): Promise<string | null>
    openImportDialog(): Promise<ImportResult | null>
    openBookDialog(): Promise<string | null>
    readClipboard(): Promise<string>

    // 目录
    readDirectory(dirPath: string): Promise<FileEntry[]>
    readDirectoryRecursive(dirPath: string): Promise<DirEntry[]>

    // 设置
    getSettings(): Promise<Record<string, unknown>>
    setSettings(settings: Record<string, unknown>): Promise<boolean>

    // 工作区配置
    getWorkspaceConfig(workspacePath: string): Promise<Record<string, unknown>>
    setWorkspaceConfig(workspacePath: string, key: string, value: unknown): Promise<boolean>

    // 菜单
    onMenuAction(callback: (action: string) => void): void

    // 背诵（可选）
    recitationAPI?: RecitationAPI

    // Kokoro TTS（可选）
    tts?: {
      init(): Promise<unknown>
      synthesize(req: { text: string; voiceId: string; speed: number; lang: string }): Promise<unknown>
      getVoices(lang?: string): Promise<unknown>
      getStatus(): Promise<unknown>
      destroy(): Promise<unknown>
    }

    // Edge TTS（可选，v2.2 补充记录）
    edgeTts?: {
      synthesize(req: { text: string; voiceId: string; rate: number }): Promise<{ audio: string }>
      getVoices(): Promise<Array<{ ShortName: string; FriendlyName: string; Locale: string }>>
    }
  }
}
```

> **v2.1 文档勘误**：v2.1 的 `electron-ipc.md` 将 `tts` 桥接记为必选属性且未记录 `edgeTts`。实际二者均为可选属性（`tts?` / `edgeTts?`），代码侧通过 `window.electronAPI?.tts` 做可用性探测。
