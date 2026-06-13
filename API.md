# TSBook2 API 接口文档

本文档描述了 TSBook2 应用中各核心模块的对外接口和类型定义。

---

## 1. Electron IPC API

### 1.1 主进程 IPC Handlers (electron/main.ts)

Electron 主进程注册的 IPC 处理器，渲染进程通过 `window.electronAPI` 调用。

| 通道 (Channel) | 参数 | 返回值 | 说明 |
|---------------|------|--------|------|
| `read-file` | `filePath: string` | `Promise<string>` | 读取文件内容（UTF-8） |
| `write-file` | `filePath: string, content: string` | `Promise<boolean>` | 写入文件（自动创建目录） |
| `file-exists` | `filePath: string` | `Promise<boolean>` | 检查文件是否存在 |
| `delete-file` | `filePath: string` | `Promise<boolean>` | 删除文件 |
| `rename-file` | `oldPath: string, newPath: string` | `Promise<boolean>` | 重命名文件 |
| `open-file-dialog` | 无 | `Promise<string \| null>` | 打开 .transnb 文件选择对话框 |
| `save-file-dialog` | 无 | `Promise<string \| null>` | 保存文件对话框，默认名 `untitled.transnb` |
| `open-folder-dialog` | 无 | `Promise<string \| null>` | 选择文件夹对话框 |
| `open-import-dialog` | 无 | `Promise<ImportResult \| null>` | 导入文本文件对话框（txt/md/html） |
| `read-directory` | `dirPath: string` | `Promise<FileEntry[]>` | 读取目录，返回 .transnb 文件和目录（已排序） |
| `read-directory-recursive` | `dirPath: string` | `Promise<DirEntry[]>` | 递归遍历目录，返回所有 .transnb 文件 |
| `get-settings` | 无 | `Promise<Record<string, unknown>>` | 读取 `userData/settings.json` |
| `set-settings` | `settings: Record<string, unknown>` | `Promise<boolean>` | 保存设置到 `userData/settings.json` |

### 1.2 预加载桥接 (electron/preload.ts)

通过 `contextBridge.exposeInMainWorld` 暴露的类型安全 API：

```typescript
interface Window {
  electronAPI?: {
    readFile(filePath: string): Promise<string>
    writeFile(filePath: string, content: string): Promise<boolean>
    fileExists(filePath: string): Promise<boolean>
    deleteFile(filePath: string): Promise<boolean>
    renameFile(oldPath: string, newPath: string): Promise<boolean>
    
    openFileDialog(): Promise<string | null>
    saveFileDialog(): Promise<string | null>
    openFolderDialog(): Promise<string | null>
    openImportDialog(): Promise<ImportResult | null>
    
    readDirectory(dirPath: string): Promise<FileEntry[]>
    readDirectoryRecursive(dirPath: string): Promise<DirEntry[]>
    
    getSettings(): Promise<Record<string, unknown>>
    setSettings(settings: Record<string, unknown>): Promise<boolean>
    
    onMenuAction(callback: (action: string) => void): void
  }
}
```

---

## 2. 类型定义 API (types/notebook.ts)

### 2.1 核心数据模型

#### NotebookCell

单元格数据接口。

```typescript
interface NotebookCell {
  id: string                    // UUID 唯一标识
  type: 'markdown'             // 单元格类型（当前仅支持 markdown）
  content: string              // 原文内容
  output: string               // 译文/输出内容
  parentId: string | null      // 父单元格 ID（用于层级从属关系）
  indentLevel: number          // 缩进级别
  isCollapsed: boolean         // 整体折叠状态
  isInputCollapsed: boolean    // 原文区折叠状态
  isOutputCollapsed: boolean   // 译文区折叠状态
}
```

#### NotebookData

文件序列化格式接口。

```typescript
interface NotebookData {
  version: string              // 文件格式版本（当前 "2.0"）
  cells: NotebookCell[]        // 单元格数组
}
```

#### NotebookFile

文件元数据接口。

```typescript
interface NotebookFile {
  path: string | null          // 文件路径（null 表示未保存的新文件）
  name: string                 // 文件名
  isModified: boolean          // 是否有未保存修改
  cells: NotebookCell[]        // 单元格列表
}
```

### 2.2 Electron IPC 类型

```typescript
interface FileEntry {
  name: string                 // 文件/目录名
  path: string                 // 完整路径
  isDirectory: boolean         // 是否为目录
}

interface DirEntry {
  name: string                 // 文件名
  path: string                 // 完整路径
}

interface ImportResult {
  filePath: string             // 源文件路径
  content: string              // 文件内容
}
```

### 2.3 主题配置类型

