# TSBook2 软件架构 — 项目概述与系统架构

## 1. 项目概述

TSBook2 是"翻译笔记本"(TransNb)的 TypeScript/React 重构版本。原项目基于 PyQt5 构建，TSBook2 采用 Electron + React + TypeScript 技术栈重新实现，继承了核心的单元格笔记本编辑和翻译功能，采用 VS Code 风格的 IDE 式 UI 布局，提供更好的跨平台体验和现代化前端开发流程。

### 核心理念
- **IDE 式布局**: 采用类似 VS Code 的活动栏(ActivityBar)、侧边栏(Sidebar)、编辑器区域和状态栏(StatusBar)布局
- **状态管理集中化**: 使用 Zustand 统一管理应用状态，替代原项目的 Qt 信号/槽机制
- **组件化架构**: 所有 UI 元素均为 React 函数组件，支持灵活组合和复用
- **层级无关的文件格式**: 继承原项目的 .transnb v2.0 文件格式，支持单元格父子从属关系
- **IPC 模块化**: 主进程 IPC 处理器按职责拆分为独立模块，main.ts 仅保留窗口管理和处理器注册

### 技术栈

| 技术 | 用途 |
|------|------|
| Electron 33 | 桌面应用框架，提供原生窗口、文件系统、对话框 API |
| React 19 | UI 框架 |
| TypeScript | 类型安全 |
| Vite 6 | 前端构建工具和开发服务器 |
| Zustand 5 | 轻量级状态管理 |
| TipTap 2 | 富文本编辑器（单元格原文编辑） |
| marked | Markdown 渲染（单元格译文阅读模式） |
| better-sqlite3 | SQLite 数据库（背诵模式数据持久化） |
| Vitest | 单元测试框架 |
| electron-builder | 应用打包 |

### 与原项目(TransNb)对比

| 维度 | TransNb (PyQt5) | TSBook2 (Electron + React) |
|------|-----------------|---------------------------|
| 技术栈 | Python + PyQt5 + httpx | TypeScript + React + Electron |
| 状态管理 | Qt 信号/槽机制 | Zustand 状态管理 |
| UI 渲染 | Qt Widgets | React DOM + CSS |
| Markdown 编辑 | 自实现 ClickableTextEdit | TipTap 富文本编辑器 |
| 翻译引擎 | Python async httpx + SDK | fetch API + Provider 策略模式 (Ollama/OpenAI/Ark) |
| 背诵系统 | SQLite + 完整 DAL/Ebbinghaus | 完整实现 (better-sqlite3 + IPC + RecitationService + UI) |
| 文件格式 | .transnb JSON (v1.0/v2.0) | .transnb JSON (v2.0 兼容, 支持 wordMeta) |
| 主题系统 | Qt 样式表 + 颜色字典 | CSS 变量 + ThemeConfig |
| 构建工具 | 无 (Python 直接运行) | Vite + electron-builder |

## 2. 系统架构

### 2.1 整体架构图

