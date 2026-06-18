# TSBook2 软件架构文档

## 1. 项目概述

TSBook2 是"翻译笔记本"(TransNb)的 TypeScript/React 重构版本。原项目基于 PyQt5 构建，TSBook2 采用 Electron + React + TypeScript 技术栈重新实现，继承了核心的单元格笔记本编辑和翻译功能，采用 VS Code 风格的 IDE 式 UI 布局，提供更好的跨平台体验和现代化前端开发流程。

### 核心理念

- **IDE 式布局**: 采用类似 VS Code 的活动栏(ActivityBar)、侧边栏(Sidebar)、编辑器区域和状态栏(StatusBar)布局
- **状态管理集中化**: 使用 Zustand 统一管理应用状态，替代原项目的 Qt 信号/槽机制
- **组件化架构**: 所有 UI 元素均为 React 函数组件，支持灵活组合和复用
- **层级无关的文件格式**: 继承原项目的 .transnb v2.0 文件格式，支持单元格父子从属关系

### 技术栈

| 技术                   | 用途                         |
| -------------------- | -------------------------- |
| **Electron 33**      | 桌面应用框架，提供原生窗口、文件系统、对话框 API |
| **React 19**         | UI 框架                      |
| **TypeScript**       | 类型安全                       |
| **Vite 6**           | 前端构建工具和开发服务器               |
| **Zustand 5**        | 轻量级状态管理                    |
| **TipTap 2**         | 富文本编辑器（单元格原文编辑）            |
| **marked**           | Markdown 渲染（单元格译文阅读模式）     |
| **better-sqlite3**   | SQLite 数据库（背诵模式数据持久化）      |
| **Vitest**           | 单元测试框架                     |
| **electron-builder** | 应用打包                       |

### 与原项目(TransNb)对比

| 维度          | TransNb (PyQt5)            | TSBook2 (Electron + React)                           |
| ----------- | -------------------------- | ---------------------------------------------------- |
| 技术栈         | Python + PyQt5 + httpx     | TypeScript + React + Electron                        |
| 状态管理        | Qt 信号/槽机制                  | Zustand 状态管理                                         |
| UI 渲染       | Qt Widgets                 | React DOM + CSS                                      |
| Markdown 编辑 | 自实现 ClickableTextEdit      | TipTap 富文本编辑器                                        |
| 翻译引擎        | Python async httpx + SDK   | fetch API + Provider 策略模式 (Ollama/OpenAI/Ark)        |
| 背诵系统        | SQLite + 完整 DAL/Ebbinghaus | 完整实现 (better-sqlite3 + IPC + RecitationService + UI) |
| 文件格式        | .transnb JSON (v1.0/v2.0)  | .transnb JSON (v2.0 兼容, 支持 wordMeta)                 |
| 主题系统        | Qt 样式表 + 颜色字典              | CSS 变量 + ThemeConfig                                 |
| 构建工具        | 无 (Python 直接运行)            | Vite + electron-builder                              |

***

## 2. 系统架构

### 2.1 整体架构图