```typescript
interface ThemeConfig {
  foreground: string           // 前景色
  background: string           // 背景色
  editorBackground: string     // 编辑器背景
  editorForeground: string     // 编辑器前景
  border: string               // 边框色
  sidebarBackground: string    // 侧边栏背景
  sidebarHeader: string        // 侧边栏头部
  sidebarBorder: string        // 侧边栏边框
  activityBarBackground: string // 活动栏背景
  activityBarForeground: string // 活动栏前景
  activityBarActiveBorder: string // 活动栏激活边框
  statusBarBackground: string  // 状态栏背景
  statusBarForeground: string  // 状态栏前景
  cellBackground: string       // 单元格背景
  cellSelectedBackground: string // 单元格选中背景
  cellBorder: string           // 单元格边框
  cellOutputBackground: string // 译文区背景
  cellOutputBorder: string     // 译文区边框
  cellGutter: string           // gutter 区域背景
  toolbarBackground: string    // 工具栏背景
  toolbarHover: string         // 工具栏悬停
  primaryButton: string        // 主按钮
  primaryButtonHover: string   // 主按钮悬停
  errorBackground: string      // 错误背景
  errorBorder: string          // 错误边框
  errorText: string            // 错误文字
  scrollbar: string            // 滚动条
  inputBackground: string      // 输入框背景
  inputBorder: string          // 输入框边框
  panelBackground: string      // 面板背景
  panelBorder: string          // 面板边框
  listItemHover: string        // 列表项悬停
  listItemSelected: string     // 列表项选中
}
```

### 2.4 设置相关类型

```typescript
interface TranslationSettings {
  enabled: boolean
  currentProvider: string
  ollama: { baseUrl: string; model: string }
  openai: {
    apiKeyEnv: string
    baseUrl: string
    model: string
    timeout: number
    proxy: string
  }
}

interface CustomModel {
  name: string                 // 自定义模型名称
  apiKeyEnv: string            // API Key 环境变量名
  endpoint: string             // 端点 URL
  model: string                // 模型名/推理接入点 ID
  timeout: number              // 超时时间（秒）
  backend: string              // 后端类型: "ollama" | "ark"
  enabled: boolean             // 是否启用
}

interface PromptTemplates {
  translation: string          // 翻译提示词（含 {input} 占位符）
  analysis: string             // 解析提示词
  scenery: string              // 场景文章生成提示词
}

interface EnvVar {
  name: string                 // 环境变量名
  description: string          // 描述说明
}

interface AppSettings {
  theme: string
  readingFontSize: number
  cellWidthRatio: number
  translation: TranslationSettings
  promptTemplates: PromptTemplates
  customModels: CustomModel[]
  recentFiles: string[]
  envVars: EnvVar[]
}
```

### 2.5 状态管理接口

```typescript
interface NotebookStore {
  // 状态
  openFiles: Map<string, NotebookFile>
  activeFilePath: string | null
  selectedIndices: Set<number>
  notebook: NotebookFile
  openFileCount: number

  // 文件管理
  openFile(file: NotebookFile): void
  closeFile(key: string): void
  switchToFile(key: string): void
  setNotebook(notebook: NotebookFile): void
  setCells(cells: NotebookCell[]): void
  setFilePath(path: string | null): void
  setModified(modified: boolean): void

  // 选择管理
  selectCell(index: number): void
  selectCellRange(from: number, to: number): void
  toggleCellSelection(index: number): void
  clearSelection(): void

  // 单元格内容操作（纯状态更新）
  updateCellContent(index: number, content: string): void
  updateCellOutput(index: number, output: string): void
}

> **注意**: 单元格的增/删/改/复制/合并/拆分/折叠/从属等操作已迁移到 `CellService`，通过 `useCellService()` Hook 使用。notebookStore 仅保留纯状态操作方法。

interface ThemeStore {
  theme: 'light' | 'dark'
  colors: ThemeConfig
  setTheme(theme: 'light' | 'dark'): void
  getColors(): ThemeConfig
}

interface WorkspaceStore {
  workspacePath: string | null
  workspaceFiles: FileEntry[]
  recentFiles: string[]
  sidebarActiveTab: string
  sidebarVisible: boolean
  panelVisible: boolean

  setWorkspace(path: string | null): void
  scanWorkspaceFiles(): Promise<void>
  addRecentFile(path: string): void
  setSidebarTab(tabId: string): void
  toggleSidebar(): void
  togglePanel(): void
  refreshFiles(): Promise<void>
}

interface SettingStore {
  readingFontSize: number
  cellWidthRatio: number
  translation: TranslationSettings
  promptTemplates: PromptTemplates
  customModels: CustomModel[]
  envVars: EnvVar[]

  setReadingFontSize(size: number): void
  setCellWidthRatio(ratio: number): void
  setTranslation(settings: TranslationSettings): void
  setPromptTemplates(templates: PromptTemplates): void
  setCustomModels(models: CustomModel[]): void
  addCustomModel(model: CustomModel): void
  removeCustomModel(name: string): void
  setEnvVars(vars: EnvVar[]): void

  loadFromDisk(): Promise<void>
  saveToDisk(): Promise<void>
}
```

