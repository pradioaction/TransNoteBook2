# TSBook2 v1.2 重构方案

> 本文档基于 v1.1 服务层提取完成后遗留的质量问题，聚焦于**清理死代码、消除类型重复、统一架构模式**。
> 前置文档：[v1.1 重构方案](../v1.1/REFACTOR_PLAN.md)、[v1.1 服务层设计](../v1.1/REFACTOR_PLAN_SERVICES.md)

---

## 1. 现状回顾

v1.1 重构已完成了以下工作：

- ✅ 从 `notebookStore` 提取业务逻辑到独立的 Service Hooks
- ✅ 创建 `useFileService` / `useCellService` / `useTranslationService` / `useRecitationService`
- ✅ 翻译模块策略模式（Ollama / OpenAI / Ark Provider）
- ✅ 背诵模式完整模块（Electron 主进程 DAL + 渲染进程 Service）
- ✅ 设置持久化防抖

但经代码审查发现，上述实现存在以下质量问题：

| # | 问题 | 严重程度 | 影响范围 |
|---|------|---------|---------|
| 1 | `services/` 中存在未使用的死代码 | **高** | 2 个文件 |
| 2 | 类型定义在多处重复声明 | **高** | 5+ 组类型 |
| 3 | Store 之间互相 import，存在循环依赖隐患 | **中** | settingStore → themeStore |
| 4 | IPC 边界类型不安全，大量 `as unknown` 断言 | **中** | recitationService + types/notebook.ts |
| 5 | 服务创建模式不统一（3 种模式并存） | **中** | 所有 Service |
| 6 | 背诵模块 IPC 返回字段命名不一致（camelCase vs snake_case） | **低** | recitationService |
| 7 | 两个 Store 同时维护 `recentFiles`，职责冗余 | **低** | workspaceStore + settingStore |
| 8 | `useFileService` 中直接调用 `settingStore.setLastOpenFilePath`，违反分层 | **低** | hooks/useFileService.ts |

---

## 2. 目标架构

### 2.1 核心原则

1. **无死代码** — 一个功能只有一份实现
2. **单一类型定义源** — 每种类型只在唯一位置定义
3. **单向依赖** — Service → Store → IPC，禁止 Store 之间互相 import
4. **类型安全边界** — IPC 通信两端共享类型，消除 `as unknown`
5. **统一创建模式** — 全部采用 **Hook 包装单例** 模式

### 2.2 分层依赖规则

```
┌───────────────────────────────────────┐
│          Component Layer               │  → 只引用 hooks/ 和 store/
│  (只关心 UI 渲染)                      │
├───────────────────────────────────────┤
│          Hooks Layer                   │  → 引用 services/ (单例) + store/
│  (React 绑定层，管理生命周期)           │     不允许直接引用 electronAPI
├───────────────────────────────────────┤
│          Services Layer                │  → 引用 store/ + translation/ + electronAPI
│  (纯业务逻辑，无 React 依赖)           │     纯函数 / 模块级单例
├───────────────────────────────────────┤
│          Store Layer                   │  → 只引用 types/
│  (纯状态容器，无业务逻辑)               │     禁止引用其他 Store
├───────────────────────────────────────┤
│          IPC / Types                   │  → 共享类型定义
│  (进程边界，contextBridge)             │
└───────────────────────────────────────┘
```

---

## 3. 详细改造方案

### 3.1 清理死代码

**目标**：删除无人引用的 `services/fileService.ts` 和 `services/cellService.ts`

**现状**：
- [src/services/fileService.ts](../../src/services/fileService.ts) — 定义 `createFileService()`，**零引用**
- [src/services/cellService.ts](../../src/services/cellService.ts) — 定义 `createCellService()`，**零引用**
- 实际使用中的实现在 [src/hooks/useFileService.ts](../../src/hooks/useFileService.ts) 和 [src/hooks/useCellService.ts](../../src/hooks/useCellService.ts)

**操作**：

| 操作 | 文件 |
|------|------|
| **删除** | `src/services/fileService.ts` |
| **删除** | `src/services/cellService.ts` |
| **修改** | `src/services/index.ts` — 移除已删除文件的导出，明确只导出类型 |

**注意**：如果未来有非 React 环境（如 Web Worker）需要调用这些服务，应将 hooks 中的实现抽取到 `services/`，让 hooks 变成薄包装层。但目前无此需求，故直接删除。

---

### 3.2 统一类型定义

**目标**：每种类型只在唯一位置定义，消除重复声明。

#### 3.2.1 Store 类型归并

