# TSBook2 软件架构 — 核心模块详解

## 3.1 Electron 主进程 (electron/)

### main.ts
v1.4 重构: main.ts 从约 548 行精简至约 66 行。所有 IPC `ipcMain.handle` 注册调用被提取到 `handlers/` 目录下的 5 个独立模块中，每个模块导出 `register*Handlers()` 函数。main.ts 仅保留 BrowserWindow 创建管理和 `registerAllHandlers()` 组合调用。

职责:
- 管理 BrowserWindow 创建和生命周期
- 调用各 handler 模块的 register 函数注册 IPC 处理器
- (不再直接包含任何 IPC handle 实现)

```
app.whenReady().then(() => {
  registerAllHandlers()
  createWindow()
})
```

### handlers/ 目录 (v1.4 模块化重构)

5 个 IPC 处理器模块:

| 模块 | 文件 | 注册的 IPC 通道 | 说明 |
|------|------|-----------------|------|
| fileHandlers | `handlers/fileHandlers.ts` | read-file, write-file, file-exists, delete-file, rename-file, append-file, read-clipboard, read-directory, read-directory-recursive | 文件系统操作 |
| dialogHandlers | `handlers/dialogHandlers.ts` | open-file-dialog, save-file-dialog, open-folder-dialog, open-import-dialog, open-book-dialog | 原生对话框 |
| settingsHandlers | `handlers/settingsHandlers.ts` | get-settings, set-settings | 设置持久化 |
| recitationHandlers | `handlers/recitationHandlers.ts` | recitation:init, :add-book, :get-book-by-id, :get-all-books, :delete-book, :get-book-progress, :get-all-books-with-progress, :import-book-from-file, :get-words-by-book, :get-unstudied-words, :get-words-for-review, :search-words, :add-word, :update-word, :delete-word, :get-words-by-stage, :start-study-word, :review-word, :get-today-words, :refresh-today-words, :mark-words-as-tested, :get-config, :set-config, :get-stage-distribution, :get-overall-stage-distribution, :rename-book, :export-book, :export-book-to-dialog, :batch-delete-words | 背诵模式完整 CRUD + 学习流程 + 统计 + v1.4 新增词书重命名/导出/批量删除 |
| workspaceConfigHandlers | `handlers/workspaceConfigHandlers.ts` | workspace-config:get, workspace-config:set | 工作区级配置 |

IPC 处理器完整清单:

| 通道 | 说明 | 所属模块 |
|------|------|----------|
| read-file / write-file / file-exists / delete-file / rename-file | 文件系统 | fileHandlers |
| append-file | 文件追加 (v1.4 新增) | fileHandlers |
| read-directory / read-directory-recursive / read-clipboard | 目录+剪贴板 | fileHandlers |
| open-file-dialog / save-file-dialog / open-folder-dialog / open-import-dialog / open-book-dialog | 对话框 | dialogHandlers |
| get-settings / set-settings | 设置持久化 | settingsHandlers |
| workspace-config:get / workspace-config:set | 工作区级配置 (v1.4) | workspaceConfigHandlers |
| recitation:init / :add-book / :get-book-by-id / :get-all-books / :delete-book / :get-book-progress / :get-all-books-with-progress / :import-book-from-file | 词书 CRUD | recitationHandlers |
| recitation:get-words-by-book / :get-unstudied-words / :get-words-for-review / :search-words / :add-word / :update-word / :delete-word | 单词 CRUD | recitationHandlers |
| recitation:get-words-by-stage | 按阶段筛选单词 (v1.3) | recitationHandlers |
| recitation:start-study-word / :review-word | 学习流程 | recitationHandlers |
| recitation:get-today-words / :refresh-today-words / :mark-words-as-tested | 今日单词 + 已测标记 (v1.3) | recitationHandlers |
| recitation:get-config / :set-config | 配置 | recitationHandlers |
| recitation:get-stage-distribution / :get-overall-stage-distribution | 阶段统计分布 (v1.3) | recitationHandlers |
| recitation:rename-book / :export-book / :export-book-to-dialog / :batch-delete-words | 词书操作增强 (v1.4) | recitationHandlers |

安全设计:
- nodeIntegration: false, contextIsolation: true
- 通过 preload.ts 的 contextBridge.exposeInMainWorld 暴露有限 API

### preload.ts
职责:
- 通过 contextBridge.exposeInMainWorld('electronAPI', {...}) 暴露类型安全的 API 对象
- 所有文件操作均包装为 IPC invoke 调用
- 类型引用 `electron/types.ts` 中的 FileEntry / DirEntry / ImportResult