---

## 3. 文件工具 API (utils/fileUtils.ts)

### 3.1 parseNotebookFile

解析 .transnb 文件内容。

```typescript
function parseNotebookFile(content: string): NotebookData
```

**参数**:
- `content: string` - JSON 格式的文件内容

**返回值**:
- `NotebookData` - 解析后的笔记本数据（version + cells）

**兼容性**:
- 支持 v1.0 格式（自动填充缺失的 id/parentId/indentLevel 等字段）
- 支持 v2.0 格式（保留所有字段）
- 无效 JSON 返回空 `{ version: '2.0', cells: [] }`

### 3.2 serializeNotebookFile

序列化笔记本数据为 JSON 字符串。

```typescript
function serializeNotebookFile(cells: NotebookCell[]): string
```

**参数**:
- `cells: NotebookCell[]` - 单元格列表

**返回值**:
- `string` - 格式化后的 JSON 字符串（缩进 2 空格）

**输出格式**:
```json
{
  "version": "2.0",
  "cells": [
    {
      "type": "markdown",
      "content": "...",
      "output": "...",
      "id": "uuid-...",
      "parentId": null,
      "indentLevel": 0,
      "isCollapsed": false,
      "isInputCollapsed": false,
      "isOutputCollapsed": false
    }
  ]
}
```

### 3.3 splitTextIntoParagraphs

将文本按双换行分割为段落列表。

```typescript
function splitTextIntoParagraphs(text: string): string[]
```

**参数**:
- `text: string` - 原始文本

**返回值**:
- `string[]` - 非空段落列表（自动 trim）

**分割规则**:
- `\r\n` 统一转换为 `\n`
- 按 `\n\n+`（一个或多个空行）分割
- 过滤空白段落

---

## 4. 状态管理 API (store/)

### 4.1 useNotebookStore (notebookStore.ts)

使用 Zustand 创建的笔记本状态 Hook。所有单元格操作均通过此 Store 完成。

**导入**:
```typescript
import { useNotebookStore } from '@/store/notebookStore'
```

**用法示例**:
```typescript
const Component = () => {
  const { notebook, selectedIndices, selectCell } = useNotebookStore()
  const { insertBelow, deleteSelected, copyCell } = useCellService()

  // 选择单元格
  selectCell(0)

  // 在选中单元格下方插入（通过 CellService）
  insertBelow()

  // 删除选中单元格
  deleteSelected()

  // 获取当前选中索引
  const firstSelected = [...selectedIndices][0]
}
```

### 4.2 useWorkspaceStore (workspaceStore.ts)

工作区状态 Hook。

**导入**:
```typescript
import { useWorkspaceStore } from '@/store/workspaceStore'
```

**用法示例**:
```typescript
const Component = () => {
  const { workspacePath, workspaceFiles, setWorkspace } = useWorkspaceStore()

  // 打开新工作区
  setWorkspace('/path/to/workspace')

  // 文件列表会自动通过 scanWorkspaceFiles() 更新
}
```

### 4.3 useThemeStore (themeStore.ts)

主题状态 Hook。

**导入**:
```typescript
import { useThemeStore } from '@/store/themeStore'
```

**用法示例**:
```typescript
const Component = () => {
  const { theme, colors, setTheme } = useThemeStore()

  return (
    <div style={{ color: colors.foreground, backgroundColor: colors.background }}>
      Current theme: {theme}
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
    </div>
  )
}
```

### 4.4 useSettingStore (settingStore.ts)

应用设置状态 Hook，支持磁盘持久化。**所有 set* 方法通过 `debouncedSave()` 延迟 500ms 批量写入磁盘**，避免频繁 I/O。

**导入**:
```typescript
import { useSettingStore } from '@/store/settingStore'
```

**用法示例**:
```typescript
const Component = () => {
  const { readingFontSize, translation, setReadingFontSize, setTranslation } = useSettingStore()

  return (
    <div>
      <input
        type="range"
        value={readingFontSize}
        onChange={(e) => setReadingFontSize(Number(e.target.value))}
      />
      <span>{readingFontSize}px</span>
    </div>
  )
}
```