```
TSBook2 应用
├── Electron 主进程 (electron/)
│   ├── main.ts               # 窗口管理 + IPC 处理
│   └── preload.ts            # 上下文桥接 (contextBridge)
│   └── recitation/           # 背诵模式数据层
│       ├── database.ts       # SQLite 数据库管理 (better-sqlite3)
│       ├── bookDAL.ts        # 词书数据访问层
│       ├── wordDAL.ts        # 单词数据访问层
│       ├── userStudyDAL.ts   # 用户学习记录 DAL
│       ├── recitationDAL.ts  # 通用背诵 DAL
│       ├── statDAL.ts        # 统计分析 DAL
│       ├── ebbinghaus.ts     # 艾宾浩斯遗忘曲线算法 (8 阶段)
│       ├── bookService.ts    # 词书管理服务
│       ├── studyService.ts   # 学习服务 (每日新词/复习)
│       └── bookImporter.ts   # 词书导入器 (KyleBing JSON)
├── React 渲染进程 (src/)
│   ├── 入口层
│   │   ├── main.tsx      # ReactDOM 渲染入口
│   │   ├── App.tsx       # 根组件 (主题初始化 + 设置加载 + 回调解耦)
│   │   └── index.html    # HTML 入口
│   ├── 布局层 (components/layout/)
│   │   ├── AppShell.tsx  # 应用外壳 (正常模式 ↔ 背诵模式路由)
│   │   ├── ActivityBar.tsx  # 活动栏 (新增背诵图标)
│   │   ├── Sidebar.tsx   # 侧边栏
│   │   ├── Panel.tsx     # 底部面板 (翻译进度 + 日志)
│   │   └── StatusBar.tsx # 状态栏
│   ├── 业务组件层
│   │   ├── notebook/     # 笔记本组件
│   │   │   ├── NotebookEditor.tsx   # 笔记本编辑器主区域
│   │   │   └── NotebookToolbar.tsx  # 笔记本工具栏 (含翻译全部按钮)
│   │   ├── cells/        # 单元格组件
│   │   │   ├── CellContainer.tsx    # 单元格容器 (含翻译状态指示器)
│   │   │   ├── CellEditor.tsx       # 单元格原文编辑器
│   │   │   ├── CellOutput.tsx       # 单元格译文输出
│   │   │   ├── CellToolbar.tsx      # 单元格操作工具栏
│   │   │   └── CellCollapseIndicator.tsx  # 折叠指示器
│   │   ├── recitation/   # 背诵模式组件
│   │   │   ├── RecitationShell.tsx     # 背诵模式主容器
│   │   │   ├── BookManagerPanel.tsx    # 词书管理面板
│   │   │   ├── BookCard.tsx            # 词书卡片
│   │   │   ├── QuizPanel.tsx           # 检测面板 (4选1)
│   │   │   ├── FloatingOptions.tsx     # 悬浮选项动画
│   │   │   ├── ReviewPanel.tsx         # 回顾总结面板
│   │   │   ├── WordSidebar.tsx         # 单词侧边栏
│   │   │   ├── WordListItem.tsx        # 单词条目
│   │   │   ├── StatsPanel.tsx          # 学习统计面板（环形图）
│   │   │   ├── WordManagerDialog.tsx   # 单词管理弹窗
│   │   │   ├── WordEditorDialog.tsx    # 单词编辑弹窗
│   │   │   └── ResizeHandle.tsx        # 拖拽分割条
│   │   ├── file/         # 文件浏览组件
│   │   │   └── FileExplorer.tsx     # 文件浏览器
│   │   ├── welcome/      # 欢迎页面
│   │   │   └── WelcomePage.tsx      # 欢迎页
│   │   └── settings/     # 设置组件
│   │       └── SettingsDialog.tsx   # 设置对话框
│   ├── 服务层 (services/)
│   │   ├── types.ts              # 服务层接口定义 (FileService/CellService/TranslationService/RecitationService)
│   │   ├── index.ts              # 统一导出 (仅类型)
│   │   ├── translationService.ts # 翻译服务 (模块级单例)
│   │   └── recitationService.ts  # 背诵服务 (IPC 代理)
│   ├── 翻译模块 (translation/)
│   │   ├── types.ts              # TranslationProvider 接口 + ProviderInfo
│   │   ├── providerFactory.ts    # 提供者工厂
│   │   └── providers/
│   │       ├── ollama.ts         # Ollama 提供者
│   │       ├── openai.ts         # OpenAI 兼容提供者
│   │       └── ark.ts            # 火山引擎 Ark 提供者
│   ├── 状态管理层 (store/)
│   │   ├── notebookStore.ts    # 笔记本数据状态 (Zustand)
│   │   ├── workspaceStore.ts   # 工作区状态 (Zustand, 不含 recentFiles)
│   │   ├── themeStore.ts       # 主题状态 (Zustand)
│   │   ├── settingStore.ts     # 设置状态 (Zustand + 持久化, 通过回调解耦 themeStore)
│   │   ├── recitationStore.ts  # 背诵模式 UI 状态 (Zustand)
│   │   └── outputStore.ts      # 日志输出 Store
│   ├── 工具层
│   │   ├── utils/
│   │   │   ├── fileUtils.ts        # 文件序列化/解析/分割工具
│   │   │   └── articleUtils.ts     # 文章关联词书工具
│   │   ├── hooks/
│   │   │   ├── useKeyboard.ts         # 键盘快捷键 Hook
│   │   │   ├── useTheme.ts            # 主题 Hook (CSS 变量)
│   │   │   ├── useFileService.ts      # 文件操作服务 Hook
│   │   │   ├── useCellService.ts      # 单元格操作服务 Hook
│   │   │   ├── useTranslationService.ts # 翻译服务 Hook (状态轮询)
│   │   │   └── useRecitationService.ts  # 背诵服务 Hook (单例)
│   ├── 类型定义 (types/)
│   │   ├── notebook.ts    # 全局类型 (NotebookCell/ThemeConfig/AppSettings/Window.electronAPI)
│   │   ├── electron.ts    # IPC 共享类型 (FileEntry/DirEntry/ImportResult/RecitationWordInput)
│   │   └── vite-env.d.ts  # Vite 类型声明
│   ├── 背诵模式类型 (recitation/)
│   │   ├── types.ts            # Book/Word/UserStudy/TodayWordsResult 等
│   │   ├── quizTypes.ts        # QuizState/QuizQuestion/QuizOption
│   │   ├── wordSidebarTypes.ts # WordSidebarData/WordDisplay/ReviewWordBatch
│   │   └── ebbinghaus.ts       # 前端艾宾浩斯算法 (同步 Electron 端)
│   └── 样式 (styles/)
│       ├── global.css     # 全局样式 (TipTap, 滚动条)
│       └── themes.ts      # 主题颜色配置 (light/dark, 含背诵色值)
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
│  │  AppShell (布局容器 — 正常模式 ↔ 背诵模式)              ││
│  │                                                         ││
│  │  ┌─ 正常模式 ───────────────────────────────────────┐  ││
│  │  │  ActivityBar (活动栏)                             │  ││
│  │  │  Sidebar > FileExplorer (文件浏览器)              │  ││
│  │  │  NotebookToolbar (工具栏 + 翻译全部按钮)          │  ││
│  │  │  NotebookEditor (编辑器区域)                      │  ││
│  │  │  │   └── CellContainer[] (单元格 + 状态指示器)    │  ││
│  │  │  │       ├── CellToolbar (操作按钮)               │  ││
│  │  │  │       ├── CellEditor (原文编辑 - TipTap)       │  ││
│  │  │  │       ├── CellOutput (译文渲染 - Marked)       │  ││
│  │  │  │       └── CellCollapseIndicator (折叠)         │  ││
│  │  │  Panel (底部面板 — 翻译进度 + 日志)               │  ││
│  │  └──────────────────────────────────────────────────┘  ││
│  │                                                         ││
│  │  ┌─ 背诵模式 ───────────────────────────────────────┐  ││
│  │  │  ActivityBar (含背诵图标)                         │  ││
│  │  │  Sidebar (保持不变)                               │  ││
│  │  │  RecitationShell (主区域)                         │  ││
│  │  │  ├── BookManagerPanel (词书管理)                  │  ││
│  │  │  │   ├── BookCard[] (词书卡片, 分段进度条)        │  ││
│  │  │  │   └── StatsPanel (学习统计环形图)              │  ││
│  │  │  ├── QuizPanel (检测, 4选1)                       │  ││
│  │  │  │   └── FloatingOptions (悬浮动画, pairText)     │  ││
│  │  │  ├── ReviewPanel (回顾总结, 已测标记)             │  ││
│  │  │  └── WordSidebar (单词侧边栏, 可变宽度)           │  ││
│  │  │      └── WordListItem[] (单词项, 测验结果标记)    │  ││
│  │  └──────────────────────────────────────────────────┘  ││
│  │                                                         ││
│  │  Service Layer (业务逻辑层)                              ││
│  │  ├── useFileService (文件打开/保存/导入)                ││
│  │  ├── useCellService (单元格增/删/改/复制/合并/折叠)     ││
│  │  ├── useTranslationService (翻译/测试连接/提供者管理)   ││
│  │  └── useRecitationService (背诵: 词书/单词/学习)       ││
│  │                                                         ││
│  │  Zustand Stores (全局状态)                              ││
│  │  ├── useNotebookStore (单元格/文件/选择状态)            ││
│  │  ├── useWorkspaceStore (工作区/侧边栏状态)             ││
│  │  ├── useThemeStore (主题状态)                           ││
│  │  ├── useSettingStore (应用设置 + 持久化, 回调解耦)     ││
│  │  ├── useRecitationStore (背诵 UI 状态)                 ││
│  │  └── useOutputStore (日志输出)                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

***

## 3. 核心模块详解

### 3.1 Electron 主进程 (electron/)

#### main.ts

**职责**:

- 管理 BrowserWindow 创建和生命周期
- 注册所有 IPC 处理器 (handle)
- 管理应用设置文件的读写 (userData/settings.json)
- 提供文件系统操作接口 (读/写/删除/重命名/目录遍历)

**IPC 处理器清单**:

| 通道                         | 参数                                  | 返回值                       | 说明                                     |
| -------------------------- | ----------------------------------- | ------------------------- | -------------------------------------- |
| `read-file`                | `filePath: string`                  | `string`                  | 读取文件内容                                 |
| `write-file`               | `filePath: string, content: string` | `boolean`                 | 写入文件                                   |
| `file-exists`              | `filePath: string`                  | `boolean`                 | 检查文件存在                                 |
| `delete-file`              | `filePath: string`                  | `boolean`                 | 删除文件                                   |
| `rename-file`              | `oldPath, newPath`                  | `boolean`                 | 重命名文件                                  |
| `open-file-dialog`         | 无                                   | `string \| null`          | 打开文件选择对话框 (.transnb)                   |
| `save-file-dialog`         | 无                                   | `string \| null`          | 保存文件对话框                                |
| `open-folder-dialog`       | 无                                   | `string \| null`          | 选择文件夹对话框                               |
| `open-import-dialog`       | 无                                   | `ImportResult \| null`    | 导入文本文件对话框                              |
| `read-directory`           | `dirPath: string`                   | `FileEntry[]`             | 读取目录（过滤 .transnb）                      |
| `read-directory-recursive` | `dirPath: string`                   | `DirEntry[]`              | 递归目录遍历                                 |
| `read-clipboard`           | 无                                   | `string`                  | 读取系统剪贴板内容                              |
| `get-settings`             | 无                                   | `Record<string, unknown>` | 读取设置文件                                 |
| `set-settings`             | `settings`                          | `boolean`                 | 保存设置文件                                 |
| `recitation:*`             | 见下文                                 | 见下文                       | 背诵模式完整 IPC（init, CRUD 词书/单词, 学习流程, 配置） |

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
    onMenuAction
  }
}
```

