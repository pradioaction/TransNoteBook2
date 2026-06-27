# TSBook2 软件架构 — 数据流程、扩展点与参考

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
    notebookStore.setFilePath(path)
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
notebookStore.selectCell(index) 或 selectCellRange(from, to)
    ↓
selectedIndices 更新
    ↓
CellContainer 根据 isSelected 属性高亮
    ↓
StatusBar 更新选中计数
```

### 4.6 设置加载/保存流程
```
App 启动 → settingStore.loadFromDisk() → electronAPI.getSettings() → set({...})
设置变更 → set* 方法 → debouncedSave() (500ms 防抖) → saveToDisk() → electronAPI.setSettings(state)
```

### 4.7 主题切换流程
```
用户在 SettingsDialog 切换主题
    ↓
themeStore.setTheme('light' | 'dark')
    ↓
set({ theme, colors: themes[theme] })
    ↓
useTheme hook 重新计算 cssVars
    ↓
React 重新渲染，CSS 变量更新 (--foreground, --background)
```

### 4.8 日志写入流程
```
组件调用 useOutputStore.getState().addLog(message, level, color?)
    ↓
outputStore 生成 LogEntry { id, timestamp, message, level, color? }
    ↓
set(state => logs.push(entry))  →  Panel 实时显示 (优先 log.color)
    ↓
logService.appendToFile(todayPath, `[HH:mm:ss] [LEVEL] message\n`)
    ↓
window.electronAPI.appendFile(filePath, content)
    ↓
fs.appendFileSync → 日志文件直接追加 (无需队列/防并发锁)
    ↓
日志文件: {workspace}/.TransRead/log/{yyyy-MM-dd}.log
```

v1.4 增强: addLog 支持第三个可选参数 `color`, Panel 渲染日志时优先取 `log.color`, 降级为 `logColors[log.level]`.
颜色约定: `#4caf50` 成功(绿), `#d4a017` 警告(琥珀), `#e06c75` 错误(红), 其余使用默认前景色.
v1.4 变更: 日志写入从 `readFile → writeFile (追加)` 改为直接使用 `append-file` IPC 通道, 无需队列和防并发锁.

触发入口:
- ReadingTimer.stopTimer() → 阅读计时停止时
- ReviewPanel 测验保存完成 → 测验结果统计
- **useBookmark.addCurrentCellToBookmark()** → 收藏成功/失败反馈

### 4.9 单元格收藏流程 (v1.4)
```
用户选中 Cell → 点击工具栏 ★ 按钮
    ↓
useBookmark.addCurrentCellToBookmark()
    ↓
├─ bookmarkFilePath 为空:
│     addLog('⚠️ 尚未设置收藏夹...', 'warn', '#d4a017')   → Panel
│
└─ bookmarkFilePath 已存在:
      electronAPI.readFile(bookmarkFilePath)
          ↓
      parseNotebookFile(content) → NotebookData
          ↓
      创建新 Cell (仅 content + output, 无层级)
          ↓
      data.cells.push(bookmarkCell)
          ↓
      electronAPI.writeFile(filePath, serializeNotebookFile())
          ↓
      若目标文件已打开 → 仅更新 openFiles 中对应条目, 不触碰当前文件
          ↓
      addLog('✅ 已收藏到 xxx（第 N 个）', 'info', '#4caf50')   → Panel
```

## 5. 扩展点

### 5.1 新增翻译提供者
1. 在 translation/providers/ 下实现新 Provider 类, 实现 TranslationProvider 接口
2. 在 translation/types.ts 添加配置类型
3. 在 providerFactory.ts 的 buildProvider() 添加分支
4. 在 SettingsDialog Models 标签页添加配置 UI

### 5.2 新增侧边栏面板
1. workspaceStore 添加新 sidebarActiveTab 值
2. Sidebar.tsx 添加条件渲染分支
3. ActivityBar.tsx 添加图标按钮

### 5.3 新增设置标签页
1. SettingsDialog.tsx 添加标签按钮和渲染分支
2. settingStore 添加状态和方法
3. electron/handlers/settingsHandlers.ts 默认设置添加对应字段

### 5.4 新增单元格操作
1. notebookStore 添加操作方法
2. CellToolbar.tsx 添加按钮
3. useKeyboard.ts 添加快捷键

### 5.5 新增主题
1. themes.ts 添加新 ThemeConfig
2. themeStore.ts 的 themes 字典注册
3. SettingsDialog 添加选择选项

### 5.6 新增日志输出入口
1. 在目标组件中 import { useOutputStore } from '@/store/outputStore'
2. 调用 useOutputStore.getState().addLog(message, level, color?)
3. 日志自动写入底部 Panel 和当日 .log 文件

### 5.7 新增 IPC 处理器 (v1.4)
1. 在 electron/handlers/ 下创建新模块, 实现 `export function register*Handlers()`
2. 在 electron/main.ts 的 `registerAllHandlers()` 中添加调用