**默认设置值**:
```typescript
// 翻译配置
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

// 单元格宽度比例（默认 70%）
cellWidthRatio: 70

// 提示词模板
{
  translation: '请翻译{input}',
  analysis: '请解析{input}',
  scenery: '请完成一篇包含{input}的文章',
}
```

---

## 5. React Hooks API (hooks/)

### 5.1 useTheme

主题 Hook，将 ThemeConfig 映射为 CSS 变量。

```typescript
function useTheme(): {
  theme: 'light' | 'dark'
  colors: ThemeConfig
  setTheme: (theme: 'light' | 'dark') => void
  cssVars: React.CSSProperties  // CSS 变量对象
}
```

**CSS 变量映射**:

| CSS 变量 | 对应的 ThemeConfig 键 |
|----------|----------------------|
| `--foreground` | `colors.foreground` |
| `--background` | `colors.background` |
| `--editor-background` | `colors.editorBackground` |
| `--editor-foreground` | `colors.editorForeground` |
| `--border` | `colors.border` |
| `--sidebar-background` | `colors.sidebarBackground` |
| `--sidebar-header` | `colors.sidebarHeader` |
| `--sidebar-border` | `colors.sidebarBorder` |
| `--activity-bar-background` | `colors.activityBarBackground` |
| `--status-bar-background` | `colors.statusBarBackground` |
| `--status-bar-foreground` | `colors.statusBarForeground` |
| `--cell-background` | `colors.cellBackground` |
| `--cell-selected-background` | `colors.cellSelectedBackground` |
| `--cell-border` | `colors.cellBorder` |
| `--cell-output-background` | `colors.cellOutputBackground` |
| `--cell-output-border` | `colors.cellOutputBorder` |
| `--cell-gutter` | `colors.cellGutter` |
| `--toolbar-background` | `colors.toolbarBackground` |
| `--toolbar-hover` | `colors.toolbarHover` |
| `--primary-button` | `colors.primaryButton` |
| `--primary-button-hover` | `colors.primaryButtonHover` |
| `--scrollbar` | `colors.scrollbar` |
| `--panel-background` | `colors.panelBackground` |
| `--panel-border` | `colors.panelBorder` |

**用法示例**:
```typescript
const Component = () => {
  const { colors, cssVars } = useTheme()

  return (
    <div style={cssVars}>
      <div style={{ color: colors.foreground, backgroundColor: colors.background }}>
        Hello
      </div>
    </div>
  )
}
```

### 5.2 useKeyboard

键盘快捷键 Hook。在 AppShell 中调用一次，全局生效。

```typescript
function useKeyboard(): {
  shortcuts: KeyboardShortcut[]
}

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  action: () => void
  description: string
}
```

**已注册快捷键**:

| 快捷键 | 动作 | 方法 |
|--------|------|------|
| `Ctrl+N` | 在选中单元格下方插入 | `cellService.insertBelow()` |
| `Ctrl+Shift+A` | 在选中单元格上方插入 | `cellService.insertAbove()` |
| `Delete` | 删除选中单元格 | `cellService.deleteSelected()` |
| `Ctrl+D` | 复制当前单元格 | `cellService.copyCell(firstSelected)` |
| `Ctrl+M` | 合并选中单元格 | `cellService.mergeSelected()` |
| `Ctrl+F` | 切换从属关系 | `cellService.toggleDependency(firstSelected)` |
| `Ctrl+E` | 折叠/展开 | `cellService.toggleCollapse(firstSelected)` |
| `Ctrl+Q` | 折叠当前单元格原文区 | `cellService.toggleInputCollapse(firstSelected)` |
| `Ctrl+Shift+Q` | 全部折叠原文 | `cellService.toggleInputCollapseAll()` |
| `Ctrl+W` | 折叠当前单元格译文区 | `cellService.toggleOutputCollapse(firstSelected)` |
| `Ctrl+Shift+W` | 全部折叠译文 | `cellService.toggleOutputCollapseAll()` |
| `↑` | 上一个单元格 | `notebookStore.selectCell(index - 1)` |
| `↓` | 下一个单元格 | `notebookStore.selectCell(index + 1)` |
| `Shift+↑` | 向上范围选择 | `notebookStore.selectCellRange(current, current - 1)` |
| `Shift+↓` | 向下范围选择 | `notebookStore.selectCellRange(current, current + 1)` |

**注意**:
- 当焦点在 TipTap 编辑器、INPUT 或 TEXTAREA 内时，快捷键自动跳过，避免干扰文字编辑。
- 以下常见快捷键待添加（见 TODO.md 第 6 节）：`Ctrl+S` 保存、`Ctrl+Shift+S` 另存为、`Ctrl+O` 打开、`Ctrl+Shift+E` 切换编辑/阅读模式、`Ctrl+Enter` 翻译、`Ctrl+B` 切换侧边栏。