exposed API types:
```typescript
interface Window {
  electronAPI?: {
    readFile, writeFile, fileExists, deleteFile, renameFile, appendFile,
    openFileDialog, saveFileDialog, openFolderDialog, openImportDialog, openBookDialog,
    readDirectory, readDirectoryRecursive, readClipboard,
    getSettings, setSettings,
    getWorkspaceConfig, setWorkspaceConfig,
    onMenuAction,
    recitationAPI: { /* 所有词书/单词/学习/统计/已测标记/重命名/导出/批量删除方法 */ }
  }
}
```

### 3.1.x Electron 状态与类型共享 (v1.4 新增)

#### state.ts
`electron/state.ts` 提供 Electron 主进程内共享的状态单例和设置管理函数:

```typescript
// 背诵服务单例
export const recitationState = {
  mainWindow: null as BrowserWindow | null,
  recitationDAL: null as RecitationDAL | null,
  studyService: null as StudyService | null,
  bookService: null as BookService | null,
  workspacePath: null as string | null,
}

// 工作区切换时重新初始化背诵服务
export function ensureRecitationServices(workspacePath: string): boolean

// 设置管理
export const SETTINGS_PATH
export function getDefaultSettings(): Record<string, unknown>
export function loadSettings(): Record<string, unknown>
export function saveSettings(settings: Record<string, unknown>): boolean
```

所有 handler 模块通过 `import { recitationState } from '../state'` 共享同一份状态，避免模块间循环依赖。

#### types.ts
`electron/types.ts` 定义 Electron 主进程和渲染进程之间共享的轻量类型:

```typescript
export interface FileEntry { name: string; path: string; isDirectory: boolean }
export interface DirEntry  { name: string; path: string }
export interface ImportResult { filePath: string; content: string }
```

这些类型在 preload.ts 和渲染进程 types/electron.ts 中引用，确保 IPC 数据一致性。

### 3.1.y ConfigProvider (electron/workspace/configProvider.ts)

通用配置存取接口，用于工作区级配置（背诵模式使用的 studywordmode.json）：

```typescript
export interface ConfigProvider {
  get(key: string): unknown
  set(key: string, value: unknown): void
  getAll(): Record<string, unknown>
}

export class FileBasedConfig implements ConfigProvider {
  // 惰性加载 (首次 get/set 时从文件读取, 之后缓存)
  // set 操作自动同步写回文件
  private _filePath: string
  private _cache: Record<string, unknown>
  private _loaded: boolean

  get(key): unknown       // _load() → return _cache[key]
  set(key, value): void    // _load() → _cache[key] = value → _save()
  getAll(): Record         // _load() → return {..._cache}
  setAll(config): void     // 覆盖全部配置并保存
}
```

应用位置:
- 背诵服务 `StudyService` / `BookService` 通过 `FileBasedConfig` 读写 `studywordmode.json`
- 工作区切换时自动重新构造 ConfigProvider 实例

## 3.2 状态管理层 (store/)

TSBook2 使用 Zustand 管理 7 个独立状态存储。

### notebookStore.ts (核心状态)
管理笔记本数据（单元格列表、文件路径、修改状态）、多文件打开、单元格选择状态。
v1.1 重构: 移除了约 28 个单元格编辑方法到服务层。
v1.2 改进: 新增 _onFileOpened 回调解耦 settingStore。

状态结构:
```typescript
interface NotebookStore {
  openFiles: Map<string, NotebookFile>
  activeFilePath: string | null
  selectedIndices: Set<number>
  notebook: NotebookFile
  openFileCount: number
  // 方法: openFile, closeFile, switchToFile, setNotebook, setCells, setFilePath, setModified
  // 选择: selectCell, selectCellRange, toggleCellSelection, clearSelection
  // 内容: updateCellContent, updateCellOutput
}
```

### workspaceStore.ts
管理: 工作区路径、文件列表、侧边栏/面板可见性、最近文件.
```typescript
interface WorkspaceStore {
  workspacePath, workspaceFiles, recentFiles, sidebarActiveTab, sidebarVisible, panelVisible
}
```

### themeStore.ts
管理: 当前主题 (light|dark), 提供 ThemeConfig 颜色配置.

### settingStore.ts
管理: 翻译配置、提示词模板、自定义模型、环境变量. 支持磁盘持久化 (500ms debounced).
v1.2 解耦: 移除了对 themeStore 的直接 import, 通过 _onThemeChange 回调解耦.

### recitationStore.ts (背诵 UI 状态)
管理背诵模式的阶段切换、侧边栏数据、单词选择 (含 selectWordRange v1.3)、检测状态、测验结果追踪 (quizResultsByBook v1.3)、批量同步追踪 (pendingSyncResults v1.3).

### outputStore.ts
日志输出 Store, 用于底部 Panel 日志显示. 提供 addLog/clearLogs.
v1.4 集成: addLog 方法同步写入当日日志文件, 通过 logService (append-file IPC) 异步追加, 路径为 {workspace}/.TransRead/log/{yyyy-MM-dd}.log.
v1.4 增强: addLog 支持可选第三个参数 `color?: string`, Panel 渲染时优先使用自定义颜色. 颜色约定: 成功 `#4caf50`(绿), 警告 `#d4a017`(琥珀), 错误 `#e06c75`(红).

