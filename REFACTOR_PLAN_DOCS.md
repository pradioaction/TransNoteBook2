# TSBook2 文档更新方案

> 本文档是 [REFACTOR_PLAN.md](REFACTOR_PLAN.md) 的子文档，定义重构后 [ARCHITECTURE.md](ARCHITECTURE.md) 和 [API.md](API.md) 的更新内容。按 **阶段实施**同步更新，保持文档与代码一致。

---

## 1. 总体原则

| 原则 | 说明 |
|------|------|
| **阶段同步** | 每个阶段完成后立即更新对应文档章节 |
| **接口先行** | Service Layer 接口定义后先更新 API.md，再实现代码 |
| **版本标签** | 每次文档更新在文件头部添加 `<!-- vX.Y -->` 版本注释 |
| **过期清理** | 重构完成后删除 REFACTOR_PLAN_*.md（方案已落地） |

---

## 2. 阶段 1 文档更新（Service Layer 提取）

### 2.1 更新 API.md

**操作**: 在 API.md 中新增第 11 章"服务层 API"。

```markdown
## 11. 服务层 API (Services/)

### 11.1 useFileService (src/services/fileService.ts)

文件操作服务 Hook，统一管理所有文件 I/O。

```typescript
function useFileService(): FileService

interface FileService {
  openFile(): Promise<void>
  saveFile(): Promise<boolean>
  saveFileAs(): Promise<boolean>
  importText(): Promise<void>
  createFile(): Promise<void>
  deleteFile(filePath: string): Promise<void>
  renameFile(oldPath: string, newName: string): Promise<void>
}
```

### 11.2 useCellService (src/services/cellService.ts)

单元格业务服务 Hook，封装所有单元格编辑操作。

```typescript
function useCellService(): CellService