***

### 3.2 状态管理层 (store/)

TSBook2 使用 Zustand 管理四个独立的状态存储，替代了原项目中 Qt 信号/槽 + 手动事件传递的通信模式。

#### notebookStore.ts (核心状态)

**职责**:

- 管理笔记本数据（单元格列表、文件路径、修改状态）
- 管理多文件打开（`openFiles: Map<string, NotebookFile>`）
- 管理单元格选择状态（`selectedIndices: Set<number>`）

**v1.1 重构**: 移除了约 28 个单元格编辑方法到服务层，保留了约 12 个纯状态操作。单元格的增/删/改/复制/合并/拆分/折叠/从属等复杂逻辑已委托给 `useCellService` 和 `useFileService`。

**v1.2 改进**:

- 新增 `_onFileOpened` 回调解耦 `settingStore` 调用（`useFileService` 不再直接 import settingStore）
- `openFile()` 和 `setFilePath()` 调用 `_onFileOpened` 回调

**状态结构**:

```typescript
interface NotebookStore {
  openFiles: Map<string, NotebookFile>  // 所有打开的文件
  activeFilePath: string | null         // 当前活动文件
  selectedIndices: Set<number>          // 选中单元格索引
  notebook: NotebookFile                // 当前文件数据快照
  openFileCount: number                 // 打开文件数
  // ...操作方法（仅保留纯状态操作）
}
```