### workspaceConfigStore.ts (v1.4 新增)
工作区级配置 Store, 用于存储 notebook 模块的配置, 独立于背诵模块的 `studywordmode.json`.
数据存储在 `{workspace}/.TransRead/workspace-config.json`, 通过 `workspace-config:get/set` IPC 读写.
```typescript
interface WorkspaceConfigStore {
  bookmarkFilePath: string | null  // 收藏夹目标 .transnb 文件路径
  loaded: boolean                  // 是否已从磁盘加载
  load(): Promise<void>
  setBookmarkFilePath(path: string | null): Promise<void>
}
```

## 3.3 布局层 (components/layout/)

### AppShell.tsx
组合所有布局组件, 初始化键盘快捷键, 定义全局布局结构. 背诵模式下隐藏通用 Sidebar.
```
┌─────────────────────────────────────────────────┐
│  ┌──────┬──────────┬──────────────────────────┐  │
│  │      │          │  NotebookToolbar         │  │
│  │ Acti │ Sidebar  ├──────────────────────────┤  │
│  │ vity │ (280px)  │  NotebookEditor          │  │
│  │ Bar  │          │  (cell list)             │  │
│  │ 48px │          ├──────────────────────────┤  │
│  │      │          │  Panel (200px, optional) │  │
│  ├──────┴──────────┴──────────────────────────┤  │
│  │  StatusBar (24px)                           │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### ActivityBar.tsx / Sidebar.tsx / StatusBar.tsx / Panel.tsx
ActivityBar: 活动图标切换; Sidebar: 280px 可变宽度 (FileExplorer + search + settings); StatusBar: 文件/单元格信息; Panel: 200px 底部面板.

## 3.4-3.7 笔记本/单元格/文件浏览器/设置

### NotebookEditor.tsx
核心编辑器区域. 动态 maxWidth = Math.max(400, containerWidth × cellWidthRatio / 100).

### NotebookToolbar.tsx
文件操作 (新建/打开/保存/另存为/导入), 删除选中单元格, 设置对话框.
v1.4 变更: 按钮文本全部改为 i18n 国际化 (toolbar.* 命名空间). 右上角集成 ReadingTimer 阅读计时器组件.

### CellContainer.tsx
组合 CellToolbar + CellEditor + CellOutput + CellCollapseIndicator. 处理选中和缩进.
```
┌─────────────────────────────────────────────┐
│  ┌────────┐                                 │
│  │ gutter │  CellToolbar                    │
│  │ (16px) ├─────────────────────────────────┤
│  │        │  CellEditor (TipTap)            │
│  │        ├─ CellCollapseIndicator          │
│  │        │  CellOutput (marked)            │
│  └────────┴─────────────────────────────────┘
```

### CellEditor.tsx / CellOutput.tsx / CellToolbar.tsx / CellCollapseIndicator.tsx
CellEditor: TipTap 富文本 + marked 阅读模式, 双击/ESCAPE 切换.
CellOutput: marked 渲染译文.
CellToolbar: ▶ 翻译 | ⧉ 复制 | ★ 收藏 | ↑ 上移 | ↓ 下移 | ✕ 删除 | ▼ 折叠.
  v1.4: 新增 ★ 收藏按钮, 调用 useBookmark.addCurrentCellToBookmark().
CellCollapseIndicator: 可点击折叠分隔线.

### FileExplorer.tsx / SettingsDialog.tsx
FileExplorer: 浏览 .transnb 文件, 目录展开/折叠, 右键菜单 (重命名/删除/**设为收藏夹**), 打开文件列表.
  v1.4: 收藏夹文件以 ★ 星标图标标识, 右键"设为收藏夹"将路径持久化到 `workspace-config.json`.
SettingsDialog: 4 标签页 (General / Translation / Prompts / Models).

## 3.8 阅读工具组件 (components/reading/)

### ReadingTimer.tsx
阅读界面计时器，嵌入 NotebookToolbar 右上角文件名左侧。
```
[▶|⏸] 00:00   文件名.transnb
```
功能:
- 开始/暂停切换（SVG 播放/暂停图标）
- 自动停止场景：文件切换 → 记录 "(file switched)"；背诵检测激活 → 记录 "(quiz started)"
- 计时结束通过 outputStore.addLog() 写入底部 Panel 和当日日志文件
- 无 notebook 时隐藏组件
- 格式化: h:mm:ss / mm:ss

## 3.9 工具层

### fileUtils.ts
parseNotebookFile (v1.0/v2.0 兼容), serializeNotebookFile (2空格缩进), splitTextIntoParagraphs.

### useKeyboard.ts
快捷键表:
| 快捷键 | 动作 |
|--------|------|
| Ctrl+N | 下方插入 |
| Ctrl+Shift+A | 上方插入 |
| Delete | 删除选中 |
| Ctrl+D | 复制单元格 |
| Ctrl+M | 合并选中 |
| Ctrl+F | 切换从属 |
| Ctrl+E | 折叠/展开 |
| Ctrl+Q / Ctrl+Shift+Q | 折叠原文(当前/全部) |
| Ctrl+W / Ctrl+Shift+W | 折叠译文(当前/全部) |
| ↑/↓ | 上下导航 |
| Shift+↑/↓ | 范围选择 |

自动跳过 TipTap/INPUT/TEXTAREA 编辑状态.

### useTheme.ts
将 ThemeConfig 映射为 CSS 变量, 提供主题切换和颜色获取.

### useBookmark.ts (v1.4 新增)
单元格收藏 Hook, 提供 `addCurrentCellToBookmark()` 方法:
1. 获取当前选中单元格的最后一个 (取 max selectedIndices)
2. 从 workspaceConfigStore 读取 bookmarkFilePath
3. 通过 electronAPI.readFile 读取目标收藏夹文件
4. parseNotebookFile → 创建新 Cell (仅 content + output, 无层级)
5. push 到 data.cells → serializeNotebookFile → writeFile
6. 如果目标文件已在 openFiles 中打开, 同步更新 openFiles 中对应条目
7. 通过 outputStore.addLog 输出收藏结果日志 (支持颜色)

## 3.10 类型系统 (types/)

| 目录 | 文件 | 核心类型 |
|------|------|----------|
| types/ | notebook.ts | NotebookCell, NotebookData, NotebookFile, ThemeConfig, AppSettings, Window.electronAPI 完整类型 |
| types/ | electron.ts | FileEntry, DirEntry, ImportResult (从 electron/types.ts 导入) |
| electron/ | types.ts | FileEntry, DirEntry, ImportResult (主进程侧单一定义) |
| recitation/ | types.ts | Book, Word, UserStudy, StageDistribution, StageSummary, TodayWordsResult (含 tested...) |
| recitation/ | quizTypes.ts | QuizState, QuizQuestion, QuizOption |
| recitation/ | wordSidebarTypes.ts | WordSidebarData, WordDisplay, ReviewWordBatch |

v1.2 变更: IPC 共享类型统一到 electron.ts.
v1.4 变更: electron/types.ts 定义核心共享类型, 渲染进程 types/electron.ts 通过 `export type { FileEntry, DirEntry, ImportResult } from './electron'` 重导出. preload.ts 移除重复类型定义, 改为 `import type { FileEntry, DirEntry, ImportResult } from './types'`.

## 3.11 主题系统 (styles/)

themes.ts: 40 个颜色键 (含背诵模式配色 + 6 阶段颜色 light/dark).
global.css: 全局样式 + TipTap 编辑器样式 + CSS 变量.

## 3.12 服务层详解 (services/)

服务接口: FileService (7方法), CellService (16方法), TranslationService (含 generateSceneText), RecitationService (含 v1.3/v1.4 扩展), LogService (6方法, 含 cleanupOldLogs).

| 服务 | 模式 | Hook / 创建方式 | 依赖 |
|------|------|------|------|
| FileService | 模块级闭包 | useFileService | notebookStore, workspaceStore, electronAPI |
| CellService | 模块级闭包 | useCellService | notebookStore |
| TranslationService | 模块级单例 | useTranslationService | notebookStore, settingStore, providers |
| RecitationService | IPC 代理 | useRecitationService | recitationAPI |
| LogService | 模块级闭包 (工厂) | createLogService(getWorkspacePath) | window.electronAPI, workspaceStore |

LogService v1.4 变更:
- `appendToFile` 使用 `window.electronAPI.appendFile` IPC (直接 append, 无需队列)
- 新增 `cleanupOldLogs(retentionDays)` 清理超过保留天数的旧日志文件
- 新增 `hasDateLog(date)` 检测指定日期是否有日志文件
- 新增 `createFile(filePath)` 创建指定文件

设计原则: 接口与实现分离, 组合而非继承, 可选 Hook 封装, 单一职责.

## 3.13 翻译模块详解 (translation/)

TranslationProvider 接口 + 策略模式.
内置提供者: OllamaProvider (system, ollama), OpenAIProvider (system, openai), ArkProvider (custom, ark).
ProviderFactory: buildProvider, createSystemProviders, createCustomProviders.
翻译进度可视化 (v1.2): 逐单元格状态跟踪, 200ms 轮询同步, Panel + CellToolbar 指示器.
generateSceneText: 预留接口供背诵模块生成场景文章.