interface CellService {
  insertBelow(): void
  insertAbove(): void
  deleteSelected(): void
  copyCell(index: number): void
  splitCell(index: number, before: string, after: string): void
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
```
```

**同时修改** API.md 的现有章节：

| 修改位置 | 操作 |
|---------|------|
| 第 2.5 节 `NotebookStore` | 精简接口列表，标记已移出的方法 |
| 第 8 节"典型调用流程" | 将所有使用 notebookStore 的示例改为通过 Service Hook |
| 第 3 节"文件工具 API" | 保持不变（纯函数仍在 utils/） |

### 2.2 更新 ARCHITECTURE.md

**修改 1**: 更新第 2.1 节"整体架构图"

```diff
- 状态管理层 (store/)
+ 服务层 (services/)  ← 新增层
+    状态管理层 (store/)
```

**修改 2**: 更新第 2.2 节"进程架构图"

在 React Application 内增加 Service Layer 层级：

```
React Application
├── Service Layer (Hooks)
│   ├── useFileService
│   ├── useCellService
│   ├── useTranslationService
│   └── useRecitationService
├── State Layer (Zustand)
│   └── ...
```

**修改 3**: 更新第 3.2 节 `notebookStore` 的描述

```diff
- notebookStore 接口有 40+ 个方法
+ notebookStore 精简为纯状态容器，约 12 个方法
+ 业务逻辑已迁移至独立的 Service Hooks
```

**修改 4**: 更新第 6 节"依赖关系图"

增加 Service Layer 层，将 NotebookStore → 组件 的依赖改为 Service Layer → Store / 组件 → Service Layer

**修改 5**: 更新第 8 节"设计模式"

新增条目：

```
| **服务层模式** | Service Hooks | 业务逻辑与状态分离，通过 Hook 注入 |
```

---

## 3. 阶段 2 文档更新（AI 翻译模块）

### 3.1 更新 API.md

**新增第 12 章"翻译服务 API"**:

```markdown
## 12. 翻译服务 API (translation/)

### 12.1 TranslationProvider

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

### 12.2 OllamaProvider
- POST `{baseUrl}/api/generate`
- 配置: baseUrl, model, timeout

### 12.3 OpenAIProvider
- POST `{baseUrl}/chat/completions`
- 配置: baseUrl, model, apiKeyEnv, timeout, proxy

### 12.4 ArkProvider
- POST `{endpoint}/chat/completions` (VolcEngine Ark)
- 配置: endpoint, model, apiKeyEnv, timeout

### 12.5 ProviderFactory
```typescript
function buildProvider(model: CustomModel): TranslationProvider
function createSystemProviders(): TranslationProvider[]
function createCustomProviders(models: CustomModel[]): TranslationProvider[]
```

### 12.6 useTranslationService
```typescript
function useTranslationService(): TranslationService

interface TranslationService {
  listProviders(): ProviderInfo[]
  setCurrentProvider(id: string): void
  translateCell(index: number): Promise<void>
  translateAll(): Promise<void>
  translateCells(indices: number[]): Promise<void>
  testConnection(providerId: string): Promise<boolean>
  getStatus(): TranslationStatus
  cancel(): void
}
```
```

### 3.2 更新 ARCHITECTURE.md

**修改 1**: 整体架构图中增加翻译模块

```diff
+ ├── 翻译模块 (translation/)
+ │   ├── TranslationProvider (接口)
+ │   ├── OllamaProvider
+ │   ├── OpenAIProvider
+ │   ├── ArkProvider
+ │   └── ProviderFactory
```

**修改 2**: 新增第 3.11 节"翻译模块详解"

内容结构：
- **架构**: Provider 接口 → 三种实现 → Factory 创建
- **数据流**: 用户点击 ▶ → useTranslationService → Provider.translate → notebookStore.updateCellOutput
- **提供者 ID 规范**: `system_Ollama`, `system_OpenAI`, `custom_{name}`
- **API Key 安全**: 沿用 `apiKeyEnv` 环境变量方案

**修改 3**: 更新第 4 节"数据流程"，新增"翻译流程"

```
用户点击 ▶ (CellToolbar)
    ↓
useTranslationService.translateCell(index)
    ↓
读取 notebookStore.notebook.cells[index].content
    ↓
读取 settingStore.promptTemplates.analysis
    ↓
currentProvider.translate(text, template, signal)
    ↓
Ollama: POST /api/generate
OpenAI: POST /chat/completions
Ark:    POST {endpoint}/chat/completions
    ↓
解析响应 → result
    ↓
notebookStore.updateCellOutput(index, result)
    ↓
CellOutput 重新渲染
```

---

## 4. 阶段 3 文档更新（背诵模式模块）

### 4.1 更新 API.md

**新增第 13 章"背诵模式 API"**:

```markdown
## 13. 背诵模式 API (recitation/)

### 13.1 数据模型
- Book, Word, UserStudy, BookProgress

### 13.2 RecitationDatabase (IndexedDB)
- initialize, getConnection, CRUD 方法

### 13.3 BookService
- importBook, getAllBooks, getBookProgress, deleteBook, exportBook

### 13.4 StudyService
- getTodayWords, startStudy, reviewWord, startBatch, reviewBatch

### 13.5 EbbinghausAlgorithm（纯函数）
- getInitialState, calculateReview, updateWeight
- 9 个阶段：5min → 30min → 12h → 1d → 2d → 4d → 7d → 15d → 30d

### 13.6 ArticleGenerator
- generateAndOpen：AI 生成文章 → 保存 .transnb → 编辑器打开
```

### 4.2 更新 ARCHITECTURE.md

**修改 1**: 整体架构图中增加背诵模块

```diff
+ ├── 背诵模块 (recitation/)
+ │   ├── RecitationDatabase (IndexedDB)
+ │   ├── BookService
+ │   ├── StudyService
+ │   ├── EbbinghausAlgorithm
+ │   ├── ArticleGenerator
+ │   └── UI 组件
+ │       ├── RecitationMainPage
+ │       ├── QuizPage
+ │       └── RecitationSettingsPanel
```

**修改 2**: 新增第 3.12 节"背诵模式模块详解"

**修改 3**: 更新第 4 节"数据流程"，新增"背诵学习流程"和"文章生成流程"

学习流程：
```
用户选择词书 → 今日单词 → 开始学习 (stage=0, 5min)
    ↓
复习时自评正确/错误
    ↓
EbbinghausAlgorithm.calculateReview(stage, weight, correct)
    ↓
正确: stage+1, 间隔延长; 错误: stage-1, 间隔缩短
    ↓
更新 UserStudy → 下次复习时间
```

**修改 4**: 更新第 6 节"依赖关系图"

```diff
+ 背诵模式
+ ├── RecitationDatabase
+ ├── BookService → RecitationDatabase
+ ├── StudyService → RecitationDatabase + EbbinghausAlgorithm
+ └── ArticleGenerator → TranslationService + FileService
```

**修改 5**: 更新目录结构

在第 7 节目录结构中新增：

```
├── translation/
│   ├── types.ts
│   ├── providerFactory.ts
│   ├── promptTemplates.ts
│   └── providers/
│       ├── base.ts
│       ├── ollama.ts
│       ├── openai.ts
│       └── ark.ts
├── recitation/
│   ├── models.ts
│   ├── database.ts
│   ├── bookService.ts
│   ├── studyService.ts
│   ├── ebbinghaus.ts
│   └── articleGenerator.ts
```

---

## 5. 文档 DIFF 清单（最终状态）

重构完成后，文档的最终变化汇总：

### 5.1 ARCHITECTURE.md 变化量

| 章节 | 变化类型 | 内容 |
|------|---------|------|
| 2.1 整体架构图 | 修改 | 增加 Service Layer / Translation / Recitation 三个模块 |
| 2.2 进程架构图 | 修改 | React Application 内增加 Service Layer 层级 |
| 3.2 状态管理层 | 修改 | notebookStore 描述降维 |
| 3.11 翻译模块 | 新增 | 完整翻译模块详解 |
| 3.12 背诵模块 | 新增 | 完整背诵模块详解 |
| 4 数据流程 | 添加 | 新增翻译/背诵/文章生成流程 |
| 6 依赖关系 | 修改 | 增加 Service Layer 依赖链 |
| 7 目录结构 | 修改 | 增加 3 个新目录 |
| 8 设计模式 | 添加 | 增加服务层模式条目 |

**预计篇幅变化**: ~700 行 → ~1300 行（+85%）

### 5.2 API.md 变化量

| 章节 | 变化类型 | 内容 |
|------|---------|------|
| 2.5 NotebookStore | 修改 | 精简接口，标记已移除方法 |
| 4.1 notebookStore | 修改 | 精简到约 12 个方法 |
| 8 典型调用流程 | 替换 | 所有示例改为 Service Hook 调用 |
| 11 服务层 API | 新增 | FileService + CellService |
| 12 翻译服务 API | 新增 | 4 个 Provider + Factory + Hook |
| 13 背诵模式 API | 新增 | 6 个类的接口 |

**预计篇幅变化**: ~900 行 → ~2000 行（+120%）

### 5.3 文档文件清单（最终）

```
TSBook2/
├── ARCHITECTURE.md     # 约 1300 行，覆盖全局架构
├── API.md              # 约 2000 行，覆盖所有接口
├── REFACTOR_PLAN.md    # （重构完成后删除）
├── REFACTOR_PLAN_SERVICES.md  # （重构完成后删除）
└── REFACTOR_PLAN_DOCS.md      # （重构完成后删除，改动已合并）
```

---

## 6. 文档维护规则

### 6.1 文档版本标签

每个文档在文件头部添加版本注释：

```markdown
<!-- ARCHITECTURE.md v2.0 → v2.1 (添加 Service Layer, 2026-06) -->
```

### 6.2 接口变更必须更新文档

| 场景 | 更新位置 |
|------|---------|
| Service 新增方法 | API.md 对应章节 + 方法表格 |
| Service 修改签名 | API.md 类型定义 + 典型调用流程 |
| 新增模块 | ARCHITECTURE.md 架构图 + 模块详解 + API.md 新章节 |
| 删除模块 | 三篇文档对应章节标记为"已废弃"或删除 |
| Store 接口变化 | API.md 2.5 节 + ARCHITECTURE.md 3.2 节 |

### 6.3 文档审查时机

- **代码审查时**: 检查 PR 中是否包含对应文档变更
- **阶段完成时**: 验证文档与代码的接口一致性
- **发布前**: 通读文档确保无遗漏