**核心方法覆盖**:

- 文件管理: `openFile`, `closeFile`, `switchToFile`, `setNotebook`, `setCells`, `setFilePath`, `setModified`
- 选择管理: `selectCell`, `selectCellRange`, `toggleCellSelection`, `clearSelection`
- 单元格内容: `updateCellContent`, `updateCellOutput`

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

- 管理应用设置（翻译配置、提示词模板、自定义模型、环境变量）
- 支持从磁盘加载设置和保存到磁盘（通过 Electron IPC）

**v1.2 解耦**:

- 移除了对 `themeStore` 的直接 import（通过 `_onThemeChange` 回调解耦）
- 在 `App.tsx` 的 `useEffect` 中注册回调解耦逻辑

**持久化策略**:

- 通过 `loadFromDisk()` / `saveToDisk()` 与 Electron 主进程交互
- 每次 `set*` 方法调用后通过 `debouncedSave()` 延迟 500ms 批量写入磁盘，避免频繁 I/O

***

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

***

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

***

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

***

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

***

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

***

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

| 快捷键            | 动作         |
| -------------- | ---------- |
| `Ctrl+N`       | 在当前单元格下方插入 |
| `Ctrl+Shift+A` | 在当前单元格上方插入 |
| `Delete`       | 删除选中单元格    |
| `Ctrl+D`       | 复制当前单元格    |
| `Ctrl+M`       | 合并选中单元格    |
| `Ctrl+F`       | 切换从属关系     |
| `Ctrl+E`       | 折叠/展开      |
| `Ctrl+Q`       | 折叠当前单元格原文区 |
| `Ctrl+Shift+Q` | 全部折叠原文     |
| `Ctrl+W`       | 折叠当前单元格译文区 |
| `Ctrl+Shift+W` | 全部折叠译文     |
| `↑/↓`          | 上下导航       |
| `Shift+↑/↓`    | 范围选择       |