```
TSBook2 应用
├── Electron 主进程 (electron/)
│   ├── main.ts               # 窗口管理 + IPC 处理器注册 (~66 行)
│   ├── preload.ts            # 上下文桥接 (contextBridge)
│   ├── state.ts              # 共享状态模块 (recitationState 单例 + 设置管理)
│   ├── types.ts              # 共享 Electron 类型 (FileEntry, DirEntry, ImportResult)
│   ├── handlers/             # IPC 处理器模块 (v1.4 模块化重构)
│   │   ├── fileHandlers.ts             # 文件操作 (read/write/delete/rename/append/readDirectory)
│   │   ├── dialogHandlers.ts           # 对话框 (open/save/folder/import/book-dialog)
│   │   ├── settingsHandlers.ts         # 设置持久化 (get-settings/set-settings)
│   │   ├── recitationHandlers.ts       # 背诵模式完整 CRUD + 学习流程 + 统计
│   │   └── workspaceConfigHandlers.ts  # 工作区级配置 (workspace-config:get/set)
│   ├── workspace/            # 工作区通用能力
│   │   └── configProvider.ts # 通用配置存取 (ConfigProvider 接口 + FileBasedConfig)
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
│   │   ├── reading/      # 阅读工具组件
│   │   │   └── ReadingTimer.tsx     # 阅读计时器 (开始/暂停 + 自动停止 + 日志)
│   │   ├── notebook/     # 笔记本组件
│   │   │   ├── NotebookEditor.tsx   # 笔记本编辑器主区域
│   │   │   └── NotebookToolbar.tsx  # 笔记本工具栏 (含翻译全部 + ReadingTimer + i18n)
│   │   ├── cells/        # 单元格组件
│   │   │   ├── CellContainer.tsx    # 单元格容器 (含翻译状态指示器)
│   │   │   ├── CellEditor.tsx       # 单元格原文编辑器
│   │   │   ├── CellOutput.tsx       # 单元格译文输出
│   │   │   ├── CellToolbar.tsx      # 单元格操作工具栏 (含 ★ 收藏按钮)
│   │   │   └── CellCollapseIndicator.tsx  # 折叠指示器
│   │   ├── recitation/   # 背诵模式组件
│   │   │   ├── RecitationShell.tsx     # 背诵模式主容器
│   │   │   ├── BookManagerPanel.tsx    # 词书管理面板
│   │   │   ├── BookCard.tsx            # 词书卡片
│   │   │   ├── StatsPanel.tsx          # 学习统计面板（环形图）
│   │   │   ├── QuizPanel.tsx           # 检测面板 (4选1)
│   │   │   ├── FloatingOptions.tsx     # 悬浮选项动画
│   │   │   ├── ReviewPanel.tsx         # 回顾总结面板
│   │   │   ├── WordSidebar.tsx         # 单词侧边栏
│   │   │   ├── WordListItem.tsx        # 单词条目
│   │   │   ├── WordManagerDialog.tsx   # 单词管理弹窗
│   │   │   ├── WordEditorDialog.tsx    # 单词编辑弹窗
│   │   │   └── ResizeHandle.tsx        # 拖拽分割条
│   │   ├── file/         # 文件浏览组件
│   │   │   └── FileExplorer.tsx     # 文件浏览器 (含右键"设为收藏夹" + ★ 星标图标)
│   │   ├── welcome/      # 欢迎页面
│   │   │   └── WelcomePage.tsx      # 欢迎页
│   │   └── settings/     # 设置组件
│   │       └── SettingsDialog.tsx   # 设置对话框
│   ├── 服务层 (services/)
│   │   ├── types.ts              # 服务层接口定义
│   │   ├── index.ts              # 统一导出 (仅类型)
│   │   ├── translationService.ts # 翻译服务 (模块级单例)
│   │   ├── recitationService.ts  # 背诵服务 (IPC 代理)
│   │   └── logService.ts         # 日志服务 (异步写入队列, append-file IPC)
│   ├── 翻译模块 (translation/)
│   │   ├── types.ts              # TranslationProvider 接口 + ProviderInfo
│   │   ├── providerFactory.ts    # 提供者工厂
│   │   └── providers/
│   │       ├── ollama.ts         # Ollama 提供者
│   │       ├── openai.ts         # OpenAI 兼容提供者
│   │       └── ark.ts            # 火山引擎 Ark 提供者
│   ├── 状态管理层 (store/)
│   │   ├── notebookStore.ts    # 笔记本数据状态 (Zustand)
│   │   ├── workspaceStore.ts   # 工作区状态 (Zustand)
│   │   ├── themeStore.ts       # 主题状态 (Zustand)
│   │   ├── settingStore.ts     # 设置状态 (Zustand + 持久化)
│   │   ├── recitationStore.ts  # 背诵模式 UI 状态 (Zustand)
│   │   ├── outputStore.ts      # 日志输出 Store
│   │   └── workspaceConfigStore.ts # (v1.4) 工作区级配置 Store
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
│   │   │   ├── useRecitationService.ts  # 背诵服务 Hook (单例)
│   │   │   └── useBookmark.ts         # 单元格收藏 Hook (v1.4 新增)
│   ├── 类型定义 (types/)
│   │   ├── notebook.ts    # 全局类型 (含 Window.electronAPI 类型)
│   │   ├── electron.ts    # IPC 共享类型 (FileEntry, DirEntry, ImportResult)
│   │   └── vite-env.d.ts  # Vite 类型声明
│   ├── 背诵模式类型 (recitation/)
│   │   ├── types.ts            # Book/Word/UserStudy/TodayWordsResult 等
│   │   ├── quizTypes.ts        # QuizState/QuizQuestion/QuizOption
│   │   ├── wordSidebarTypes.ts # WordSidebarData/WordDisplay/ReviewWordBatch
│   │   └── ebbinghaus.ts       # 前端艾宾浩斯算法
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
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │  Window Mgmt │  │     IPC 处理器模块 (handlers/)       │  │
│  │  - create() │  │  ┌─────────────────────────────────┐ │  │
│  │  - loadURL()│  │  │ fileHandlers: read/write/append │ │  │
│  │  - menu     │  │  │ dialogHandlers: open/save/import│ │  │
│  │             │  │  │ settingsHandlers: get/set       │ │  │
│  │  state.ts   │  │  │ recitationHandlers: CRUD+学习   │ │  │
│  │  ↕ 共享状态   │  │  │ workspaceConfigHandlers       │ │  │
│  │  types.ts   │  │  └─────────────────────────────────┘ │  │
│  │  ↕ 共享类型   │  └──────────────────────────────────────┘  │
│  └─────────────┘                                            │
│                    preload.ts (contextBridge)                 │
└───────────────────────────┬──────────────────────────────────┘
                            │ IPC (invoke/handle)
┌───────────────────────────┼──────────────────────────────────┐
│                    Renderer Process                          │
│  window.electronAPI                                          │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  React Application                                      ││
│  │  AppShell (正常模式 ↔ 背诵模式)                         ││
│  │                                                         ││
│  │  ┌─ 正常模式 ───────────────────────────────────────┐  ││
│  │  │  ActivityBar │ Sidebar > FileExplorer             │  ││
│  │  │  (含右键"设为收藏夹")                             │  ││
│  │  │  NotebookToolbar (含 ReadingTimer)                 │  ││
│  │  │  NotebookEditor                                   │  ││
│  │  │  └── CellContainer[] → CellToolbar(含★收藏)/...   │  ││
│  │  │  Panel (翻译进度 + 日志 + 颜色支持)                │  ││
│  │  └──────────────────────────────────────────────────┘  ││
│  │                                                         ││
│  │  ┌─ 背诵模式 ───────────────────────────────────────┐  ││
│  │  │  ActivityBar │ RecitationShell                    │  ││
│  │  │  ├── BookManagerPanel                             │  ││
│  │  │  │   ├── BookCard[] (分段进度条)                  │  ││
│  │  │  │   └── StatsPanel (学习统计环形图)              │  ││
│  │  │  ├── QuizPanel + FloatingOptions (pairText)       │  ││
│  │  │  ├── ReviewPanel (已测标记)                       │  ││
│  │  │  └── WordSidebar → WordListItem[] (测验结果标记)  │  ││
│  │  └──────────────────────────────────────────────────┘  ││
│  │                                                         ││
│  │  Service Layer: useFileService / useCellService /       ││
│  │                useTranslationService / useRecitationService / ││
│  │                useBookmark / logService                  ││
│  │  Stores: useNotebookStore / useWorkspaceStore /         ││
│  │          useThemeStore / useSettingStore /              ││
│  │          useRecitationStore / useOutputStore /          ││
│  │          useWorkspaceConfigStore                        ││
│  │              └── 集成 logService (append-file IPC)      ││
│  │                  写入 .TransRead/log/                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```
