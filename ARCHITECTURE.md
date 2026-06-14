# TSBook2 软件架构文档

## 1. 项目概述

TSBook2 是"翻译笔记本"(TransNb)的 TypeScript/React 重构版本。原项目基于 PyQt5 构建，TSBook2 采用 Electron + React + TypeScript 技术栈重新实现，继承了核心的单元格笔记本编辑和翻译功能，采用 VS Code 风格的 IDE 式 UI 布局，提供更好的跨平台体验和现代化前端开发流程。

### 核心理念

- **IDE 式布局**: 采用类似 VS Code 的活动栏(ActivityBar)、侧边栏(Sidebar)、编辑器区域和状态栏(StatusBar)布局
- **状态管理集中化**: 使用 Zustand 统一管理应用状态，替代原项目的 Qt 信号/槽机制
- **组件化架构**: 所有 UI 元素均为 React 函数组件，支持灵活组合和复用
- **层级无关的文件格式**: 继承原项目的 .transnb v2.0 文件格式，支持单元格父子从属关系

### 技术栈

| 技术 | 用途 |
|------|------|
| **Electron 33** | 桌面应用框架，提供原生窗口、文件系统、对话框 API |
| **React 19** | UI 框架 |
| **TypeScript** | 类型安全 |
| **Vite 6** | 前端构建工具和开发服务器 |
| **Zustand 5** | 轻量级状态管理 |
| **TipTap 2** | 富文本编辑器（单元格原文编辑） |
| **marked** | Markdown 渲染（单元格译文阅读模式） |
| **better-sqlite3** | SQLite 数据库（背诵模式数据持久化） |
| **Vitest** | 单元测试框架 |
| **electron-builder** | 应用打包 |

### 与原项目(TransNb)对比

| 维度 | TransNb (PyQt5) | TSBook2 (Electron + React) |
|------|-----------------|---------------------------|
| 技术栈 | Python + PyQt5 + httpx | TypeScript + React + Electron |
| 状态管理 | Qt 信号/槽机制 | Zustand 状态管理 |
| UI 渲染 | Qt Widgets | React DOM + CSS |
| Markdown 编辑 | 自实现 ClickableTextEdit | TipTap 富文本编辑器 |
| 翻译引擎 | Python async httpx + SDK | 已实现 (fetch API + Provider 策略模式) |
| 背诵系统 | 完整实现 (SQLite + Ebbinghaus) | 待实现 |
| 文件格式 | .transnb JSON (v1.0/v2.0) | .transnb JSON (v2.0 兼容) |
| 主题系统 | Qt 样式表 + 颜色字典 | CSS 变量 + ThemeConfig |
| 构建工具 | 无 (Python 直接运行) | Vite + electron-builder |

---

## 2. 系统架构

### 2.1 整体架构图

```
TSBook2 应用
├── Electron 主进程 (electron/)
│   ├── main.ts           # 窗口管理 + IPC 处理
│   ├── preload.ts        # 上下文桥接 (contextBridge)
│   └── recitation/       # 背诵模式数据层
│       ├── database.ts       # SQLite 数据库管理 (better-sqlite3)
│       ├── bookDAL.ts        # 词书数据访问层
│       ├── wordDAL.ts        # 单词数据访问层
│       ├── userStudyDAL.ts   # 学习记录数据访问层
│       ├── statDAL.ts        # 统计数据访问层
│       ├── recitationDAL.ts  # DAL 组合层
│       ├── ebbinghaus.ts     # 艾宾浩斯遗忘曲线算法
│       ├── bookImporter.ts   # KyleBing 格式词书导入器
│       ├── bookService.ts    # 词书管理服务
│       └── studyService.ts   # 学习服务
├── React 渲染进程 (src/)
│   ├── 入口层
│   │   ├── main.tsx      # ReactDOM 渲染入口
│   │   ├── App.tsx       # 根组件 (主题初始化 + 设置加载)
│   │   └── index.html    # HTML 入口
│   ├── 布局层 (components/layout/)
│   │   ├── AppShell.tsx  # 应用外壳 (组合所有布局组件)
│   │   ├── ActivityBar.tsx  # 活动栏 (VS Code 风格)
│   │   ├── Sidebar.tsx   # 侧边栏
│   │   ├── Panel.tsx     # 底部面板
│   │   └── StatusBar.tsx # 状态栏
│   ├── 业务组件层
│   │   ├── notebook/     # 笔记本组件
│   │   │   ├── NotebookEditor.tsx   # 笔记本编辑器主区域
│   │   │   └── NotebookToolbar.tsx  # 笔记本工具栏
│   │   ├── cells/        # 单元格组件
│   │   │   ├── CellContainer.tsx    # 单元格容器 (布局外壳)
│   │   │   ├── CellEditor.tsx       # 单元格原文编辑器
│   │   │   ├── CellOutput.tsx       # 单元格译文输出
│   │   │   ├── CellToolbar.tsx      # 单元格操作工具栏
│   │   │   └── CellCollapseIndicator.tsx  # 折叠指示器
│   │   ├── file/         # 文件浏览组件
│   │   │   └── FileExplorer.tsx     # 文件浏览器
│   │   └── settings/     # 设置组件
│   │       └── SettingsDialog.tsx   # 设置对话框
│   ├── 服务层 (services/)
│   │   ├── types.ts              # 服务层接口定义
│   │   ├── index.ts              # 统一导出
│   │   ├── fileService.ts        # 文件操作服务
│   │   ├── cellService.ts        # 单元格操作服务
│   │   └── translationService.ts # 翻译服务
│   ├── 翻译模块 (translation/)
│   │   ├── types.ts              # TranslationProvider 接口
│   │   ├── providerFactory.ts    # 提供者工厂
│   │   └── providers/
│   │       ├── ollama.ts         # Ollama 提供者
│   │       ├── openai.ts         # OpenAI 兼容提供者
│   │       └── ark.ts            # 火山引擎 Ark 提供者
│   ├── 背诵模块 (recitation/)
│   │   ├── types.ts              # 数据模型类型定义
│   │   └── index.ts              # 统一导出
│   ├── 状态管理层 (store/)
│   │   ├── notebookStore.ts    # 笔记本数据状态 (Zustand)
│   │   ├── workspaceStore.ts   # 工作区状态 (Zustand)
│   │   ├── themeStore.ts       # 主题状态 (Zustand)
│   │   └── settingStore.ts     # 设置状态 (Zustand + 持久化)
│   ├── 工具层
│   │   ├── utils/fileUtils.ts       # 文件序列化/解析工具
│   │   ├── hooks/useKeyboard.ts     # 键盘快捷键 Hook
│   │   ├── hooks/useTheme.ts        # 主题 Hook (CSS 变量)
│   │   ├── hooks/useFileService.ts  # 文件操作服务 Hook
│   │   ├── hooks/useCellService.ts  # 单元格操作服务 Hook
│   │   ├── hooks/useTranslationService.ts # 翻译服务 Hook
│   │   └── hooks/useRecitationService.ts # 背诵服务 Hook
│   ├── 类型定义 (types/)
│   │   └── notebook.ts    # 全局 TypeScript 类型定义
│   └── 样式 (styles/)
│       ├── global.css     # 全局样式 (TipTap, 滚动条)
│       └── themes.ts      # 主题颜色配置 (light/dark)
└── 测试 (tests/)
    ├── store/             # 状态管理测试
    │   ├── notebookStore.test.ts
    │   └── themeStore.test.ts
    ├── components/        # 组件测试
    │   └── fileUtils.test.ts
    └── setup.ts           # 测试配置
```