> **待添加的快捷键** (详见 [TODO.md](file:///g:/program/TSBook2/doc/TODO.md) 第 3 节): `Ctrl+S` 保存, `Ctrl+Shift+S` 另存为, `Ctrl+O` 打开, `Ctrl+Enter` 翻译, `Ctrl+Shift+Enter` 翻译全部, `Ctrl+B` 切换侧边栏, `Ctrl+J` 切换底部面板。

#### hooks/useTheme.ts

**职责**:

- 将 ThemeConfig 映射为 CSS 变量
- 提供主题切换和颜色获取

***

### 3.9 类型系统 (types/)

#### src/types/

| 文件            | 核心类型                                                                                                                                                                    | 说明                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `notebook.ts` | `NotebookCell`, `NotebookData`, `NotebookFile`, `NotebookStore`, `ThemeConfig`, `ThemeStore`, `TranslationSettings`, `CustomModel`, `AppSettings`, `Window.electronAPI` | 全局类型定义                       |
| `electron.ts` | `FileEntry`, `DirEntry`, `ImportResult`, `RecitationWordInput`                                                                                                          | IPC 共享类型（v1.2 新增，统一主进程和渲染进程） |

#### src/recitation/ (背诵模式类型)

| 文件                    | 核心类型                                                                                               | 说明      |
| --------------------- | -------------------------------------------------------------------------------------------------- | ------- |
| `types.ts`            | `Book`, `Word`, `UserStudy`, `BookProgress`, `BookWithProgress`, `TodayWordsResult`(含 `testedNewWordIds`/`testedReviewWordIds`), `StageDistribution`, `StageSummary`, `StageFilter`, `StudyConfig` | 数据模型    |
| `quizTypes.ts`        | `QuizState`, `QuizQuestion`, `QuizOption`, `QuizQuestionType`                                      | 检测模块类型  |
| `wordSidebarTypes.ts` | `WordSidebarData`, `WordDisplay`, `ReviewWordBatch`, `WordSidebarMode`                             | 单词侧边栏类型 |

> **v1.2 变更**: IPC 共享类型从 `notebook.ts` 和 `electron/preload.ts` 中移除，统一到 `electron.ts`。`Window.electronAPI.recitationAPI` 的返回值类型从 `unknown` 改为具体类型（`Word[]`, `Book` 等）。

***

### 3.10 主题系统 (styles/)

#### themes.ts

**职责**:

- 定义浅色/深色两套完整主题色
- 40 个颜色键，覆盖 UI 所有部分（含背诵模式和阶段颜色）

**主题键分类**:

| 类别  | 键                                                                     |
| --- | --------------------------------------------------------------------- |
| 基础色 | foreground, background, border                                        |
| 编辑器 | editorBackground, editorForeground                                    |
| 侧边栏 | sidebarBackground, sidebarHeader, sidebarBorder                       |
| 活动栏 | activityBarBackground, activityBarForeground, activityBarActiveBorder |
| 状态栏 | statusBarBackground, statusBarForeground                              |
| 单元格 | cellBackground, cellSelectedBackground, cellBorder                    |
| 译文区 | cellOutputBackground, cellOutputBorder                                |
| 工具栏 | toolbarBackground, toolbarHover                                       |
| 按钮  | primaryButton, primaryButtonHover                                     |
| 错误  | errorBackground, errorBorder, errorText                               |
| 输入  | inputBackground, inputBorder                                          |
| 面板  | panelBackground, panelBorder                                          |
| 列表  | listItemHover, listItemSelected                                       |
| 其他  | cellGutter, scrollbar                                                 |
| 阶段色 | stageUnstudied, stageBeginner, stageReview, stageConsolidate, stageProficient, stageMastered |

#### global.css

**职责**:

- 全局样式重置
- 自定义滚动条样式
- TipTap 编辑器样式（标题/段落/列表/引用/代码块/行内代码）
- CSS 变量引用（通过 `var(--scrollbar)` 等）

***

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

| 服务                 | 实现模式                 | React Hook                | 依赖                                                 |
| ------------------ | -------------------- | ------------------------- | -------------------------------------------------- |
| FileService        | 模块级闭包 (hooks/ 中直接实现) | `useFileService()`        | notebookStore, workspaceStore, electronAPI         |
| CellService        | 模块级闭包 (hooks/ 中直接实现) | `useCellService()`        | notebookStore                                      |
| TranslationService | 模块级单例 + Hook 包装      | `useTranslationService()` | notebookStore, settingStore, translation/providers |
| RecitationService  | IPC 代理 (无状态)         | `useRecitationService()`  | window\.electronAPI.recitationAPI                  |

> **v1.2 变更**: 移除了 `services/fileService.ts` 和 `services/cellService.ts` 死代码。FileService 和 CellService 的实现直接位于对应的 `hooks/` 文件中。services/ 目录仅保留 `types.ts`(纯类型) 和 `translationService.ts`/`recitationService.ts`(有状态实现)。

#### 设计原则

1. **接口与实现分离**: `services/types.ts` 定义纯接口，具体实现在各服务/hooks文件中
2. **组合而非继承**: 服务通过组合 Zustand store 和工具函数实现
3. **可选 Hook 封装**: `create*Service()` 工厂函数可在非 React 环境使用，`use*Service()` Hook 为 React 组件提供便利
4. **单一职责**: 每个服务聚焦一个业务领域（文件、单元格、翻译、背诵）

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

| 提供者              | ID              | 后端类型   | 说明                               |
| ---------------- | --------------- | ------ | -------------------------------- |
| `OllamaProvider` | `system_Ollama` | system | 本地 Ollama 服务，默认模型 qwen2.5:0.5b   |
| `OpenAIProvider` | `system_OpenAI` | system | OpenAI 兼容 API，支持代理配置             |
| `ArkProvider`    | `custom_{name}` | custom | 火山引擎 Ark，通过 ProviderFactory 动态创建 |

各提供者从环境变量读取 API Key（通过 `resolveApiKey()`），settings.json 中仅存储环境变量名，保证密钥安全。

#### ProviderFactory (providerFactory.ts)

```typescript
function buildProvider(model: CustomModelConfig): TranslationProvider     // 根据后端类型创建提供者
function createSystemProviders(): TranslationProvider[]                    // 创建内置提供者
function createCustomProviders(customModels: CustomModelConfig[]): TranslationProvider[]  // 创建自定义提供者
```

#### 翻译进度可视化 (v1.2 新增)

翻译服务维护 **逐单元格状态跟踪**，通过 `TranslationStatus.cellStates` 记录每个单元格的翻译状态。

```typescript
interface TranslationStatus {
  state: 'idle' | 'translating' | 'error'
  currentIndex: number
  totalCount: number
  progress: number
  error: string | null
  cellStates: Record<number, 'pending' | 'translating' | 'done' | 'error'>  // 逐单元格状态
  cellErrors: Record<number, string>   // 逐单元格错误信息
  currentContent?: string              // 当前翻译内容预览
}
```

`useTranslationService` 通过 200ms `setInterval` 轮询同步状态，底部 Panel 消费 `cellStates` 显示进度条和当前翻译内容，单元格工具栏显示状态指示器（旋转动画 / ✓ / ✗）。

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
    ↓
状态同步: cellStates[index] = done/error → Panel + CellToolbar 指示器更新
```

#### generateSceneText

`generateSceneText(words, promptTemplate?)` 是 TranslationService 的预留接口，供背诵模块生成场景文章使用。当前通过当前翻译提供者调用，提示词模板来自 `settingStore.promptTemplates.scenery`。

***

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

### 4.7 主题切换流程

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

***

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

***

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
│   ├── useTranslationService (status — 翻译进度)
│   └── useTheme (colors)
├── RecitationShell (替代 NotebookToolbar + NotebookEditor 区域)
│   ├── useRecitationService (init, getTodayWords, ...)
│   ├── useRecitationStore (phase, active, ...)
│   └── BookManagerPanel / QuizPanel / ReviewPanel + WordSidebar
└── StatusBar
    ├── useNotebookStore (notebook, selectedIndices, openFileCount)
    └── useTheme (colors)
```

***

## 7. 目录结构

```
TSBook2/
├── electron/
│   ├── main.ts                         # Electron 主进程 (窗口 + IPC)
│   ├── preload.ts                      # 上下文桥接 (contextBridge)
│   └── recitation/                     # 背诵模式数据层
│       ├── database.ts                 # SQLite 数据库管理
│       ├── bookDAL.ts                  # 词书数据访问
│       ├── wordDAL.ts                  # 单词数据访问
│       ├── userStudyDAL.ts             # 用户学习记录
│       ├── recitationDAL.ts            # 通用背诵 DAL
│       ├── statDAL.ts                  # 统计分析
│       ├── ebbinghaus.ts               # 艾宾浩斯遗忘曲线
│       ├── bookService.ts              # 词书管理服务
│       ├── studyService.ts             # 学习服务
│       └── bookImporter.ts             # 词书导入器
├── scripts/
│   └── dev-electron.js                 # 开发环境启动脚本
├── src/
│   ├── components/
│   │   ├── cells/
│   │   │   ├── CellCollapseIndicator.tsx
│   │   │   ├── CellContainer.tsx          # 含翻译状态指示器
│   │   │   ├── CellEditor.tsx
│   │   │   ├── CellOutput.tsx
│   │   │   └── CellToolbar.tsx
│   │   ├── recitation/                   # 背诵模式 UI
│   │   │   ├── RecitationShell.tsx
│   │   │   ├── BookManagerPanel.tsx
│   │   │   ├── BookCard.tsx
│   │   │   ├── QuizPanel.tsx
│   │   │   ├── FloatingOptions.tsx
│   │   │   ├── ReviewPanel.tsx
│   │   │   ├── WordSidebar.tsx
│   │   │   ├── WordListItem.tsx
│   │   │   ├── StatsPanel.tsx
│   │   │   ├── WordManagerDialog.tsx
│   │   │   ├── WordEditorDialog.tsx
│   │   │   └── ResizeHandle.tsx
│   │   ├── file/
│   │   │   └── FileExplorer.tsx
│   │   ├── layout/
│   │   │   ├── ActivityBar.tsx
│   │   │   ├── AppShell.tsx
│   │   │   ├── Panel.tsx                  # 翻译进度 + 日志
│   │   │   ├── Sidebar.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── notebook/
│   │   │   ├── NotebookEditor.tsx
│   │   │   └── NotebookToolbar.tsx        # 含翻译全部按钮
│   │   ├── welcome/
│   │   │   └── WelcomePage.tsx            # 欢迎页面
│   │   └── settings/
│   │       └── SettingsDialog.tsx
│   ├── hooks/
│   │   ├── useKeyboard.ts
│   │   ├── useTheme.ts
│   │   ├── useFileService.ts
│   │   ├── useCellService.ts
│   │   ├── useTranslationService.ts       # 200ms 轮询状态
│   │   └── useRecitationService.ts        # 背诵服务单例
│   ├── services/
│   │   ├── types.ts                       # 服务层接口
│   │   ├── index.ts                       # 仅导出类型
│   │   ├── translationService.ts          # 翻译服务 (模块级单例)
│   │   └── recitationService.ts           # 背诵服务 (IPC 代理)
│   ├── translation/
│   │   ├── types.ts
│   │   ├── providerFactory.ts
│   │   └── providers/
│   │       ├── ollama.ts
│   │       ├── openai.ts
│   │       └── ark.ts
│   ├── store/
│   │   ├── notebookStore.ts
│   │   ├── settingStore.ts                # 通过回调解耦 themeStore
│   │   ├── themeStore.ts
│   │   ├── workspaceStore.ts              # 不含 recentFiles
│   │   ├── recitationStore.ts             # 背诵 UI 状态
│   │   └── outputStore.ts                 # 日志输出
│   ├── styles/
│   │   ├── global.css
│   │   └── themes.ts                      # 含背诵色值
│   ├── types/
│   │   ├── notebook.ts
│   │   └── electron.ts                    # IPC 共享类型
│   ├── recitation/
│   │   ├── types.ts
│   │   ├── quizTypes.ts
│   │   ├── wordSidebarTypes.ts
│   │   └── ebbinghaus.ts                  # 前端艾宾浩斯算法
│   ├── utils/
│   │   ├── fileUtils.ts
│   │   └── articleUtils.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── tests/
│   ├── components/
│   │   └── fileUtils.test.ts
│   ├── store/
│   │   ├── notebookStore.test.ts
│   │   └── themeStore.test.ts
│   └── setup.ts
├── dist-electron/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
└── doc/                                   # 文档目录
    ├── TODO.md                            # 待办事项
    ├── API.md                             # API 文档
    ├── ARCHITECTURE.md                    # 架构文档 (本文件)
    └── v1.1/                              # v1.1 重构记录
    └── v1.2/                              # v1.2 重构方案
```

***

## 8. 设计模式

| 模式                   | 应用位置                                            | 说明                                          |
| -------------------- | ----------------------------------------------- | ------------------------------------------- |
| **状态管理模式 (Flux)**    | Zustand Stores                                  | 单一数据源 + 不可变更新，替代原项目的信号/槽                    |
| **容器-组件模式**          | CellContainer (容器) + CellEditor/CellOutput (组件) | 容器管理状态和布局，子组件专注渲染                           |
| **Hook 模式**          | useTheme, useKeyboard                           | 状态逻辑复用，将主题 CSS 变量和键盘事件封装为可复用 Hook           |
| **桥接模式**             | preload.ts (contextBridge)                      | 隔离主进程和渲染进程，暴露有限 API                         |
| **观察者模式**            | Zustand subscribe                               | 状态变更自动触发 UI 重新渲染                            |
| **工厂模式**             | createEmptyCell()                               | 创建新单元格对象                                    |
| **适配器模式**            | fileUtils (parseNotebookFile)                   | 适配不同版本的文件格式 (v1.0 → v2.0)                   |
| **策略模式**             | 主题系统 (light/dark)                               | 不同主题策略通过 ThemeConfig 接口统一暴露                 |
| **Service Layer 模式** | services/ + hooks/                              | 将业务逻辑从组件中剥离到服务层，组件通过 Hook 消费服务，提高可测试性和关注点分离 |
| **回调解耦模式**           | settingStore.\_onThemeChange → App.tsx          | 替代 Store 之间直接 import，通过注册回调实现松耦合            |
| **模块级单例模式**          | useTranslationService, useRecitationService     | 有状态服务（翻译进度、背诵操作）在应用生命周期内只创建一个实例             |
| **IPC 代理模式**         | recitationService.ts                            | 纯 IPC 转发层，无内部状态，方法直接调用 window\.electronAPI  |

***

## 9. 与原项目的架构差异

| 维度         | TransNb (PyQt5)                      | TSBook2 (Electron + React)                           |
| ---------- | ------------------------------------ | ---------------------------------------------------- |
| **架构模式**   | 模块化 MainWindow + 信号/槽                | React 组件树 + Zustand 状态管理                             |
| **UI 组件化** | 类继承 (BaseCell → MarkdownCell)        | 函数式组件 + Props 传递                                     |
| **主题机制**   | Qt 颜色字典 + 手动 apply\_theme            | CSS 变量 + React 重新渲染                                  |
| **文件操作**   | Python file I/O + QFileSystemWatcher | Electron IPC + fs (主进程)                              |
| **状态通信**   | Qt 信号/槽 + 手动连接                       | Zustand Selector + React 自动渲染                        |
| **数据流**    | 双向 (信号/槽 + 方法调用)                     | 单向 (Action → Store → View)                           |
| **翻译引擎**   | Python async + httpx + SDK           | fetch API + Provider 策略模式 (Ollama/OpenAI/Ark)        |
| **背诵系统**   | SQLite + 完整 DAL/Ebbinghaus           | 完整实现 (better-sqlite3 + IPC + RecitationService + UI) |
| **单元测试**   | 无                                    | Vitest + React Testing Library                       |
| **快捷键**    | QShortcut + CellConfig 常量            | React KeyboardEvent + Hook                           |
| **构建打包**   | N/A (Python 脚本)                      | Vite + electron-builder                              |

***

## 10. 性能考虑

- **状态更新**: Zustand 使用不可变更新，React 通过 shallow compare 选择性重新渲染受影响的组件
- **单元格列表**: 使用 key={cell.id} 优化列表渲染，避免不必要的 DOM 重建
- **TipTap 编辑器**: 仅当对应单元格处于编辑状态时才创建编辑器实例
- **文件操作**: 所有文件 I/O 在 Electron 主进程执行，不阻塞渲染进程
- **设置持久化**: 已实现 500ms 防抖批量保存（`debouncedSave`），避免频繁磁盘写入
- **内容溢出**: CSS 全局 `box-sizing: border-box` 防止布局溢出

***

## 11. 安全考虑

- **上下文隔离**: Electron 启用 `contextIsolation: true`，禁用 `nodeIntegration`
- **API 密钥**: 从系统环境变量读取（通过 `apiKeyEnv` 配置），settings.json 中仅存储环境变量名
- **文件操作范围**: 通过 `readDirectory` 过滤只显示 .transnb 文件
- **路径安全**: 所有文件路径由 Electron 主进程处理，渲染进程不直接访问文件系统

***

## 12. 版本状态

> 当前版本: **v1.3** | 最后更新: 2026-06-18

### v1.1 (已完成)

- [x] 单元格编辑/阅读模式切换（阅读模式使用 `marked` 渲染）
- [x] 译文区 Markdown 渲染
- [x] 翻译引擎集成（OllamaProvider / OpenAIProvider / ArkProvider）
- [x] 翻译连接测试与批量翻译
- [x] 宽度控制（单元格宽度比例滑块）
- [x] 服务层提取（从 notebookStore 提取业务逻辑到 Service Hooks）

### v1.2 (已完成)

- [x] 背诵模式完整实现（数据层 → IPC → 服务层 → UI 组件）
- [x] 翻译进度可视化增强（逐单元格状态跟踪 + Panel 进度 + 状态指示器）
- [x] 代码质量重构（死代码清理、类型统一、Store 解耦、IPC 类型安全）
- [x] `readClipboard` IPC 通道
- [x] 单词 CRUD 弹窗（WordManagerDialog + WordEditorDialog）
- [x] welcome 欢迎页面

### v1.3 (已完成)

- [x] 学习统计面板（StatsPanel 环形图 + 6 阶段分布 + 关键指标卡片）
- [x] 阶段筛选（BookCard 分段进度条，双击筛选，WordManager 按阶段过滤）
- [x] 测验结果反馈（WordListItem 答对/答错绿红标记 + 边框，quizResultsByBook 追踪）
- [x] Ctrl+点击范围批量选中单词（selectWordRange）
- [x] 已测单词持久化追踪（markWordsAsTested + testedNewWordIds/testedReviewWordIds）
- [x] 悬停选项切换显示对应文本（FloatingOptions pairText）
- [x] 后端 API 扩展（markWordsAsTested, getStageDistribution, getWordsByStage）

### 待办 (详见 [TODO.md](file:///g:/program/TSBook2/doc/TODO.md))

- [x] 快捷键完善（`Ctrl+S` 保存、`Ctrl+O` 打开、`Ctrl+Enter` 翻译等）
- [ ] 翻译错误重试机制
- [ ] 翻译缓存
- [ ] 文章生成器集成（背诵模式场景文章 → .transnb）
- [ ] 环境变量配置 UI 增强
- [x] 图标 SVG 美化
- [ ] 用户自定义主题

