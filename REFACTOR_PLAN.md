# TSBook2 架构重构方案

> 本文档为 TSBook2 项目架构重构的主计划文档，涵盖问题分析、目标架构和实施路线图。
> 相关子文档: [服务层与模块设计](REFACTOR_PLAN_SERVICES.md)、[文档更新](REFACTOR_PLAN_DOCS.md)

---

## 1. 现状问题分析

### 1.1 核心问题: NotebookStore 上帝对象

当前 `notebookStore` 同时承担三个职责，接口膨胀到 40+ 个方法：

```
NotebookStore 当前职责
├── 文件管理 (openFile / closeFile / save / saveAs)
├── 单元格数据 (cells / content / output)
├── 单元格编辑 (insert / delete / copy / merge / split / move)
├── 选择状态 (selectedIndices / select / clear / range)
├── 折叠状态 (collapse / inputCollapse / outputCollapse)
├── 从属关系 (parentId / indentLevel / dependency)
└── 文件元数据 (path / name / isModified / openFiles)
```

**症状**:
- 单一文件 386 行，逻辑密度极高
- 文件操作逻辑在 `NotebookToolbar` 和 `FileExplorer` 中重复实现
- 未来添加翻译/背诵/AI 功能会进一步膨胀 Store

### 1.2 次要问题

| 问题 | 说明 | 影响 |
|------|------|------|
| 文件操作重复 | 两个组件各有 handleSave/handleSaveAs/handleImportText | 维护负担翻倍 |
| 设置即时写盘 | 每次 set* 都调用 saveToDisk() | 性能浪费，无防抖 |
| 缺少翻译服务层 | 设置面板已配置 ollama/openai，但无实际调用层 | AI 翻译功能无法接入 |
| 缺少背诵模块 | 原项目完整功能 | 功能缺口 |
| 组件→Store 直连 | 组件直接 getState() 调用方法 | 替换 Store 时需要改所有组件 |

---

## 2. 目标架构

### 2.1 分层原则

```
┌───────────────────────────────────────┐
│          Component Layer               │  React 组件，只关心 UI 渲染
│  (CellContainer / NotebookToolbar / …) │  通过 Hook 调用服务
├───────────────────────────────────────┤
│          Service Layer (Hooks)         │  业务逻辑编排，调用 Store + IPC
│  (useFileService / useCellService /   │  可测试，可替换
│   useTranslationService / …)          │
├───────────────────────────────────────┤
│          State Layer (Zustand)        │  纯状态容器，无业务逻辑
│  (notebookStore / workspaceStore / …) │  只存数据，不写文件/不翻译
├───────────────────────────────────────┤
│       Electron IPC Layer (preload)    │  系统接口隔离
│  (readFile / writeFile / dialog / …)  │
└───────────────────────────────────────┘
```

### 2.2 对比: 当前 vs 目标

| 当前 | 目标 |
|------|------|
| 组件直接调 Store | 组件调 Service Hook → Service 调 Store |
| Store 内的 `handleSave` | 独立 `useFileService` Hook |
| Store 内的单元格操作 | 独立 `useCellService` Hook |
| Store 方法混合业务 + 状态 | Store 只存状态，Service 处理业务 |
| 无翻译层 | `useTranslationService` Hook |
| 无背诵层 | `useRecitationService` Hook |

### 2.3 组件树 + 数据流

```
AppShell
├── useKeyboard ← 全局快捷键（不变）
├── ActivityBar
│   └── workspaceStore
├── Sidebar
│   └── FileExplorer ← 通过 useFileService 操作文件
├── NotebookToolbar ← 通过 useFileService 操作文件
│   └── SettingsDialog ← 通过 useSettingStore（不变）
├── NotebookEditor
│   └── CellContainer[]
│       ├── useCellService (编辑/复制/删除/折叠/从属)
│       ├── CellToolbar ← 通过 useCellService 操作
│       ├── CellEditor ← 通过 useCellService 更新内容
│       ├── CellOutput ← 通过 useTranslationService 触发翻译
│       └── CellCollapseIndicator
├── Panel
└── StatusBar
    └── notebookStore（只读读取）
```

---

## 3. 实施路线图

### 阶段 1: 提取 Service Layer (2-3 天)

将现有 NotebookStore 中的业务逻辑迁移到独立的 Service Hooks。

**步骤**:

```
Day 1: 创建 useFileService
  - 从 NotebookToolbar + FileExplorer 提取文件操作
  - 消除重复代码
  - 保留 notebookStore 的文件元数据状态

Day 2: 创建 useCellService
  - 从 notebookStore 提取纯业务方法
  - notebookStore 降维为纯数据容器
  - 保留选择状态在 notebookStore（多个组件需要）

Day 3: 创建 service/index.ts 统一导出
  - 重构所有组件引用
  - 运行测试确保回归
```

### 阶段 2: AI 翻译模块 (3-5 天)

对标原项目的 `src/translation/` 模块。

**步骤**:

```
Day 1: TranslationService (core)
  - Provider 抽象接口
  - OllamaProvider / OpenAIProvider / ArkProvider

Day 2: useTranslationService Hook
  - 翻译触发/进度/结果
  - 连接 CellToolbar 的 ▶ 按钮

Day 3: 连接测试 + 设置集成
  - SettingsDialog 中的连接测试按钮
  - 状态栏翻译进度

Day 4-5: 批量翻译 + 缓存
  - 全部单元格翻译
  - 翻译结果缓存
```

### 阶段 3: 背诵模式模块 (5-7 天)

对标原项目的 `src/recitation/` 模块。

**步骤**:

```
Day 1-2: 数据层 (IndexedDB)
  - Book / Word / UserStudy 模型
  - 数据库初始化 + DAL

Day 2-3: 业务层
  - BookService (导入/管理)
  - StudyService (艾宾浩斯算法)
  - 文章生成器

Day 4-5: UI
  - 背诵模式主页面
  - QuizPage 自测页面
  - 侧边栏新增背诵 Tab

Day 6-7: 集成
  - 与翻译服务联动
  - 文章生成 → 自动打开编辑器
```

### 阶段 4: 工程优化 (1-2 天)

```
Day 1: 设置持久化防抖
  - saveToDisk 加入 500ms 防抖
  - 应用关闭时强制保存

Day 2: 错误处理 + 加载状态
  - 统一错误处理层
  - 文件操作的 loading/error 状态
```

---

## 4. 新增文件清单

```
src/
├── services/
│   ├── index.ts              # 统一导出
│   ├── fileService.ts        # 文件操作服务
│   ├── cellService.ts        # 单元格业务服务
│   ├── translationService.ts # AI 翻译服务
│   ├── recitationService.ts  # 背诵服务
│   └── types.ts              # 服务层类型
├── translation/
│   ├── types.ts              # 翻译提供者类型
│   ├── providers/
│   │   ├── base.ts           # 抽象基类
│   │   ├── ollama.ts         # Ollama 实现
│   │   ├── openai.ts         # OpenAI 实现
│   │   └── ark.ts            # 火山引擎 Ark 实现
│   └── promptTemplates.ts    # 提示词模板
├── recitation/
│   ├── models.ts             # 数据模型
│   ├── database.ts           # IndexedDB 封装
│   ├── bookService.ts        # 词书服务
│   ├── studyService.ts       # 学习服务
│   ├── ebbinghaus.ts         # 艾宾浩斯算法
│   └── articleGenerator.ts   # 文章生成器
├── hooks/
│   ├── useFileService.ts     # (新增)
│   ├── useCellService.ts     # (新增)
│   ├── useTranslationService.ts  # (新增)
│   └── useRecitationService.ts   # (新增)
└── components/
    └── recitation/           # (新增目录)
        ├── RecitationMainPage.tsx
        ├── QuizPage.tsx
        └── RecitationSettingsPanel.tsx
```

---

## 5. 模块通信协议

### 5.1 Service 之间的依赖关系

```
useFileService → electronAPI (IPC)
     ↓
useCellService → notebookStore (状态) + useFileService (持久化)
     ↓
useTranslationService → electronAPI (HTTP via fetch) + notebookStore (输出)
     ↓
useRecitationService → IndexedDB + useTranslationService (文章生成)
```

### 5.2 Store 降维后的接口

重构后 `notebookStore` 从 40+ 方法精简为 **纯状态 + 直接数据操作**：

```typescript
interface NotebookStore {
  // === 只读状态 (其他组件消费) ===
  openFiles: Map<string, NotebookFile>
  activeFilePath: string | null
  selectedIndices: Set<number>
  notebook: NotebookFile
  openFileCount: number

  // === 纯数据操作 (无 IO 无业务) ===
  setCells(cells: NotebookCell[]): void
  setFilePath(path: string | null): void
  setModified(modified: boolean): void

  // 选择操作 (纯状态，多个组件需要)
  selectCell(index: number): void
  selectCellRange(from: number, to: number): void
  toggleCellSelection(index: number): void
  clearSelection(): void

  // 单元格内容更新 (纯状态)
  updateCellContent(index: number, content: string): void
  updateCellOutput(index: number, output: string): void
  setNotebook(notebook: NotebookFile): void
}
```

移出到 `useCellService` 的方法:
- `insertCellAbove / insertCellBelow`
- `deleteSelectedCells / copyCell / splitCellAtCursor / mergeSelectedCells`
- `moveCell`
- `toggleCellCollapse / toggleInputCollapse / toggleOutputCollapse`
- `toggleInputCollapseAll / toggleOutputCollapseAll`
- `toggleInputCollapseSelected / toggleOutputCollapseSelected`
- `makeCellDependent / removeCellDependency / toggleCellDependency`

移出到 `useFileService` 的方法:
- `openFile / closeFile / switchToFile`（保留状态部分在 Store）

---

## 6. 测试策略

| 层 | 测试方式 | 覆盖范围 |
|----|---------|---------|
| Service Hooks | Vitest + mock Store | 业务流程全覆盖 |
| Translation Providers | Vitest + mock fetch | 各提供者 translate/testConnection |
| Recitation 算法 | Vitest 纯函数测试 | 艾宾浩斯算法、文章格式化 |
| Store (精简后) | 保持现有测试 + 补充 | 状态变更正确性 |
| Electron IPC | e2e (Electron testing) | 文件读写/对话框 |

---

## 7. 风险与注意事项

| 风险 | 缓解措施 |
|------|---------|
| 重构期间功能回归 | 先写测试，再迁移；每阶段保持可运行 |
| Service Hook 与 Store 循环依赖 | 单向依赖：Service → Store ✓ |
| IndexedDB 异步带来的复杂度 | 封装 DatabaseManager，提供 try/catch 安全调用 |
| 翻译 API key 安全 | 沿用原项目的 `apiKeyEnv` 环境变量方案 |
| 背单词模块数据量大 | 分页加载，使用虚拟列表渲染 |

---

## 8. 如何阅读本文档体系

```
REFACTOR_PLAN.md              ← 你在这里：整体规划 + 路线图
├── REFACTOR_PLAN_SERVICES.md ← 服务层接口 + AI/翻译/背诵详细设计
└── REFACTOR_PLAN_DOCS.md     ← 已有文档的更新方案
```