### 5.8 新增工作区级配置项 (v1.4)
1. 在 workspaceConfigHandlers 中扩展 IPC 通道或直接使用已有 `workspace-config:get/set`
2. 在 workspaceConfigStore 中添加状态字段和操作方法

## 6. 依赖关系

```
AppShell
├── useKeyboard (全局快捷键)
├── ActivityBar → useWorkspaceStore
├── Sidebar → useWorkspaceStore / FileExplorer / useTheme
├── NotebookToolbar → useFileService / useNotebookStore / SettingsDialog / ReadingTimer
│   └── ReadingTimer → useNotebookStore / useRecitationStore / useOutputStore / useTheme
├── NotebookEditor → useNotebookStore / useCellService / CellContainer[]
│   └── CellContainer → CellToolbar / CellEditor (TipTap) / CellOutput (marked) / CellCollapseIndicator
│       └── CellToolbar → useBookmark
│           └── useBookmark → useNotebookStore / workspaceConfigStore / parseNotebookFile / serializeNotebookFile
├── Panel → useTranslationService / useTheme / useOutputStore
│   └── useOutputStore.addLog() → logService.appendToFile() → electronAPI.appendFile()
├── RecitationShell → useRecitationService / useRecitationStore
│   └── BookManagerPanel / QuizPanel / ReviewPanel → useOutputStore.addLog()
└── StatusBar → useNotebookStore / useTheme
```

## 7. 目录结构

```
TSBook2/
├── electron/
│   ├── main.ts                    # Electron 主进程 (窗口管理 + IPC 处理器注册)
│   ├── preload.ts                 # 上下文桥接 (contextBridge)
│   ├── state.ts                   # 共享状态模块 (recitationState + 设置管理)
│   ├── types.ts                   # 共享 Electron 类型 (FileEntry, DirEntry, ImportResult)
│   ├── handlers/                  # IPC 处理器模块 (v1.4 模块化重构)
│   │   ├── fileHandlers.ts        # 文件操作 (read/write/delete/rename/append/readDirectory)
│   │   ├── dialogHandlers.ts      # 对话框 (open/save/folder/import/book-dialog)
│   │   ├── settingsHandlers.ts    # 设置持久化 (get-settings/set-settings)
│   │   ├── recitationHandlers.ts  # 背诵模式完整 CRUD + 学习 + 统计
│   │   └── workspaceConfigHandlers.ts  # 工作区级配置 (workspace-config:get/set)
│   ├── workspace/                 # 工作区通用能力
│   │   └── configProvider.ts      # 通用配置存取 (ConfigProvider 接口 + FileBasedConfig)
│   └── recitation/               # 背诵模式数据层
│       ├── database.ts / bookDAL.ts / wordDAL.ts / userStudyDAL.ts
│       ├── recitationDAL.ts / statDAL.ts
│       ├── ebbinghaus.ts / bookImporter.ts
│       └── bookService.ts / studyService.ts
├── scripts/ / tests/
├── src/
│   ├── components/ (cells/ recitation/ file/ layout/ notebook/ welcome/ settings/ reading/)
│   ├── hooks/ (useKeyboard / useTheme / use*Service / useBookmark)
│   ├── services/ (types / translationService / recitationService / logService)
│   ├── translation/ (types / providerFactory / providers/ollama/openai/ark)
│   ├── store/ (notebookStore / workspaceStore / themeStore / settingStore / recitationStore / outputStore / workspaceConfigStore)
│   ├── styles/ (global.css / themes.ts)
│   ├── types/ (notebook.ts / electron.ts)
│   ├── recitation/ (types / quizTypes / wordSidebarTypes / ebbinghaus)
│   └── utils/ (fileUtils / articleUtils)
├── dist-electron/ / index.html / package.json / tsconfig.json / vite.config.ts
└── doc/ (TODO.md / API.md / ARCHITECTURE.md / v1.1/ / v1.2/ / v1.3/ / v1.4/)
```

## 8. 设计模式

| 模式 | 应用位置 |
|------|----------|
| 状态管理模式 (Flux) | Zustand Stores |
| 容器-组件模式 | CellContainer + CellEditor/CellOutput |
| Hook 模式 | useTheme, useKeyboard |
| 桥接模式 | preload.ts (contextBridge) |
| 观察者模式 | Zustand subscribe |
| 工厂模式 | createEmptyCell(), ProviderFactory |
| 适配器模式 | fileUtils (v1.0 → v2.0) |
| 策略模式 | 主题系统 (light/dark), 翻译提供者 |
| Service Layer 模式 | services/ + hooks/ |
| 回调解耦模式 | settingStore._onThemeChange → App.tsx |
| 模块级单例模式 | TranslationService, RecitationService |
| IPC 代理模式 | recitationService.ts |
| 模块化注册模式 | handlers/ 各模块 register*Handlers (v1.4) |

## 9. 与原项目的架构差异