---

## 6. 主题系统 API (styles/themes.ts)

### 6.1 主题配置

```typescript
const lightTheme: ThemeConfig  // 浅色主题
const darkTheme: ThemeConfig   // 深色主题（默认）
```

**浅色主题关键色**:
```
foreground:  #333333
background:  #f5f5f5
cellBorder:  #1a73e8
cellSelectedBackground: #e8f4fd
primaryButton: #007acc
```

**深色主题关键色**:
```
foreground:  #d4d4d4
background:  #1e1e1e
cellBorder:  #0e639c
cellSelectedBackground: #264f78
primaryButton: #0e639c
```

---

## 7. 配置设置 API (electron/main.ts)

### 7.1 默认设置结构

```typescript
const defaultSettings = {
  theme: 'dark',
  readingFontSize: 14,
  cellWidthRatio: 70,
  translation: {
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
  },
  promptTemplates: {
    translation: '请翻译{input}',
    analysis: '请解析{input}',
    scenery: '请完成一篇包含{input}的文章',
  },
  customModels: [],
  recentFiles: [],
  envVars: [],
}
```

### 7.2 设置持久化

- **存储位置**: `{userData}/settings.json`
- **存储格式**: JSON，缩进 2 空格
- **自动保存目录**: `path.dirname(SETTINGS_PATH)` 不存在时自动创建

---

## 8. 典型调用流程

### 8.1 打开一个 .transnb 文件

```typescript
// 用户点击 Open 按钮
const api = window.electronAPI
if (!api) return

// 1. 打开文件对话框
const filePath = await api.openFileDialog()
if (!filePath) return

// 2. 读取文件内容
const content = await api.readFile(filePath)

// 3. 解析文件格式
const data = parseNotebookFile(content)

// 4. 提取文件名
const fileName = filePath.split(/[/\\]/).pop() || 'untitled.transnb'

// 5. 打开文件到编辑器
const notebookStore = useNotebookStore.getState()
notebookStore.openFile({
  path: filePath,
  name: fileName,
  isModified: false,
  cells: data.cells,
})

// 6. 记录最近文件
const workspaceStore = useWorkspaceStore.getState()
workspaceStore.addRecentFile(filePath)
```

### 8.2 保存文件

```typescript
const api = window.electronAPI
if (!api) return

const notebook = useNotebookStore.getState().notebook

if (notebook.path) {
  // 已有路径，直接保存
  const json = serializeNotebookFile(notebook.cells)
  await api.writeFile(notebook.path, json)
  useNotebookStore.getState().setModified(false)
} else {
  // 新文件，弹出另存为对话框
  const savePath = await api.saveFileDialog()
  if (!savePath) return
  const json = serializeNotebookFile(notebook.cells)
  await api.writeFile(savePath, json)
  useNotebookStore.getState().setFilePath(savePath)
  useNotebookStore.getState().setModified(false)
}
```

### 8.3 导入文本

```typescript
const api = window.electronAPI
if (!api) return

// 1. 打开导入对话框
const result = await api.openImportDialog()
if (!result) return

// 2. 按段落分割
const paragraphs = splitTextIntoParagraphs(result.content)

// 3. 创建单元格
const cells: NotebookCell[] = paragraphs.map((text) => ({
  id: crypto.randomUUID(),
  type: 'markdown',
  content: text,
  output: '',
  parentId: null,
  indentLevel: 0,
  isCollapsed: false,
  isInputCollapsed: false,
  isOutputCollapsed: false,
}))

// 4. 提取文件名
const name = result.filePath.split(/[/\\]/).pop()
  ?.replace(/\.(txt|md|html|htm)$/i, '') || 'imported'

// 5. 打开到编辑器
useNotebookStore.getState().openFile({
  path: null,
  name: `${name}.transnb`,
  isModified: true,
  cells,
})
```

### 8.4 编辑单元格内容

```typescript
// CellEditor onChange 回调
const handleChange = (newContent: string) => {
  const store = useNotebookStore.getState()
  store.updateCellContent(index, newContent)
}
// → 自动设置 isModified = true
// → StatusBar 显示 ● 修改标记
```

### 8.5 切换主题

```typescript
// 在 SettingsDialog 中
useThemeStore.getState().setTheme('light')
// → 所有使用 useTheme() 的组件自动重新渲染
// → CSS 变量更新
```

### 8.6 翻译单元格