### 2.2 进程架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│                      (electron/main.ts)                      │
│                                                             │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │  Window Mgmt │  │          IPC Handlers               │  │
│  │  - create() │  │  - read-file / write-file            │  │
│  │  - loadURL()│  │  - file-exists / delete-file         │  │
│  │  - menu     │  │  - rename-file                       │  │
│  │             │  │  - open-file-dialog / save-file-dialog│  │
│  │             │  │  - open-folder-dialog                 │  │
│  │             │  │  - open-import-dialog                 │  │
│  │             │  │  - read-directory / recursive         │  │
│  │             │  │  - get-settings / set-settings        │  │
│  └─────────────┘  └──────────────────────────────────────┘  │
│                           │                                  │
│                    preload.ts (contextBridge)                 │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │ IPC (invoke/handle)
┌───────────────────────────┼──────────────────────────────────┐
│                    Renderer Process                          │
│                                                             │
│  window.electronAPI (类型安全桥接)                            │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  React Application                                      ││
│  │                                                         ││
│  │  AppShell (布局容器)                                     ││
│  │  ├── ActivityBar (活动栏)                                ││
│  │  ├── Sidebar > FileExplorer (文件浏览器)                 ││
│  │  ├── NotebookToolbar (工具栏)                            ││
│  │  ├── NotebookEditor (编辑器区域)                         ││
│  │  │   └── CellContainer[] (单元格列表)                    ││
│  │  │       ├── CellToolbar (操作按钮)                      ││
│  │  │       ├── CellEditor (原文编辑 - TipTap)              ││
│  │  │       ├── CellOutput (译文渲染 - Marked)              ││
│  │  │       └── CellCollapseIndicator (折叠)                ││
│  │  ├── Panel (底部面板)                                    ││
│  │  └── StatusBar (状态栏)                                  ││
│  │                                                         ││
│  │  Service Layer (业务逻辑层)                               ││
│  │  ├── useFileService (文件打开/保存/导入)                  ││
│  │  ├── useCellService (单元格增/删/改/复制/合并/折叠)       ││
│  │  └── useTranslationService (翻译/测试连接/提供者管理)     ││
│  │                                                         ││
│  │  Zustand Stores (全局状态)                               ││
│  │  ├── useNotebookStore (单元格/文件/选择状态)             ││
│  │  ├── useWorkspaceStore (工作区/侧边栏状态)              ││
│  │  ├── useThemeStore (主题状态)                            ││
│  │  └── useSettingStore (应用设置 + 持久化)                ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 核心模块详解

### 3.1 Electron 主进程 (electron/)

#### main.ts

**职责**:
- 管理 BrowserWindow 创建和生命周期
- 注册所有 IPC 处理器 (handle)
- 管理应用设置文件的读写 (userData/settings.json)
- 提供文件系统操作接口 (读/写/删除/重命名/目录遍历)

**IPC 处理器清单**:

**文件操作通道**:

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `read-file` | `filePath: string` | `string` | 读取文件内容 |
| `write-file` | `filePath: string, content: string` | `boolean` | 写入文件 |
| `file-exists` | `filePath: string` | `boolean` | 检查文件存在 |
| `delete-file` | `filePath: string` | `boolean` | 删除文件 |
| `rename-file` | `oldPath, newPath` | `boolean` | 重命名文件 |
| `open-file-dialog` | 无 | `string \| null` | 打开文件选择对话框 (.transnb) |
| `save-file-dialog` | 无 | `string \| null` | 保存文件对话框 |
| `open-folder-dialog` | 无 | `string \| null` | 选择文件夹对话框 |
| `open-import-dialog` | 无 | `ImportResult \| null` | 导入文本文件对话框 |
| `read-directory` | `dirPath: string` | `FileEntry[]` | 读取目录（过滤 .transnb） |
| `read-directory-recursive` | `dirPath: string` | `DirEntry[]` | 递归目录遍历 |
| `get-settings` | 无 | `Record<string, unknown>` | 读取设置文件 |
| `set-settings` | `settings` | `boolean` | 保存设置文件 |