| 维度 | TransNb (PyQt5) | TSBook2 (Electron + React) |
|------|-----------------|---------------------------|
| 架构模式 | 模块化 MainWindow + 信号/槽 | React 组件树 + Zustand 状态管理 |
| UI 组件化 | 类继承 (BaseCell → MarkdownCell) | 函数式组件 + Props 传递 |
| 主题机制 | Qt 颜色字典 + 手动 apply_theme | CSS 变量 + React 重新渲染 |
| 文件操作 | Python file I/O + QFileSystemWatcher | Electron IPC + fs (主进程) |
| 状态通信 | Qt 信号/槽 + 手动连接 | Zustand Selector + React 自动渲染 |
| 数据流 | 双向 (信号/槽 + 方法调用) | 单向 (Action → Store → View) |
| 翻译引擎 | Python async + httpx + SDK | fetch API + Provider 策略模式 |
| 背诵系统 | SQLite + 完整 DAL/Ebbinghaus | 完整实现 (better-sqlite3 + IPC + Service + UI) |
| 单元测试 | 无 | Vitest + React Testing Library |
| 快捷键 | QShortcut + CellConfig 常量 | React KeyboardEvent + Hook |
| 构建打包 | N/A (Python 脚本) | Vite + electron-builder |

## 10. 性能考虑

- Zustand 不可变更新 + shallow compare 选择性重渲染
- key={cell.id} 列表优化
- TipTap 编辑器按需创建 (编辑状态才初始化)
- 文件 I/O 在 Electron 主进程执行, 不阻塞渲染进程
- 设置 500ms 防抖批量保存 (debouncedSave)
- CSS 全局 box-sizing: border-box 防止布局溢出
- v1.4: append-file IPC 使用 fs.appendFileSync 直接追加, 无需 read-modify-write 循环

## 11. 安全考虑

- contextIsolation: true, nodeIntegration: false
- API Key 从环境变量读取, settings.json 仅存环境变量名
- readDirectory 过滤只显示 .transnb 文件
- 文件路径由 Electron 主进程处理, 渲染进程不直接访问文件系统

## 12. 版本状态

> 当前版本: v1.4 | 最后更新: 2026-06-27

### v1.1 (已完成)
- 单元格编辑/阅读模式切换 (marked 渲染)
- 译文区 Markdown 渲染
- 翻译引擎集成 (OllamaProvider / OpenAIProvider / ArkProvider)
- 翻译连接测试与批量翻译
- 宽度控制 (单元格宽度比例滑块)
- 服务层提取

### v1.2 (已完成)
- 背诵模式完整实现 (数据层 → IPC → 服务层 → UI 组件)
- 翻译进度可视化增强 (逐单元格状态 + Panel + 指示器)
- 代码质量重构 (死代码清理、类型统一、Store 解耦、IPC 类型安全)
- readClipboard IPC 通道
- 单词 CRUD 弹窗 (WordManagerDialog + WordEditorDialog)
- welcome 欢迎页面

### v1.3 (已完成)
- 学习统计面板 (StatsPanel 环形图 + 6 阶段分布 + 关键指标卡片)
- 阶段筛选 (BookCard 分段进度条, 双击筛选, WordManager 按阶段过滤)
- 测验结果反馈 (WordListItem 答对/答错绿红标记 + 边框, quizResultsByBook 追踪)
- Ctrl+点击范围批量选中单词 (selectWordRange)
- 已测单词持久化追踪 (markWordsAsTested + testedNewWordIds/testedReviewWordIds)
- 悬停选项切换显示对应文本 (FloatingOptions pairText)
- 后端 API 扩展 (markWordsAsTested, getStageDistribution, getWordsByStage)

### v1.4 (已完成)
- **IPC Handler 模块化 (P0-4)**: main.ts 从 ~548 行精简至 ~66 行, 提取 5 个 handler 模块
- **Electron 状态与类型共享**: 新增 `state.ts` (recitationState 单例) 和 `types.ts` (FileEntry/DirEntry/ImportResult)
- **ConfigProvider 模式**: `electron/workspace/configProvider.ts` 通用配置存取接口
- **工作区级配置**: `workspace-config` IPC 通道 + `workspace-config.json` 持久化
- **workspaceConfigStore**: 管理 `bookmarkFilePath`, 独立的 Zustand Store
- **单元格收藏功能**: `useBookmark` hook (读 → 追加 Cell → 写回 → 刷新 UI)
- **文件浏览器增强**: FileExplorer 右键"设为收藏夹" + ★ 星标图标
- **CellToolbar 增强**: ★ 收藏按钮
- **outputStore 颜色支持**: `addLog` 第三参数 `color`, Panel 颜色渲染
- **日志模块优化**: logService 重写, 使用 `append-file` IPC + 队列消除
- **日志清理**: logService.cleanupOldLogs() 自动清理超期日志
- **词书操作增强**: 词书重命名/导出/批量删除 IPC
- **类型安全加固**: electronAPI 类型统一到 `types/notebook.ts`, 移除 preload.ts 重复类型
- **背诵增强**: rename-book / export-book / export-book-to-dialog / batch-delete-words IPC

### 待办
- 翻译错误重试机制
- 翻译缓存
- 文章生成器集成 (背诵模式场景文章 → .transnb)
- 环境变量配置 UI 增强
- 用户自定义主题