```typescript
import { useTranslationService } from '@/hooks/useTranslationService'

const Component = () => {
  const { translateCell, translateAll, status, cancel, listProviders, setCurrentProvider } =
    useTranslationService()

  // 列出可用提供者并切换
  const providers = listProviders()
  setCurrentProvider('system_Ollama')

  // 翻译单个单元格（索引 0）
  const handleTranslate = async () => {
    await translateCell(0)
    // status 自动更新:
    // { state: 'idle' | 'translating' | 'error', progress: 0-100, ... }
  }

  // 翻译所有非空单元格
  const handleTranslateAll = async () => {
    await translateAll()
  }

  // 取消翻译
  const handleCancel = () => cancel()

  // 测试连接
  const testConnection = async () => {
    const ok = await testConnection('system_Ollama')
    console.log(ok ? '连接成功' : '连接失败')
  }

  return (
    <div>
      <button onClick={handleTranslate}>翻译选中</button>
      <button onClick={handleTranslateAll}>翻译全部</button>
      <button onClick={handleCancel}>取消</button>
      {status.state === 'translating' && <progress value={status.progress} max={100} />}
      {status.state === 'error' && <span>错误: {status.error}</span>}
    </div>
  )
}
```

---

## 9. 单元测试 API (tests/)

### 9.1 测试框架