**背诵模式通道 (recitation:*)**: (已实现，参见 [RECITATION_DATA_LAYER.md](file:///g:/program/TSBook2/RECITATION_DATA_LAYER.md) 第 4 章)

| 通道 | 说明 |
|------|------|
| `recitation:init` | 初始化工作区数据库 |
| `recitation:add-book` | 添加词书 |
| `recitation:get-book-by-id` | 查询单个词书 |
| `recitation:get-all-books` | 获取所有词书 |
| `recitation:delete-book` | 删除词书 |
| `recitation:get-book-progress` | 获取词书进度 |
| `recitation:get-all-books-with-progress` | 获取所有词书及进度 |
| `recitation:import-book-from-file` | 从 JSON 文件导入词书 |
| `recitation:get-words-by-book` | 获取词书所有单词 |
| `recitation:get-unstudied-words` | 获取未学单词 |
| `recitation:get-words-for-review` | 获取待复习单词 |
| `recitation:search-words` | 搜索单词 |
| `recitation:start-study-word` | 开始学习单词 |
| `recitation:review-word` | 复习单词 |
| `recitation:get-config` | 获取完整配置 |
| `recitation:set-config` | 设置配置项 |
| `recitation:get-today-words` | 获取今日单词 |
| `recitation:refresh-today-words` | 强制刷新今日单词 |

**安全设计**:
- `nodeIntegration: false`: 禁用渲染进程的 Node.js 集成
- `contextIsolation: true`: 启用上下文隔离
- 通过 preload.ts 的 `contextBridge.exposeInMainWorld` 暴露有限 API

#### preload.ts

**职责**:
- 通过 `contextBridge.exposeInMainWorld('electronAPI', {...})` 暴露类型安全的 API 对象
- 所有文件操作均包装为 IPC invoke 调用

**暴露的 API 类型** (定义在 `types/notebook.ts`):
```typescript
interface Window {
  electronAPI?: {
    readFile, writeFile, fileExists, deleteFile, renameFile,
    openFileDialog, saveFileDialog, openFolderDialog, openImportDialog,
    readDirectory, readDirectoryRecursive,
    getSettings, setSettings,
    onMenuAction,
    recitationAPI: {                              // 背诵模式 API
      init, addBook, getBookById, getAllBooks,
      deleteBook, getBookProgress, getAllBooksWithProgress,
      importBookFromFile,
      getWordsByBook, getUnstudiedWords, getWordsForReview, searchWords,
      startStudyWord, reviewWord,
      getConfig, setConfig,
      getTodayWords, refreshTodayWords,
    }
  }
}
```

---

### 3.2 状态管理层 (store/)

TSBook2 使用 Zustand 管理四个独立的状态存储，替代了原项目中 Qt 信号/槽 + 手动事件传递的通信模式。

#### notebookStore.ts (核心状态)

**职责**:
- 管理笔记本数据（单元格列表、文件路径、修改状态）
- 管理多文件打开（`openFiles: Map<string, NotebookFile>`）
- 管理单元格选择状态（`selectedIndices: Set<number>`）

**重构简化**: 移除了约 28 个单元格编辑方法到服务层，保留了约 12 个纯状态操作。单元格的增/删/改/复制/合并/拆分/折叠/从属等复杂逻辑已委托给 `useCellService` 和 `useFileService`。

**状态结构**:
```typescript
interface NotebookStore {
  openFiles: Map<string, NotebookFile>  // 所有打开的文件
  activeFilePath: string | null         // 当前活动文件
  selectedIndices: Set<number>          // 选中单元格索引
  notebook: NotebookFile | null         // 当前文件数据快照
  openFileCount: number                 // 打开文件数
  // ...操作方法（仅保留纯状态操作，无业务逻辑）
}
```

**核心方法覆盖 (约 14 个纯状态方法)**:
- 文件管理: `openFile`, `closeFile`, `switchToFile`, `setNotebook`, `setCells`, `setFilePath`, `setModified`
- 选择管理: `selectCell`, `selectCellRange`, `toggleCellSelection`, `clearSelection`
- 单元格内容: `updateCellContent`, `updateCellOutput`
- 文件创建: `createEmptyNotebook`

> 单元格的增/删/复制/合并/拆分/折叠/从属等操作已迁移到 `CellService`，文件读写等 I/O 操作已迁移到 `FileService`。

**对比原项目**: 将原 CellManager 的信号/槽机制 + 数据持久化 + CellNode 树形结构合并为一个 Zustand store，简化了数据流。重构后进一步将业务逻辑委托给服务层，store 仅作为纯状态容器。

#### workspaceStore.ts

**职责**:
- 管理工作区路径和文件列表
- 管理侧边栏显示状态（可见性、活动标签页）
- 管理底部面板显示状态
- 管理最近打开文件列表

**状态结构**:
```typescript
interface WorkspaceStore {
  workspacePath: string | null
  workspaceFiles: FileEntry[]
  recentFiles: string[]
  sidebarActiveTab: string
  sidebarVisible: boolean
  panelVisible: boolean
}
```

#### themeStore.ts

**职责**:
- 管理当前主题（`'light' | 'dark'`）
- 提供当前主题的颜色配置

#### settingStore.ts

**职责**:
- 管理应用设置（翻译配置、提示词模板、自定义模型、环境变量、最近文件等）
- 支持从磁盘加载设置和保存到磁盘（通过 Electron IPC）

**状态字段**: `readingFontSize`, `cellWidthRatio`, `translation`, `promptTemplates`, `customModels`, `envVars`, `lastOpenFilePath`, `recentFiles`

**持久化策略**:
- 通过 `loadFromDisk()` / `saveToDisk()` 与 Electron 主进程交互
- 每次 `set*` 方法调用后通过 `debouncedSave()` 延迟 500ms 批量写入磁盘，避免频繁 I/O
- 应用关闭时可通过 `saveToDisk()` 强制立即保存

---

### 3.3 布局层 (components/layout/)

#### AppShell.tsx

**职责**:
- 组合所有布局组件
- 初始化键盘快捷键 Hook
- 定义全局布局结构（垂直: AppShell → ActivityBar+Sidebar+Content / StatusBar）

**布局结构**:
```
┌─────────────────────────────────────────────────┐
│  ┌──────┬──────────┬──────────────────────────┐  │
│  │      │          │  NotebookToolbar         │  │
│  │ Acti │ Sidebar  ├──────────────────────────┤  │
│  │ vity │ (280px)  │  NotebookEditor          │  │
│  │ Bar  │          │  (cell list)             │  │
│  │ 48px │          │                          │  │
│  │      │          ├──────────────────────────┤  │
│  │      │          │  Panel (200px, optional) │  │
│  ├──────┴──────────┴──────────────────────────┤  │
│  │  StatusBar (24px)                           │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

#### ActivityBar.tsx

**职责**:
- 显示活动图标（Explorer / Search / Settings）
- 切换侧边栏活动标签页
- 高亮当前活动项

#### Sidebar.tsx

**职责**:
- 根据 `sidebarActiveTab` 显示不同内容面板
- 宽度 280px，可拖动调整（min-width: 200px）

**支持的面板**:
- `explorer`: 文件浏览器 (FileExplorer)
- `search`: 搜索面板（预留）
- `settings`: 快捷键帮助面板

#### StatusBar.tsx

**职责**:
- 显示当前文件信息（文件名、修改状态）
- 显示单元格统计（总数、选中数）
- 显示编辑器语言、编码信息

#### Panel.tsx

**职责**:
- 底部面板容器（预留输出/问题面板）
- 高度 200px，最小 100px

---

### 3.4 笔记本编辑器组件 (components/notebook/)

#### NotebookEditor.tsx

**职责**:
- 核心编辑器区域，显示当前笔记本的单元格列表
- 渲染每个 `CellContainer` 组件
- 提供"添加单元格"按钮和滚动区域
- 单元格内部容器宽度通过 `cellWidthRatio` 设置项动态计算（`ResizeObserver` 监听容器宽度）
- `maxWidth = Math.max(400, containerWidth × cellWidthRatio / 100)`

**数据流**:
```
useNotebookStore → notebook.cells → CellContainer[]
useSettingStore → cellWidthRatio → 动态 maxWidth
```

#### NotebookToolbar.tsx

**职责**:
- 提供文件操作按钮（新建/打开/保存/另存为/导入文本）
- 删除选中单元格按钮
- 打开设置对话框按钮
- 显示当前文件状态

**文件操作流程**:
```
用户点击 → window.electronAPI 对话框 → readFile/writeFile → parse/serialize → notebookStore
```

---

### 3.5 单元格组件 (components/cells/)

#### CellContainer.tsx

**职责**:
- 单元格的布局容器
- 组合 CellToolbar + CellEditor + CellOutput + CellCollapseIndicator
- 处理选中状态和缩进样式
- 处理单元格选择事件（点击、Shift 范围选择）

**布局结构**:
```
┌─────────────────────────────────────────────┐
│  ┌────────┐                                 │
│  │ gutter │  CellToolbar (操作按钮行)        │
│  │ (16px) ├─────────────────────────────────┤
│  │        │  CellEditor (TipTap 原文编辑)    │
│  │        ├─ CellCollapseIndicator (折叠线)  │
│  │        │  CellOutput (译文渲染)           │
│  └────────┴─────────────────────────────────┘
```

#### CellEditor.tsx

**职责**:
- 使用 TipTap 富文本编辑器渲染原文内容（编辑模式）
- 阅读模式使用 `marked` 渲染 Markdown（与 CellOutput 样式统一）
- 支持编辑/阅读模式双击双向切换
- Escape 键退出编辑模式 → 阅读模式
- 支持 Placeholder 提示
- 字体大小从 `readingFontSize` 设置项读取
- 内容变化时触发 `updateCellContent`

#### CellOutput.tsx

**职责**:
- 使用 `marked` 库渲染译文 Markdown 内容
- 支持编辑/阅读模式双击双向切换
- Escape 键退出编辑模式 → 阅读模式（工具栏有文字提示）
- 提供 `.md-body` CSS 样式
- 字体大小从 `readingFontSize` 设置项读取

#### CellToolbar.tsx

**职责**:
- 提供单元格操作按钮（翻译/上移/下移/复制/删除/折叠）
- 根据单元格位置禁用边界操作

**按钮布局**: ▶ (翻译) | ↑ (上移) | ↓ (下移) | ⧉ (复制) | ✕ (删除) | ▼ (折叠)

#### CellCollapseIndicator.tsx

**职责**:
- 可点击的折叠分隔线
- 显示在 CellEditor 和 CellOutput 之间
- 双击触发折叠/展开

---

### 3.6 文件浏览器 (components/file/)

#### FileExplorer.tsx

**职责**:
- 浏览工作区中的 .transnb 文件
- 支持目录展开/折叠
- 文件右键菜单（重命名/删除）
- 显示打开的文件列表（OPEN EDITORS）
- 提供新建文件、导入文本、刷新功能

**数据流**:
```
workspaceStore → workspaceFiles → 文件树渲染
                    ↓
electronAPI.readDirectory → 目录内容
```

---

### 3.7 设置对话框 (components/settings/)

#### SettingsDialog.tsx

**职责**:
- 模态设置对话框，包含四个标签页
- **General**: 主题切换、字号调整、环境变量查看
- **Translation**: 翻译启用/禁用、默认提供者选择、Ollama/OpenAI 配置
- **Prompts**: 提示词模板编辑（翻译/解析/场景）
- **Models**: 自定义模型管理（添加/删除 Ollama/Ark 模型）

**标签页结构**:
```
SettingsDialog
├── General     → theme, readingFontSize, cellWidthRatio, envVars
├── Translation → enabled, provider, ollama, openai
├── Prompts     → translation, analysis, scenery templates
└── Models      → customModels CRUD
```

---

### 3.8 工具层

#### utility/fileUtils.ts

**职责**:
- 文件格式解析: `parseNotebookFile(content)` → NotebookData
- 文件格式序列化: `serializeNotebookFile(cells)` → JSON string
- 文本分割: `splitTextIntoParagraphs(text)` → paragraphs

**兼容性**:
- 支持解析 v1.0 格式（无 id/parentId/indentLevel）
- 输出始终为 v2.0 格式

#### hooks/useKeyboard.ts

**职责**:
- 注册全局键盘快捷键
- 自动跳过编辑状态（TipTap/INPUT/TEXTAREA）

**快捷键映射**:

| 快捷键 | 动作 |
|--------|------|
| `Ctrl+N` | 在当前单元格下方插入 |
| `Ctrl+Shift+A` | 在当前单元格上方插入 |
| `Delete` | 删除选中单元格 |
| `Ctrl+D` | 复制当前单元格 |
| `Ctrl+M` | 合并选中单元格 |
| `Ctrl+F` | 切换从属关系 |
| `Ctrl+E` | 折叠/展开 |
| `Ctrl+Q` | 折叠当前单元格原文区 |
| `Ctrl+Shift+Q` | 全部折叠原文 |
| `Ctrl+W` | 折叠当前单元格译文区 |
| `Ctrl+Shift+W` | 全部折叠译文 |
| `↑/↓` | 上下导航 |
| `Shift+↑/↓` | 范围选择 |

> **待添加的快捷键** (详见 [TODO.md](file:///g:/program/TSBook2/TODO.md) 第 6 节): `Ctrl+S` 保存, `Ctrl+Shift+S` 另存为, `Ctrl+O` 打开, `Ctrl+Shift+E` 切换编辑/阅读模式, `Ctrl+Enter` 翻译, `Ctrl+Shift+Enter` 翻译全部, `Ctrl+B` 切换侧边栏, `Ctrl+J` 切换底部面板。

#### hooks/useTheme.ts

**职责**:
- 将 ThemeConfig 映射为 CSS 变量
- 提供主题切换和颜色获取

#### hooks/useRecitationService.ts

**职责**:
- 封装背诵模式服务的 React Hook
- 通过 `createRecitationService()` 工厂函数创建服务实例
- 使用 `useMemo` 确保服务实例在组件生命周期内保持单例

**依赖**: `window.electronAPI.recitationAPI` (IPC 桥接)

---

### 3.9 类型系统 (types/)

#### notebook.ts

**核心类型**:

```typescript
NotebookCell    // 单元格数据
NotebookData    // 文件格式
NotebookFile    // 文件元数据
NotebookStore   // 笔记本状态接口
ThemeConfig     // 主题配置（34 个颜色键）
ThemeStore      // 主题状态接口
TranslationSettings  // 翻译配置
CustomModel     // 自定义模型
AppSettings     // 应用设置
WorkspaceStore  // 工作区状态接口
FileEntry       // 文件条目
DirEntry        // 目录条目
ImportResult    // 导入结果
Window.electronAPI  // Electron API 桥接类型
```

---

### 3.10 主题系统 (styles/)

#### themes.ts

**职责**:
- 定义浅色/深色两套完整主题色
- 34 个颜色键，覆盖 UI 所有部分

**主题键分类**:

| 类别 | 键 |
|------|----|
| 基础色 | foreground, background, border |
| 编辑器 | editorBackground, editorForeground |
| 侧边栏 | sidebarBackground, sidebarHeader, sidebarBorder |
| 活动栏 | activityBarBackground, activityBarForeground, activityBarActiveBorder |
| 状态栏 | statusBarBackground, statusBarForeground |
| 单元格 | cellBackground, cellSelectedBackground, cellBorder |
| 译文区 | cellOutputBackground, cellOutputBorder |
| 工具栏 | toolbarBackground, toolbarHover |
| 按钮 | primaryButton, primaryButtonHover |
| 错误 | errorBackground, errorBorder, errorText |
| 输入 | inputBackground, inputBorder |
| 面板 | panelBackground, panelBorder |
| 列表 | listItemHover, listItemSelected |
| 其他 | cellGutter, scrollbar |

#### global.css

**职责**:
- 全局样式重置
- 自定义滚动条样式
- TipTap 编辑器样式（标题/段落/列表/引用/代码块/行内代码）
- CSS 变量引用（通过 `var(--scrollbar)` 等）

---

### 3.11 服务层详解 (services/)

服务层位于业务组件和 Zustand Stores 之间，职责是将业务逻辑（如文件读写、单元格编辑操作、翻译流程）从组件中剥离，封装为可测试的服务接口。组件通过 React Hooks 消费这些服务。

#### 服务接口定义 (services/types.ts)

```typescript
interface FileService {
  openFile(filePath?: string): Promise<void>
  saveFile(): Promise<boolean>
  saveFileAs(): Promise<boolean>
  importText(): Promise<void>
  createFile(name?: string): Promise<void>
  deleteFile(filePath: string): Promise<void>
  renameFile(oldPath: string, newName: string): Promise<void>
}

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

interface TranslationService {
  listProviders(): ProviderInfo[]
  setCurrentProvider(providerId: string): void
  translateCell(index: number): Promise<void>
  translateAll(): Promise<void>
  translateCells(indices: number[]): Promise<void>
  testConnection(providerId: string): Promise<boolean>
  getStatus(): TranslationStatus
  cancel(): void
  generateSceneText(words: string[], promptTemplate?: string): Promise<string>
}
```

#### 服务实现

| 服务 | 工厂函数 | React Hook | 依赖 |
|------|---------|-----------|------|
| FileService | `createFileService()` | `useFileService()` | notebookStore, workspaceStore, electronAPI |
| CellService | `createCellService()` / `useCellService()` | `useCellService()` | notebookStore |
| TranslationService | `createTranslationService()` | `useTranslationService()` | notebookStore, settingStore, translation/providers |

#### 设计原则

1. **接口与实现分离**: `services/types.ts` 定义纯接口，具体实现在各服务文件中
2. **组合而非继承**: 服务通过组合 Zustand store 和工具函数实现
3. **可选 Hook 封装**: `create*Service()` 工厂函数可在非 React 环境使用，`use*Service()` Hook 为 React 组件提供便利
4. **单一职责**: 每个服务聚焦一个业务领域（文件、单元格、翻译）

### 3.12 翻译模块详解 (translation/)

翻译模块采用策略模式设计，提供统一的 `TranslationProvider` 接口和多个实现。

#### TranslationProvider 接口

```typescript
interface TranslationProvider {
  readonly id: string
  readonly name: string
  readonly type: 'system' | 'custom'
  readonly backend: string

  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

#### 内置提供者

| 提供者 | ID | 后端类型 | 说明 |
|--------|----|---------|------|
| `OllamaProvider` | `system_Ollama` | system | 本地 Ollama 服务，默认模型 qwen2.5:0.5b |
| `OpenAIProvider` | `system_OpenAI` | system | OpenAI 兼容 API，支持代理配置 |
| `ArkProvider` | `custom_{name}` | custom | 火山引擎 Ark，通过 ProviderFactory 动态创建 |
| `OpenAIProvider (自定义)` | `custom_{name}` | custom | OpenAI 兼容 API，作为自定义模型使用 |

各提供者从环境变量或 `settingStore.envVars` 读取 API Key（通过 `resolveApiKey()`），settings.json 中仅存储环境变量名，保证密钥安全。`testConnection()` 返回类型为 `Promise<{ success: boolean; error?: string }>`。

#### ProviderFactory (providerFactory.ts)

```typescript
function buildProvider(model: CustomModelConfig): TranslationProvider     // 根据后端类型创建提供者 (ollama/openai/ark)
function createSystemProviders(): TranslationProvider[]                    // 创建内置提供者 (Ollama + OpenAI)
function createCustomProviders(customModels: CustomModelConfig[]): TranslationProvider[]  // 创建自定义提供者
```

> **注意**: `buildProvider` 根据 `backend` 字段分支：`ark` → ArkProvider, `openai` → OpenAIProvider(customName), 默认 → OllamaProvider。

#### 翻译数据流

```
用户点击 ▶
    ↓
useTranslationService.translateCell(index)
    ↓
createTranslationService.translateCell(index)
    ↓
ProviderFactory → 获取当前 TranslationProvider
    ↓
provider.translate(cell.content, promptTemplate, signal)
    ↓
HTTP API 调用 (Ollama/OpenAI/Ark)
    ↓
notebookStore.updateCellOutput(index, result)
    ↓
CellOutput 重新渲染译文
```

#### generateSceneText

`generateSceneText(words, promptTemplate?)` 是 TranslationService 的预留接口，供背诵模块生成场景文章使用。通过当前翻译提供者调用，提示词模板来自 `settingStore.promptTemplates.scenery`。

---

### 3.12 背诵模式模块详解 (recitation/)

背诵模式采用 **Electron 主进程 + IPC + 渲染进程服务** 的三层架构，数据层运行在主进程（better-sqlite3），渲染进程通过 IPC 调用。

#### 架构

```
RecitationDAL (electron/recitation/)
├── database.ts           # PathManager + DatabaseManager (better-sqlite3)
├── bookDAL.ts            # 词书表 CRUD
├── wordDAL.ts            # 单词表 CRUD + 查询
├── userStudyDAL.ts       # 学习记录表 CRUD
├── statDAL.ts            # 统计查询
├── recitationDAL.ts      # DAL 组合层
├── ebbinghaus.ts         # 艾宾浩斯遗忘曲线算法（9 个阶段）
├── bookImporter.ts       # KyleBing 格式词书导入器
├── bookService.ts        # 词书管理服务
└── studyService.ts       # 学习服务（核心业务逻辑）
```

#### 数据库表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `book` | 词书 | id, name, path, count |
| `word` | 单词（FK → book） | id, book_id, word, phonetic, definition, example |
| `user_study` | 学习记录（FK → book/word） | id, book_id, word_id, stage(0-8), weight, last_review, next_review |

#### 渲染进程服务

```
src/services/recitationService.ts → createRecitationService() 工厂
src/hooks/useRecitationService.ts → React Hook (useMemo 单例)
```

暴露 18 个方法，覆盖词书管理、单词查询、学习流程、配置管理。

#### 艾宾浩斯算法

9 个复习阶段（5min → 30min → 12h → 1d → 2d → 4d → 7d → 15d → 30d），答对阶段 +1、答错阶段 -1。

#### 今日单词缓存

同一天内不自动刷新，单词 ID 列表缓存到 `studywordmode.json`；跨天自动清理。

> 当前状态: **数据层已完整实现**（9 个文件），**UI 组件尚未创建**（RecitationMainPage / QuizPage / RecitationSettingsPanel 待实现）。

---

## 4. 数据流程

### 4.1 文件打开流程

```
用户点击 Open / 双击文件
    ↓
window.electronAPI.openFileDialog()
    ↓
electronAPI.readFile(filePath)
    ↓
parseNotebookFile(content) → NotebookData
    ↓
notebookStore.openFile({ path, name, cells }) 
    ↓
→ setNotebook → NotebookEditor 重新渲染 CellContainer[]
    ↓
workspaceStore.addRecentFile(filePath)
```

### 4.2 文件保存流程

```
用户点击 Save
    ↓
if (notebook.path exists):
    serializeNotebookFile(cells) → JSON
    electronAPI.writeFile(path, JSON)
    notebookStore.setModified(false)
else:
    electronAPI.saveFileDialog() → path
    serializeNotebookFile(cells) → JSON
    electronAPI.writeFile(path, JSON)
    notebookStore.setFilePath(path)  // 更新路径和文件名
    notebookStore.setModified(false)
```

### 4.3 文本导入流程

```
用户点击 Import
    ↓
electronAPI.openImportDialog() → ImportResult
    ↓
splitTextIntoParagraphs(content) → paragraphs[]
    ↓
paragraphs.map → NotebookCell[]
    ↓
notebookStore.openFile({ name, cells })  // 无路径 (未保存状态)
```

### 4.4 单元格编辑流程

```
用户在 CellEditor 中编辑 (TipTap onChange)
    ↓
notebookStore.updateCellContent(index, newContent)
    ↓
notebookStore.setState → cells[index].content = newContent
    ↓
notebookStore.notebook.isModified = true
    ↓
StatusBar 显示 ● 修改标记
```

### 4.5 单元格选中流程

```
用户点击 CellContainer
    ↓
notebookStore.selectCell(index)  // 单选
或
notebookStore.selectCellRange(from, to)  // Shift 范围选择
    ↓
selectedIndices 更新
    ↓
CellContainer 根据 isSelected 属性高亮
    ↓
StatusBar 更新选中计数
```

### 4.6 设置加载/保存流程

```
App 启动
    ↓
settingStore.loadFromDisk()
    ↓
electronAPI.getSettings() → raw settings
    ↓
解析 readingFontSize / translation / promptTemplates / customModels / envVars
    ↓
set({...}) → 应用最新设置

设置变更 (用户操作)
    ↓
set* 方法 (setReadingFontSize / setTranslation 等)
    ↓
调用 debouncedSave()（500ms 防抖）
    ↓
延迟后调用 saveToDisk()
    ↓
electronAPI.setSettings(state) → 持久化到 userData/settings.json
```

### 4.7 背诵学习流程

```
用户选择词书 → recitationService.getTodayWords(bookId)
    ↓
返回 { newWords, reviewWords }（已缓存则直接返回）
    ↓
开始学习 → recitationService.startStudyWord(bookId, wordId)
    ↓
EbbinghausAlgorithm.calculateInitialState() → stage=0, next=5min
    ↓
复习时自评 → recitationService.reviewWord(bookId, wordId, isCorrect)
    ↓
EbbinghausAlgorithm.calculateReviewResult(stage, weight, lastReview, isCorrect)
    ↓
正确: stage+1, 间隔延长; 错误: stage-1, 间隔缩短
    ↓
更新 user_study → 下次复习时间
    ↓
定时自动跨天清理今日单词缓存
```

### 4.8 主题切换流程

```
用户在 SettingsDialog 中切换主题
    ↓
themeStore.setTheme('light' | 'dark')
    ↓
set({ theme, colors: themes[theme] })
    ↓
useTheme hook 重新计算 cssVars
    ↓
React 重新渲染，所有使用 useTheme() 的组件更新样式
    ↓
全局 CSS 变量更新 (--foreground, --background 等)
```

---

## 5. 扩展点

### 5.1 新增翻译提供者

翻译模块已完整实现 `TranslationProvider` 接口 + ProviderFactory 模式，包含三个内置提供者（OllamaProvider / OpenAIProvider / ArkProvider）。新增翻译提供者的步骤:
1. 在 `translation/providers/` 下实现新的 Provider 类，实现 `TranslationProvider` 接口
2. 可选: 在 `translation/types.ts` 中添加对应的配置类型
3. 在 `translation/providerFactory.ts` 的 `buildProvider()` 中添加分支
4. 在 `SettingsDialog` 的 Models 标签页添加配置 UI

### 5.2 新增侧边栏面板

1. 在 `workspaceStore` 中添加新的 `sidebarActiveTab` 值
2. 在 `Sidebar.tsx` 中添加对应的条件渲染分支
3. 在 `ActivityBar.tsx` 中添加对应的图标按钮

### 5.3 新增设置标签页

1. 在 `SettingsDialog.tsx` 中添加新的标签页按钮和条件渲染分支
2. 在 `settingStore` 中添加对应的状态和操作方法
3. 在 `electron/main.ts` 的默认设置中添加对应字段

### 5.4 新增单元格操作

1. 在 `notebookStore` 中添加操作方法
2. 在 `CellToolbar.tsx` 中添加对应的按钮
3. 在 `useKeyboard.ts` 中添加对应的快捷键

### 5.5 新增主题

1. 在 `themes.ts` 中添加新的 ThemeConfig 对象
2. 在 `themeStore.ts` 的 `themes` 字典中注册
3. 在 `SettingsDialog` 中添加选择选项

---

## 6. 依赖关系

```
AppShell
├── useKeyboard (全局快捷键)
├── ActivityBar
│   └── useWorkspaceStore (sidebarActiveTab)
├── Sidebar
│   ├── useWorkspaceStore (sidebarVisible, sidebarActiveTab)
│   ├── FileExplorer
│   │   ├── useWorkspaceStore (workspacePath, workspaceFiles, ...)
│   │   ├── useNotebookStore (openFiles, activeFilePath, ...)
│   │   └── fileUtils (parseNotebookFile, serializeNotebookFile)
│   └── useTheme (colors)
├── NotebookToolbar
│   ├── useFileService (openFile, saveFile, importText, createFile)
│   ├── useNotebookStore (notebook, ...)
│   ├── useWorkspaceStore (addRecentFile, refreshFiles)
│   ├── fileUtils (parseNotebookFile, serializeNotebookFile)
│   ├── SettingsDialog
│   │   ├── useThemeStore (theme, setTheme)
│   │   ├── useSettingStore (readingFontSize, translation, ...)
│   │   └── useTranslationService (listProviders, testConnection)
│   └── useTheme (colors)
├── NotebookEditor
│   ├── useNotebookStore (notebook, selectedIndices, ...)
│   ├── useCellService (insertBelow, deleteSelected, copyCell, ...)
│   ├── useTranslationService (translateCell, status)
│   ├── CellContainer (for each cell)
│   │   ├── useNotebookStore (selection)
│   │   ├── useCellService (cell operations)
│   │   ├── useTranslationService (translateCell)
│   │   ├── CellToolbar
│   │   ├── CellEditor (TipTap 编辑器)
│   │   ├── CellOutput (marked 渲染)
│   │   └── CellCollapseIndicator
│   └── useTheme (colors)
├── Panel
│   └── useTheme (colors)
└── StatusBar
    ├── useNotebookStore (notebook, selectedIndices, openFileCount)
    └── useTheme (colors)
```

---

## 7. 目录结构

```
TSBook2/
├── electron/
│   ├── main.ts              # Electron 主进程 (窗口 + IPC)
│   ├── preload.ts           # 上下文桥接 (contextBridge)
│   └── recitation/          # 背诵模式数据层
│       ├── database.ts      # SQLite 数据库管理
│       ├── bookDAL.ts       # 词书数据访问层
│       ├── wordDAL.ts       # 单词数据访问层
│       ├── userStudyDAL.ts  # 学习记录数据访问层
│       ├── statDAL.ts       # 统计数据访问层
│       ├── recitationDAL.ts # DAL 组合层
│       ├── ebbinghaus.ts    # 艾宾浩斯遗忘曲线算法
│       ├── bookImporter.ts  # 词书导入器
│       ├── studyService.ts  # 学习服务
│       └── bookService.ts   # 词书管理服务
├── scripts/
│   └── dev-electron.js      # 开发环境启动脚本
├── src/
│   ├── components/
│   │   ├── cells/
│   │   │   ├── CellCollapseIndicator.tsx  # 折叠指示器
│   │   │   ├── CellContainer.tsx          # 单元格容器
│   │   │   ├── CellEditor.tsx             # 原文编辑器 (TipTap)
│   │   │   ├── CellOutput.tsx             # 译文渲染 (Marked)
│   │   │   └── CellToolbar.tsx            # 单元格工具栏
│   │   ├── file/
│   │   │   └── FileExplorer.tsx           # 文件浏览器
│   │   ├── layout/
│   │   │   ├── ActivityBar.tsx            # 活动栏
│   │   │   ├── AppShell.tsx               # 应用外壳
│   │   │   ├── Panel.tsx                  # 底部面板
│   │   │   ├── Sidebar.tsx                # 侧边栏
│   │   │   └── StatusBar.tsx              # 状态栏
│   │   ├── notebook/
│   │   │   ├── NotebookEditor.tsx         # 笔记本编辑器
│   │   │   └── NotebookToolbar.tsx        # 笔记本工具栏
│   │   └── settings/
│   │       └── SettingsDialog.tsx         # 设置对话框
│   ├── hooks/
│   │   ├── useKeyboard.ts                # 键盘快捷键 Hook
│   │   ├── useTheme.ts                   # 主题 Hook
│   │   ├── useFileService.ts             # 文件服务 Hook
│   │   ├── useCellService.ts             # 单元格服务 Hook
│   │   └── useTranslationService.ts      # 翻译服务 Hook
│   ├── services/
│   │   ├── types.ts                      # 服务层接口定义
│   │   ├── index.ts                      # 统一导出
│   │   ├── fileService.ts                # 文件操作服务
│   │   ├── cellService.ts                # 单元格操作服务
│   │   ├── translationService.ts         # 翻译服务
│   │   └── recitationService.ts          # 背诵服务 (IPC 调用封装)
│   ├── translation/
│   │   ├── types.ts                      # TranslationProvider 接口和配置
│   │   ├── providerFactory.ts            # 提供者工厂
│   │   └── providers/
│   │       ├── ollama.ts                 # Ollama 提供者
│   │       ├── openai.ts                 # OpenAI 兼容提供者
│   │       └── ark.ts                    # 火山引擎 Ark 提供者
│   ├── recitation/
│   │   ├── types.ts                      # 背诵模式数据模型类型
│   │   └── index.ts                      # 统一导出
│   ├── store/
│   │   ├── notebookStore.ts              # 笔记本状态
│   │   ├── settingStore.ts               # 设置状态
│   │   ├── themeStore.ts                 # 主题状态
│   │   └── workspaceStore.ts             # 工作区状态
│   ├── styles/
│   │   ├── global.css                    # 全局样式
│   │   └── themes.ts                     # 主题颜色配置
│   ├── types/
│   │   └── notebook.ts                   # 类型定义
│   ├── utils/
│   │   └── fileUtils.ts                  # 文件工具
│   ├── App.tsx                           # 根组件
│   ├── main.tsx                          # 应用入口
│   └── vite-env.d.ts                     # Vite 类型声明
├── tests/
│   ├── components/
│   │   └── fileUtils.test.ts             # 文件工具测试
│   ├── store/
│   │   ├── notebookStore.test.ts         # 笔记本状态测试
│   │   └── themeStore.test.ts            # 主题状态测试
│   └── setup.ts                          # 测试配置
├── dist-electron/                        # 编译后的 Electron 文件
├── index.html                            # HTML 入口
├── package.json                          # 依赖和脚本
├── tsconfig.json                         # TypeScript 配置
├── tsconfig.node.json                    # Node TypeScript 配置
├── vite.config.ts                        # Vite 配置
├── vitest.config.ts                      # Vitest 测试配置
├── TODO.md                              # 待办事项
├── ARCHITECTURE.md                       # 架构文档 (本文件)
└── README.md                             # 项目说明
```

---

## 8. 设计模式

| 模式 | 应用位置 | 说明 |
|------|---------|------|
| **状态管理模式 (Flux)** | Zustand Stores | 单一数据源 + 不可变更新，替代原项目的信号/槽 |
| **容器-组件模式** | CellContainer (容器) + CellEditor/CellOutput (组件) | 容器管理状态和布局，子组件专注渲染 |
| **Hook 模式** | useTheme, useKeyboard | 状态逻辑复用，将主题 CSS 变量和键盘事件封装为可复用 Hook |
| **桥接模式** | preload.ts (contextBridge) | 隔离主进程和渲染进程，暴露有限 API |
| **观察者模式** | Zustand subscribe | 状态变更自动触发 UI 重新渲染 |
| **工厂模式** | createEmptyCell() | 创建新单元格对象 |
| **适配器模式** | fileUtils (parseNotebookFile) | 适配不同版本的文件格式 (v1.0 → v2.0) |
| **策略模式** | 主题系统 (light/dark) | 不同主题策略通过 ThemeConfig 接口统一暴露 |
| **Service Layer 模式** | services/ + hooks/ | 将业务逻辑从组件中剥离到服务层，组件通过 Hook 消费服务，提高可测试性和关注点分离 |
| **数据访问层 (DAL) 模式** | electron/recitation/*DAL.ts | 数据库 CRUD 操作封装为独立 DAL 类，通过 RecitationDAL 组合层统一访问 |
| **三层架构** | Electron 主进程 + IPC + 渲染进程 | 背诵模式数据层运行在主进程 (better-sqlite3)，渲染进程通过 IPC 桥接访问 |

---

## 9. 与原项目的架构差异

| 维度 | TransNb (PyQt5) | TSBook2 (Electron + React) |
|------|-----------------|---------------------------|
| **架构模式** | 模块化 MainWindow + 信号/槽 | React 组件树 + Zustand 状态管理 |
| **UI 组件化** | 类继承 (BaseCell → MarkdownCell) | 函数式组件 + Props 传递 |
| **主题机制** | Qt 颜色字典 + 手动 apply_theme | CSS 变量 + React 重新渲染 |
| **文件操作** | Python file I/O + QFileSystemWatcher | Electron IPC + fs (主进程) |
| **状态通信** | Qt 信号/槽 + 手动连接 | Zustand Selector + React 自动渲染 |
| **数据流** | 双向 (信号/槽 + 方法调用) | 单向 (Action → Store → View) |
| **翻译引擎** | Python async + httpx + SDK | 已实现 (fetch API + Provider 模式) |
| **背诵系统** | SQLite + 完整 DAL/Ebbinghaus | (待实现) 计划使用 IndexedDB/SQLite |
| **单元测试** | 无 | Vitest + React Testing Library |
| **快捷键** | QShortcut + CellConfig 常量 | React KeyboardEvent + Hook |
| **构建打包** | N/A (Python 脚本) | Vite + electron-builder |

---

## 10. 性能考虑

- **状态更新**: Zustand 使用不可变更新，React 通过 shallow compare 选择性重新渲染受影响的组件
- **单元格列表**: 使用 key={cell.id} 优化列表渲染，避免不必要的 DOM 重建
- **TipTap 编辑器**: 仅当对应单元格处于编辑状态时才创建编辑器实例
- **文件操作**: 所有文件 I/O 在 Electron 主进程执行，不阻塞渲染进程
- **设置持久化**: 已实现 500ms 防抖批量保存（`debouncedSave`），避免频繁磁盘写入
- **内容溢出**: CSS 全局 `box-sizing: border-box` 防止布局溢出

---

## 11. 安全考虑

- **上下文隔离**: Electron 启用 `contextIsolation: true`，禁用 `nodeIntegration`
- **API 密钥**: 从系统环境变量读取（通过 `apiKeyEnv` 配置），settings.json 中仅存储环境变量名
- **文件操作范围**: 通过 `readDirectory` 过滤只显示 .transnb 文件
- **路径安全**: 所有文件路径由 Electron 主进程处理，渲染进程不直接访问文件系统

---

## 12. 待办与规划

根据 [TODO.md](file:///g:/program/TSBook2/TODO.md)，当前版本未完成的功能：

1. **单元格编辑/阅读模式切换** (Done):
   - 阅读模式使用 `marked` 渲染 Markdown，样式与 CellOutput 一致
   - 双击双向切换（阅读模式↔编辑模式）
   - Escape 键退出编辑模式
   - 编辑模式工具栏带提示文字

2. **译文区 Markdown 渲染** (Done): 
   - CellEditor 阅读模式已使用 `marked` 渲染
   - 阅读模式字体大小通过设置面板控制（`readingFontSize`）

3. **翻译引擎集成** (Done): 已完成 TranslationService + OllamaProvider / OpenAIProvider / ArkProvider + useTranslationService

4. **翻译连接测试与批量翻译** (Done): Provider 层已实现，设置面板连接测试按钮已接入，批量翻译已实现

5. **背诵模式** (数据层已完成): 数据层（9 个文件）已完整实现，包括 SQLite 数据库管理、DAL 层、艾宾浩斯算法、词书导入器、学习服务和词书管理服务。**UI 组件尚未创建**（RecitationMainPage / QuizPage / RecitationSettingsPanel 待实现）

6. **快捷键完善** (Pending): 缺少 `Ctrl+S` 保存、`Ctrl+Shift+S` 另存为、`Ctrl+O` 打开等常见快捷键（详见 TODO.md 第 6 节）

7. **宽度控制** (Done): 单元格宽度可通过设置面板中的"单元格宽度比例"滑块调整（50-100%）

这些功能将按照 TODO.md 中的优先级逐步实现。
