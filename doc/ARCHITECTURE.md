# TSBook2 软件架构文档

本文档为 TSBook2 架构的章节索引。完整内容请参阅 [doc/v1.3/ARCHITECTURE.md](v1.3/ARCHITECTURE.md)。

---

## 1. 项目概述

TSBook2 是"翻译笔记本"(TransNb)的 TypeScript/React 重构版本。采用 Electron + React 19 + TypeScript 技术栈，VS Code 风格 IDE 布局，Zustand 状态管理，TipTap 编辑器，better-sqlite3 数据库。

> 技术栈对比表见 [v1.3/ARCHITECTURE.md §1](v1.3/ARCHITECTURE.md#1-项目概述)

---

## 2. 系统架构

### 2.1 整体架构图

- **Electron 主进程**: main.ts（窗口+IPC）+ preload.ts（桥接）+ recitation/（DAL + Service + Importer）
- **React 渲染进程**: 入口层 → 布局层 → 业务组件 → 服务层 → Store → 工具层 → 类型定义

> 完整架构图见 [v1.3/ARCHITECTURE.md §2.1](v1.3/ARCHITECTURE.md#21-整体架构图)

### 2.2 进程架构

Electron Main Process ↔ preload.ts (contextBridge) ↔ Renderer Process (React AppShell: 正常模式 ↔ 背诵模式 + Service Layer + Zustand Stores)

> 进程架构图见 [v1.3/ARCHITECTURE.md §2.2](v1.3/ARCHITECTURE.md#22-进程架构)

---

## 3. 核心模块详解

### 3.1 Electron 主进程 (electron/)

- **main.ts**: BrowserWindow 管理、IPC 处理器（文件操作/对话框/设置/背诵）
- **preload.ts**: contextBridge 暴露类型安全 API
- **recitation/**: 背诵模式数据层（database、DAL、Ebbinghaus、bookService、studyService、bookImporter）

> 完整 IPC 表与安全设计见 [v1.3/ARCHITECTURE.md §3.1](v1.3/ARCHITECTURE.md#31-electron-主进程-electron)

### 3.2 状态管理层 (store/)

Zustand 管理 6 个独立 Store：

| Store | 职责 |
|-------|------|
| **notebookStore** | 单元格数据、多文件、选择状态（v1.2 回调解耦） |
| **workspaceStore** | 工作区、侧边栏/面板可见性 |
| **themeStore** | 主题（light/dark） |
| **settingStore** | 应用设置 + 500ms debounced 持久化（v1.2 回调解耦 themeStore） |
| **recitationStore** | 背诵 UI 状态（阶段、侧边栏、选择、测验、同步追踪） |
| **outputStore** | 日志输出 |

> 详细结构见 [v1.3/ARCHITECTURE.md §3.2](v1.3/ARCHITECTURE.md#32-状态管理层-store)

### 3.3 布局层 (components/layout/)

`AppShell` → `ActivityBar` + `Sidebar` + 主区域 + `StatusBar` + `Panel`。背诵模式下隐藏通用 Sidebar。

### 3.4 笔记本编辑器组件 (components/notebook/)

`NotebookEditor`（单元格列表 + 动态宽度）+ `NotebookToolbar`（文件操作 + 翻译 + 设置）

### 3.5 单元格组件 (components/cells/)

`CellContainer` → `CellToolbar` + `CellEditor`（TipTap）+ `CellOutput`（marked）+ `CellCollapseIndicator`

### 3.6 文件浏览器 (components/file/)

`FileExplorer` — 浏览 .transnb 文件、目录展开/折叠、右键菜单、新建/导入/刷新。

### 3.7 设置对话框 (components/settings/)

`SettingsDialog` — 四个标签页：General、Translation、Prompts、Models。

### 3.8 工具层

`fileUtils`（解析/序列化/分割）、`useKeyboard`（快捷键映射）、`useTheme`（CSS 变量映射）

> 快捷键表见 [v1.3/ARCHITECTURE.md §3.8](v1.3/ARCHITECTURE.md#38-工具层)

### 3.9 类型系统 (types/)

| 目录 | 文件 | 说明 |
|------|------|------|
| `types/` | `notebook.ts`, `electron.ts` | 全局类型、IPC 共享类型 |
| `recitation/` | `types.ts`, `quizTypes.ts`, `wordSidebarTypes.ts` | 背诵模式数据模型 + 阶段分布/筛选类型 |

> 完整类型清单见 [v1.3/ARCHITECTURE.md §3.9](v1.3/ARCHITECTURE.md#39-类型系统-types)

### 3.10 主题系统 (styles/)

`themes.ts` — 40 个颜色键（含背诵模式配色 + 6 阶段颜色），`global.css` — 全局样式 + TipTap 样式。

### 3.11 服务层详解 (services/)

服务层接口（FileService / CellService / TranslationService / RecitationService）+ 实现模式（IPC 代理 / 模块级闭包 / 模块级单例 + Hook 包装）。

> 完整接口定义见 [v1.3/ARCHITECTURE.md §3.11](v1.3/ARCHITECTURE.md#311-服务层详解-services)

### 3.12 翻译模块详解 (translation/)

策略模式：`TranslationProvider` 接口 → `OllamaProvider` / `OpenAIProvider` / `ArkProvider`。ProviderFactory 创建。含逐单元格状态跟踪（200ms 轮询）。

---

## 4. 数据流程

### 4.1 文件打开流程
对话框 → readFile → parseNotebookFile → notebookStore.openFile → 渲染

### 4.2 文件保存流程
serializeNotebookFile → writeFile → setModified(false)

### 4.3 文本导入流程
importDialog → splitTextIntoParagraphs → 创建 cells → openFile

### 4.4 单元格编辑流程
TipTap onChange → updateCellContent → isModified → StatusBar

### 4.5 单元格选中流程
selectCell / selectCellRange → selectedIndices → 高亮渲染 + StatusBar

### 4.6 设置加载/保存流程
loadFromDisk → getSettings → set(...) / set* → debouncedSave → setSettings

### 4.7 主题切换流程
setTheme → colors 更新 → CSS 变量更新 → 组件重渲染

> 详细流程图见 [v1.3/ARCHITECTURE.md §4](v1.3/ARCHITECTURE.md#4-数据流程)

---

## 5. 扩展点

- **新增翻译提供者**: 实现 `TranslationProvider` 接口 → 注册到 `providerFactory`
- **新增侧边栏面板**: workspaceStore 加 tab → Sidebar 加分支 → ActivityBar 加图标
- **新增设置标签页**: SettingsDialog 加标签 → settingStore 加状态 → main.ts 加默认值
- **新增单元格操作**: notebookStore 加方法 → CellToolbar 加按钮 → useKeyboard 加快捷键
- **新增主题**: themes.ts 加配置 → themeStore 注册 → SettingsDialog 加选项

---

## 6. 依赖关系

`AppShell` → `useKeyboard` / `ActivityBar` / `Sidebar` / `NotebookToolbar` / `NotebookEditor` / `Panel` / `RecitationShell` / `StatusBar`

> 完整依赖树见 [v1.3/ARCHITECTURE.md §6](v1.3/ARCHITECTURE.md#6-依赖关系)

---

## 7. 目录结构

```
TSBook2/
├── electron/         # 主进程 (main.ts / preload.ts / recitation/)
├── scripts/          # 开发脚本
├── src/              # 渲染进程
│   ├── components/   # UI 组件 (cells/ / recitation/ / file/ / layout/ / notebook/ / welcome/ / settings/)
│   ├── hooks/        # React Hooks (useKeyboard / useTheme / use*Service)
│   ├── services/     # 服务层接口 + 实现 (TranslationService / RecitationService)
│   ├── translation/  # 翻译模块 (Provider 接口 + Ollama / OpenAI / Ark)
│   ├── store/        # Zustand Stores (6 个)
│   ├── styles/       # 主题 (themes.ts / global.css)
│   ├── types/        # 类型定义 (notebook.ts / electron.ts)
│   ├── recitation/   # 背诵模式类型
│   └── utils/        # 工具函数
├── tests/            # Vitest 测试
└── doc/              # 文档目录 (v1.1/ / v1.2/ / v1.3/)
```

> 完整目录树见 [v1.3/ARCHITECTURE.md §7](v1.3/ARCHITECTURE.md#7-目录结构)

---

## 8. 设计模式

| 模式 | 应用位置 |
|------|----------|
| Flux 状态管理 | Zustand Stores |
| 容器-组件 | CellContainer + CellEditor/CellOutput |
| Hook | useTheme, useKeyboard |
| 桥接 | preload.ts (contextBridge) |
| 工厂 | createEmptyCell, ProviderFactory |
| 适配器 | fileUtils (v1.0 → v2.0) |
| 策略 | 主题系统, 翻译提供者 |
| Service Layer | services/ + hooks/ |
| 回调解耦 | settingStore._onThemeChange |
| 模块级单例 | TranslationService, RecitationService |
| IPC 代理 | recitationService.ts |

> 详细说明见 [v1.3/ARCHITECTURE.md §8](v1.3/ARCHITECTURE.md#8-设计模式)

---

## 9. 与原项目的架构差异

从 PyQt5 迁移到 Electron + React：状态管理（信号/槽 → Zustand）、UI（Widget → React DOM）、翻译（httpx → fetch + Provider）、主题（颜色字典 → CSS 变量）、构建（无 → Vite + electron-builder）。

> 完整对比表见 [v1.3/ARCHITECTURE.md §9](v1.3/ARCHITECTURE.md#9-与原项目的架构差异)

---

## 10. 性能考虑

Zustand 不可变更新 + shallow compare、key={cell.id} 列表优化、按需创建 TipTap 实例、主进程文件 I/O、500ms debounced 持久化。

---

## 11. 安全考虑

contextIsolation、nodeIntegration 禁用、API Key 环境变量、.transnb 文件过滤、主进程路径处理。

---

## 12. 版本状态

> 当前版本: **v1.3** | 最后更新: 2026-06-18

### v1.1 完成
单元格编辑/阅读切换、译文渲染、翻译引擎集成、宽度控制、服务层提取

### v1.2 完成
背诵模式完整实现、翻译进度可视化、代码质量重构、readClipboard IPC、单词 CRUD、欢迎页面

### v1.3 完成
学习统计面板（StatsPanel）、阶段筛选（分段进度条 + WordManager 过滤）、测验结果反馈（绿红标记 + quizResultsByBook）、Ctrl+范围选择（selectWordRange）、已测单词追踪（markWordsAsTested）、悬停 pairText 切换、后端 API 扩展

### 待办
翻译错误重试、翻译缓存、文章生成器集成、环境变量 UI 增强、用户自定义主题

> 详细版本清单见 [v1.3/ARCHITECTURE.md §12](v1.3/ARCHITECTURE.md#12-版本状态)