- **框架**: Vitest
- **环境**: jsdom (通过 vitest.config.ts 配置)
- **辅助库**: @testing-library/jest-dom
- **配置文件**: [vitest.config.ts](file:///g:/program/QSDReader-All/newappsdediter/transnb/TSBook2/vitest.config.ts)

### 9.2 运行测试

```bash
npm run test        # 运行所有测试
npm run test:watch  # 监听模式
```

### 9.3 notebookStore 测试覆盖

| 测试用例 | 说明 |
|---------|------|
| 初始化 | 验证初始单元格数量和文件名是否正确 |
| 选择单元格 | `selectCell(0)` → selectedIndices 包含 0，size=1 |
| 更新内容 | `updateCellContent(0, 'Updated')` → content 更新，isModified=true |
| 多文件支持 | `openFile(nb2)` → openFileCount=2，notebook 切换 |
| 文件切换 | `switchToFile(path)` → notebook 恢复为目标文件数据 |
| 关闭文件 | `closeFile(key)` → openFileCount-1，切换到剩余文件 |

> **注意**: 单元格的增/删/复制/合并/拆分/折叠/从属等操作的测试已迁移至 `CellService` 的集成测试范畴（通过 `useCellService()` 测试）。

### 9.4 fileUtils 测试覆盖

| 测试用例 | 说明 |
|---------|------|
| 解析 v2.0 | 解析标准格式 |
| 迁移 v1.0 | 自动填充 v1.0 缺失字段 |
| 无效 JSON | 返回空数据 |
| 序列化 | 数据 → JSON，验证 version 和 cells |
| 分割段落 | 按双换行分割，过滤空段落 |

---

## 10. Electron 配置说明

### 10.1 BrowserWindow 配置

```typescript
new BrowserWindow({
  width: 1400,
  height: 900,
  minWidth: 800,
  minHeight: 600,
  title: 'TSBook2',
  webPreferences: {
    nodeIntegration: false,      // 禁用 Node.js 集成
    contextIsolation: true,      // 启用上下文隔离
    preload: path.join(__dirname, 'preload.js'),
  },
  show: false,                    // ready-to-show 后再显示
  backgroundColor: '#1e1e1e',     // 深色背景（加载时避免白闪）
})
```

### 10.2 开发/生产模式

```typescript
const isDev = !app.isPackaged

if (isDev) {
  // 开发模式: 加载 Vite dev server
  mainWindow.loadURL('http://localhost:5173')
  mainWindow.webContents.openDevTools()
} else {
  // 生产模式: 加载打包后的 dist/index.html
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
}
```

### 10.3 开发启动流程

```
tsc -p tsconfig.node.json        // 编译 Electron 主进程
    ↓
vite (开发服务器, port 5173)     // 启动 React 热更新
    ↓
wait-on (等待 Vite 就绪)         // 确保 Vite 启动完成
    ↓
electron .                       // 启动 Electron 窗口
```

开发脚本: `npm run electron:dev`

---

## 11. 服务层 API (services/)

服务层定义在 `src/services/` 目录下，包含三个核心服务接口及其实现。服务层位于业务组件和 Zustand Stores 之间，负责封装业务逻辑。

### 11.1 类型导出

```typescript
import type { FileService, CellService, TranslationService, TranslationStatus, ProviderInfo } from '@/services/types'
```

### 11.2 FileService

文件操作服务，封装了所有文件读写和对话框交互逻辑。

```typescript
interface FileService {
  /** 打开文件（可选指定路径，否则弹出对话框） */
  openFile(filePath?: string): Promise<void>

  /** 保存当前文件（已有路径直接保存，否则弹出另存为） */
  saveFile(): Promise<boolean>

  /** 另存为 */
  saveFileAs(): Promise<boolean>

  /** 导入文本文件（txt/md/html → 按段落分割为单元格） */
  importText(): Promise<void>

  /** 新建空白文件 */
  createFile(name?: string): Promise<void>

  /** 删除指定文件 */
  deleteFile(filePath: string): Promise<void>

  /** 重命名文件 */
  renameFile(oldPath: string, newName: string): Promise<void>
}
```

**实现**: `createFileService()` (服务层) / `useFileService()` (React Hook)
**依赖**: notebookStore, workspaceStore, window.electronAPI
**位置**: `src/services/fileService.ts` / `src/hooks/useFileService.ts`

### 11.3 CellService

单元格操作服务，封装了所有单元格编辑操作（增/删/改/复制/合并/拆分/折叠/从属）。

```typescript
interface CellService {
  /** 在选中单元格下方插入新单元格 */
  insertBelow(): void

  /** 在选中单元格上方插入新单元格 */
  insertAbove(): void

  /** 删除所有选中单元格 */
  deleteSelected(): void

  /** 复制指定索引的单元格（插入到其后方） */
  copyCell(index: number): void

  /** 拆分单元格为两个（beforeText 保留，afterText 成为新单元格） */
  splitCell(index: number, beforeText: string, afterText: string): void

  /** 合并选中单元格（内容/译文合并） */
  mergeSelected(): void

  /** 移动单元格（从 fromIndex 到 toIndex） */
  moveCell(from: number, to: number): void

  /** 切换单元格折叠状态 */
  toggleCollapse(index: number): void
  toggleInputCollapse(index: number): void
  toggleOutputCollapse(index: number): void

  /** 批量切换折叠状态 */
  toggleInputCollapseAll(): void
  toggleOutputCollapseAll(): void

  /** 切换从属关系（子→父 / 取消从属） */
  toggleDependency(index: number): void

  /** 设置单元格子父关系 */
  setDependent(childIndex: number, parentIndex: number): void

  /** 移除单元格从属关系 */
  removeDependency(index: number): void

  /** 更新单元格原文内容 */
  updateContent(index: number, content: string): void

  /** 更新单元格译文内容 */
  updateOutput(index: number, output: string): void
}
```

**实现**: `createCellService()` (服务层) / `useCellService()` (React Hook)
**依赖**: notebookStore
**位置**: `src/services/cellService.ts` / `src/hooks/useCellService.ts`

### 11.4 TranslationService

翻译服务，管理翻译流程和翻译提供者。

```typescript
interface TranslationStatus {
  state: 'idle' | 'translating' | 'error'
  currentIndex: number       // 当前翻译的单元格索引
  totalCount: number         // 待翻译总数
  progress: number           // 进度 0-100
  error: string | null       // 错误信息
}

interface ProviderInfo {
  id: string                 // 提供者唯一标识
  name: string               // 显示名称
  type: 'system' | 'custom' // 系统内置 / 用户自定义
  backend: string            // 后端类型: ollama | openai | ark
}

interface TranslationService {
  /** 列出所有可用翻译提供者 */
  listProviders(): ProviderInfo[]

  /** 设置当前翻译提供者 */
  setCurrentProvider(providerId: string): void

  /** 翻译单个单元格 */
  translateCell(index: number): Promise<void>

  /** 翻译所有非空单元格 */
  translateAll(): Promise<void>

  /** 翻译指定索引列表的单元格 */
  translateCells(indices: number[]): Promise<void>

  /** 测试指定提供者的连接 */
  testConnection(providerId: string): Promise<boolean>

  /** 获取当前翻译状态 */
  getStatus(): TranslationStatus

  /** 取消正在进行的翻译 */
  cancel(): void

  /** 预留接口：供背诵模块生成场景文章 */
  generateSceneText(words: string[], promptTemplate?: string): Promise<string>
}
```

**实现**: `createTranslationService()` (服务层) / `useTranslationService()` (React Hook)
**依赖**: notebookStore, settingStore, translation/providers
**位置**: `src/services/translationService.ts` / `src/hooks/useTranslationService.ts`

---

## 12. 翻译服务 API (translation/)

翻译模块采用策略模式设计，定义在 `src/translation/` 目录下。

### 12.1 TranslationProvider 接口

```typescript
interface TranslationProvider {
  readonly id: string
  readonly name: string
  readonly type: 'system' | 'custom'
  readonly backend: string

  /** 执行翻译 */
  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>

  /** 测试与后端的连接是否正常 */
  testConnection(): Promise<boolean>

  /** 获取提供者元信息 */
  getInfo(): ProviderInfo
}
```

### 12.2 OllamaProvider

本地 Ollama 服务提供者（系统内置）。

```typescript
class OllamaProvider implements TranslationProvider {
  readonly id = 'system_Ollama'
  readonly name = 'Ollama (Local)'
  readonly type = 'system'
  readonly backend = 'ollama'

  constructor(config?: Partial<OllamaConfig>)

  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

**OllamaConfig**:
```typescript
interface OllamaConfig {
  baseUrl: string   // 默认 http://localhost:11434
  model: string     // 默认 qwen2.5:0.5b
  timeout: number   // 默认 30s
}
```

**测试连接**: 调用 `GET /api/tags` 检测服务是否可用。

### 12.3 OpenAIProvider

OpenAI 兼容 API 提供者（系统内置）。

```typescript
class OpenAIProvider implements TranslationProvider {
  readonly id = 'system_OpenAI'
  readonly name = 'OpenAI Compatible'
  readonly type = 'system'
  readonly backend = 'openai'

  constructor(config?: Partial<OpenAIConfig>)

  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

**OpenAIConfig**:
```typescript
interface OpenAIConfig {
  baseUrl: string    // 默认 https://api.openai.com/v1
  model: string      // 默认 gpt-3.5-turbo
  apiKeyEnv: string  // API Key 环境变量名，默认 OPENAI_API_KEY
  timeout: number    // 默认 60s
  proxy: string      // 代理地址（可选）
}
```

**API Key 解析**: 通过 `resolveApiKey()` 从 `process.env` 读取，settings.json 仅存储环境变量名。

### 12.4 ArkProvider

火山引擎 Ark 提供者（用户自定义，通过 ProviderFactory 创建）。

```typescript
class ArkProvider implements TranslationProvider {
  readonly id = 'custom_{name}'
  readonly name = '自定义: {name}'
  readonly type = 'custom'
  readonly backend = 'ark'

  constructor(name: string, config?: Partial<ArkConfig>)

  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

**ArkConfig**:
```typescript
interface ArkConfig {
  endpoint: string    // 默认 https://ark.cn-beijing.volces.com/api/v3
  model: string       // 推理接入点 ID
  apiKeyEnv: string   // API Key 环境变量名，默认 ARK_API_KEY
  timeout: number     // 默认 120s
}
```

### 12.5 ProviderFactory

提供者工厂函数（`src/translation/providerFactory.ts`）。

```typescript
/** 根据自定义模型配置构建提供者（ark → ArkProvider，其他 → OllamaProvider） */
function buildProvider(model: CustomModelConfig): TranslationProvider

/** 创建系统内置提供者列表（OllamaProvider + OpenAIProvider） */
function createSystemProviders(): TranslationProvider[]

/** 根据用户自定义模型列表创建自定义提供者（仅包含 enabled=true 的模型） */
function createCustomProviders(customModels: CustomModelConfig[]): TranslationProvider[]
```

**CustomModelConfig**:
```typescript
interface CustomModelConfig {
  name: string
  apiKeyEnv: string
  endpoint: string
  model: string
  timeout: number
  backend: string     // "ollama" | "ark"
  enabled: boolean
}
```

### 12.6 useTranslationService Hook

React Hook 封装，提供响应式的翻译服务访问。

```typescript
function useTranslationService(): {
  status: TranslationStatus           // 响应式状态，通过 useState + 200ms 轮询同步
  translateCell(index: number): Promise<void>
  translateAll(): Promise<void>
  testConnection(providerId: string): Promise<boolean>
  cancel(): void
  listProviders(): ProviderInfo[]
  setCurrentProvider(providerId: string): void
}
```

**翻译状态实时同步**: `status` 通过 `useState` + 200ms `setInterval` 轮询 TranslationService 内部状态（字段级深度比较避免不必要渲染），React 组件在状态变更时自动重新渲染。

---

## 13. 代码风格与约定

- **组件命名**: PascalCase（如 `CellContainer`, `NotebookEditor`）
- **文件命名**: camelCase（如 `notebookStore.ts`, `useKeyboard.ts`）
- **状态管理**: 使用 `use` 前缀的 Hook 获取 store（如 `useNotebookStore`）
- **服务层**: 接口定义在 `services/types.ts`，实现使用 `create*Service()` 工厂函数，React Hook 封装使用 `use*Service()` 命名
- **类型文件**: 全局类型在 `types/notebook.ts`，翻译相关类型在 `translation/types.ts`
- **样式**: 使用 React inline styles + ThemeConfig，避免 CSS 文件扩散
- **路径别名**: `@/` 映射到 `src/`（通过 tsconfig.json + vite.config.ts 配置）