| 重复定义的类型 | 保留的位置 | 删除的位置 |
|--------------|-----------|-----------|
| `TranslationSettings` | `src/types/notebook.ts` | `src/store/settingStore.ts` |
| `CustomModel` | `src/types/notebook.ts` | `src/store/settingStore.ts` |
| `PromptTemplates` | `src/types/notebook.ts` | `src/store/settingStore.ts` |
| `EnvVar` | `src/types/notebook.ts` | `src/store/settingStore.ts` |
| `WorkspaceStore` | `src/store/workspaceStore.ts` | `src/types/notebook.ts` |
| `TranslationProvider` → `ProviderInfo` | `src/translation/types.ts` | `src/services/types.ts` 中的 `ProviderInfo` |

**具体操作**：

1. **settingStore.ts**：删除文件中定义的 `TranslationSettings`、`CustomModel`、`PromptTemplates`、`EnvVar` 接口，改为从 `@/types/notebook` import
2. **types/notebook.ts**：删除 `WorkspaceStore` 接口（应归 store 所有），删除 `RecitationAPI` 接口（应归 electron/ 所有）
3. **services/types.ts**：删除 `ProviderInfo`，改为从 `@/translation/types` 重新导出

#### 3.2.2 IPC 边界类型

**目标**：主进程和渲染进程共享 IPC 通信的类型定义。

**现状**：
- `electron/preload.ts` 定义了 `FileEntry`、`DirEntry`、`ImportResult`
- `src/types/notebook.ts` 定义了完全相同的 `FileEntry`、`DirEntry`、`ImportResult`
- `src/types/notebook.ts` 定义了 `Window.electronAPI` 全局类型，但 recitation API 返回值全为 `unknown`

**解决方案**：

创建 `src/types/electron.ts`，作为 IPC 通信的共享类型定义源：

```typescript
// src/types/electron.ts
// 注意：此文件供 electron/ 和 src/ 共同引用

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface DirEntry {
  name: string
  path: string
}

export interface ImportResult {
  filePath: string
  content: string
}

export interface RecitationWordInput {
  word: string
  phonetic: string
  definition: string
  example: string
}
```

然后在以下位置引用：
- `electron/preload.ts` → import `FileEntry`、`DirEntry`、`ImportResult`（或删除内联定义）
- `src/types/notebook.ts` → import 以上类型，删除本地重复定义
- `src/services/recitationService.ts` → 用具体类型替代 `as unknown` 断言

**`Window.electronAPI` 类型改进**：

将 `recitationAPI` 的返回值从 `unknown` 改为具体类型：

```typescript
// 当前: src/types/notebook.ts
recitationAPI?: {
  getWordsByBook(bookId: number): Promise<unknown[]>
  // ...
}

// 改进后: 使用具体类型
import type { Word, Book, UserStudy, BookProgress, BookWithProgress, TodayWordsResult } from '@/recitation/types'

recitationAPI?: {
  getWordsByBook(bookId: number): Promise<Word[]>
  getBookById(bookId: number): Promise<Book | null>
  getAllBooks(): Promise<Book[]>
  getBookProgress(bookId: number): Promise<BookProgress>
  getAllBooksWithProgress(): Promise<BookWithProgress[]>
  getTodayWords(bookId: number, forceRefresh?: boolean): Promise<TodayWordsResult>
  // ... 其余方法类似
}
```

---

### 3.3 解耦 Store 交叉引用

**目标**：消除 Store 之间的直接 import。

**现状**：`src/store/settingStore.ts` 第 2 行和第 158 行直接引用了 `themeStore`：

```typescript
import { useThemeStore } from '@/store/themeStore'

// 在 loadFromDisk 中:
if (raw.theme) {
  useThemeStore.getState().setTheme(raw.theme as 'light' | 'dark')
}
```

**改造方案**：

采用 **回调/事件** 方式解耦：

```typescript
// settingStore.ts — 不再 import themeStore

// 改用可配置的 onThemeChange 回调
type OnThemeChange = (theme: 'light' | 'dark') => void

// 在 store 中保存回调
interface SettingStore {
  // ... 现有字段
  _onThemeChange: OnThemeChange | null
  setOnThemeChange: (cb: OnThemeChange | null) => void
}

// 在 loadFromDisk 中:
if (raw.theme && get()._onThemeChange) {
  get()._onThemeChange(raw.theme as 'light' | 'dark')
}
```

在 App.tsx（或 AppShell.tsx）中注册回调：

```typescript
// App.tsx 或 AppShell.tsx
import { useSettingStore } from '@/store/settingStore'
import { useThemeStore } from '@/store/themeStore'

// 组件初始化时
useEffect(() => {
  const settingStore = useSettingStore.getState()
  settingStore.setOnThemeChange((theme) => {
    useThemeStore.getState().setTheme(theme)
  })
}, [])
```

---

### 3.4 消除 Store 职责冗余

**问题**：`workspaceStore` 和 `settingStore` 都维护了 `recentFiles`。

**现状**：
- [workspaceStore.ts](../../src/store/workspaceStore.ts) — `recentFiles` + `addRecentFile`
- [settingStore.ts](../../src/store/settingStore.ts) — `recentFiles` + `addRecentFile`
- [useFileService.ts](../../src/hooks/useFileService.ts) 同时调用了两个 Store 的 `addRecentFile`

**改造方案**：

- 保留 `settingStore` 的 `recentFiles`（需要持久化）
- 从 `workspaceStore` 中移除 `recentFiles` 和 `addRecentFile`
- 所有需要 `addRecentFile` 的地方只调用 `settingStore`
- `useFileService` 中移除对 `workspaceStore.addRecentFile` 的重复调用

---

### 3.5 统一服务创建模式

**目标**：将现有的 3 种模式统一为 1 种。

**现状**：

| 服务 | 当前模式 | 问题 |
|------|---------|------|
| FileService | Hook 函数直接创建闭包（每次渲染新对象） | 不符合 React 习惯，无法 memo |
| CellService | Hook 函数直接创建闭包（每次渲染新对象） | 同上 |
| TranslationService | 模块级单例 + Hook 轮询 | 模式不同 |
| RecitationService | 模块级单例 + Hook 包装 | 与上面不统一 |

**统一模式**：**模块级单例（仅在 Services 层） + Hook 包装**

服务层保留模块级单例（如 `translationService` 和 `recitationService` 的做法），`hooks/` 中的文件仅做薄代理：

```typescript
// hooks/useFileService.ts — 改造后
import { useNotebookStore } from '@/store/notebookStore'
import { useSettingStore } from '@/store/settingStore'
import { useCallback } from 'react'

// 模块级单例
let _fileService: FileServiceImpl | null = null

function getService() {
  if (!_fileService) {
    _fileService = new FileServiceImpl(useNotebookStore, useSettingStore)
  }
  return _fileService
}

export function useFileService(): FileService {
  const service = useMemo(() => getService(), [])
  // 或直接放在 hooks 层做状态绑定
  return service
}
```

**备选方案**：全部采用 hooks 中的闭包模式（不做单例），保持简单。

**推荐采用备选方案**，因为 FileService 和 CellService 的方法每次调用都会读取最新 Store 状态，不需要单例。TranslationService 需要单例是因为它持有内部状态（进度/中断），而 RecitationService 不需要单例（它只是 IPC 代理，无内部状态）。

最终统一规则：

| 场景 | 模式 |
|------|------|
| 无内部状态，纯代理操作 | 普通 Hook 函数（useCellService / useFileService 保持现状） |
| 有内部状态需要共享 | Hook 包装模块级单例（useTranslationService 保持现状） |
| 无状态但 future-proof | 同上，统一用模块级单例模式 |

---

### 3.6 修复 IPC 字段命名不一致

**问题**：`recitationService.ts` 中 `getTodayWords` 和 `refreshTodayWords` 需要同时兼容 `newWords`（camelCase）和 `new_words`（snake_case）。

**根因**：Electron 主进程返回的字段名是 `newWords` / `reviewWords`（见 [main.ts](../../electron/main.ts) 第 364 行），但 `RecitationAPI` 接口定义为 `newWords` / `reviewWords`，渲染进程却用了 fallback 逻辑兼容两种命名。

**改造**：
1. 确认主进程 [main.ts](file:///g:/program/TSBook2/electron/main.ts#L364) 返回的就是 `newWords` / `reviewWords`
2. 删除 [recitationService.ts](../../src/services/recitationService.ts) 中的 snake_case fallback 兼容代码
3. 删除 `TodayWordsResult` 类型中的 `new_words` / `review_words` 别名（如果存在的话）

---

### 3.7 移动 settingStore 调用到 Store 层

**问题**：`useFileService` 中直接调用了 `settingStore.setLastOpenFilePath`，违反了分层原则。

**改造**：将 `settingStore` 的调用逻辑下沉到 `notebookStore` 中，通过 Zustand 的 `subscribe` 机制监听文件切换事件。

```typescript
// notebookStore.ts — 在 openFile / setFilePath 中触发回调
interface NotebookStore {
  // 新增回调注册
  onFileOpened: ((path: string) => void) | null
  setOnFileOpened: (cb: ((path: string) => void) | null) => void
  // ...
}

// 在 App.tsx 中注册:
notebookStore.setOnFileOpened((path) => {
  settingStore.setLastOpenFilePath(path)
  settingStore.addRecentFile(path)
})
```

这样 `useFileService` 就不再需要 import `settingStore`，职责更纯粹。

---

## 4. 文件变更清单

### 4.1 删除的文件

| 文件 | 原因 |
|------|------|
| `src/services/fileService.ts` | 死代码，无人引用 |
| `src/services/cellService.ts` | 死代码，无人引用 |

### 4.2 修改的文件

| 文件 | 变更内容 |
|------|---------|
| `src/services/index.ts` | 移除已删文件的导出 |
| `src/services/recitationService.ts` | 移除 snake_case fallback；替换 `as unknown` 为具体类型 |
| `src/services/types.ts` | 移除 `ProviderInfo`（改为从 translation/types 导出） |
| `src/services/translationService.ts` | 改为从 `@/translation/types` 导入 `ProviderInfo` |
| `src/store/settingStore.ts` | 删除内联类型定义（改为 import）；移除 `themeStore` 引用 |
| `src/store/workspaceStore.ts` | 移除 `recentFiles` / `addRecentFile` |
| `src/store/notebookStore.ts` | 新增 `onFileOpened` 回调机制 |
| `src/types/notebook.ts` | 删除 `WorkspaceStore`、`FileEntry`、`DirEntry`、`ImportResult`；抽离 IPC 类型；改进 `Window.electronAPI` 类型安全 |
| `src/hooks/useFileService.ts` | 移除对 `settingStore` 的 import 和调用 |
| `electron/preload.ts` | 删除内联的 `FileEntry` / `DirEntry` / `ImportResult`（从共享类型 import） |
| `electron/main.ts` | 无需修改（但需要配合类型变更确认无编译错误） |
| `src/recitation/types.ts` | 确认 `TodayWordsResult` 字段名为 `newWords` / `reviewWords`（如有别名则清理） |

### 4.3 新增的文件

| 文件 | 用途 |
|------|------|
| `src/types/electron.ts` | IPC 共享类型（`FileEntry`、`DirEntry`、`ImportResult`、`RecitationWordInput`） |

---

## 5. 实施步骤与风险

### 5.1 实施顺序

| 步骤 | 内容 | 预计耗时 | 风险等级 |
|------|------|---------|---------|
| 1 | 创建 `src/types/electron.ts`，迁移 IPC 共享类型 | 0.5h | 低 |
| 2 | 清理死代码（删除 2 个 service 文件） | 0.5h | 低 |
| 3 | 统一类型定义（settingStore / types/notebook） | 1h | 中（需确认所有 import 路径） |
| 4 | 解耦 settingStore → themeStore 的引用 | 1h | 中（修改初始化流程） |
| 5 | 消除 workspaceStore 的 recentFiles 冗余 | 0.5h | 低 |
| 6 | 改进 `Window.electronAPI` 类型安全 | 1h | 高（涉及主进程与渲染进程类型联动） |
| 7 | 移动 settingStore 调用逻辑到 Store 层 | 1h | 中 |
| 8 | 修复 IPC 字段命名不一致 | 0.5h | 低 |
| 9 | 运行类型检查 + 测试，修复编译错误 | 1h | 高 |

**预计总工作量**：3-4 小时（按顺序执行，每步结束后验证编译通过）

### 5.2 风险与注意事项

| 风险 | 缓解措施 |
|------|---------|
| 类型变更导致 electron 主进程无法编译 | 修改后运行 `npm run electron:compile` 验证 |
| `RecitationAPI` 类型变更导致的运行时错误 | 确保 `electron/preload.ts` 和 `electron/main.ts` 的返回值与类型一致 |
| settingStore 回调机制导致 theme 初始化顺序问题 | 在 `App.tsx` 的 `loadFromDisk` 前注册回调 |
| 第三方使用者（如有）依赖已删除的类型 | 在删除前使用 grep 确认零外部引用 |

### 5.3 验证方式

每步完成后运行以下命令确认无回归：

```bash
npm run typecheck    # TypeScript 类型检查
npm run test         # 单元测试
npm run electron:compile  # 主进程编译
npm run dev          # 开发服务器启动，人工确认功能正常
```

---

## 6. 改造前后对比

### 文件数量变化

| 指标 | 改造前 | 改造后 | 变化 |
|------|--------|--------|------|
| `src/services/` 文件数 | 6 | 4 | -2 |
| `src/types/` 文件数 | 1 | 2 | +1 |
| 类型重复组数 | 5+ | 0 | -5+ |
| `as unknown` 断言数 | ~20 | 0 | ~20 |
| Store 间 import 数 | 1 | 0 | -1 |
| 服务创建模式数 | 3 | 2 | -1 |

### 架构指标改进

| 指标 | 改造前 | 改造后 |
|------|--------|--------|
| 循环依赖 | 存在（settingStore → themeStore） | 消除 |
| 死代码 | 2 个完整文件 | 0 |
| IPC 类型安全 | unknown 泛滥 | 具体类型 |
| 职责重复 | 2 处（recentFiles） | 0 处 |
| 分层违规 | useFileService 直接操作 settingStore | 通过回调解耦 |
