# TSBook2 API — 背诵/词书管理模块

词书管理模块采用服务层 + IPC 桥接模式设计，定义在 `src/recitation/`、`src/services/recitationService.ts`、`src/components/recitation/` 目录下。

---

## 14.1 数据模型

### Book

词书数据模型，定义在 `src/recitation/types.ts`。v1.4 新增 `description` 字段。

```typescript
interface Book {
  id?: number
  name: string
  path: string
  count: number
  create_time?: string | null   // ISO datetime string
  description?: string           // v1.4 新增：词书描述
}
```

### Word

单词数据模型，定义在 `src/recitation/types.ts`。

```typescript
interface Word {
  id?: number
  book_id: number
  word: string
  phonetic: string
  definition: string
  example: string
  raw_data: string
}
```

### BookWithProgress

词书及其进度汇总，定义在 `src/recitation/types.ts`。

```typescript
interface BookWithProgress {
  book: Book
  total: number
  studied: number
  review_due: number
  progress: number
}
```

### BatchOperationResult

v1.4 新增：批量操作返回结果。

```typescript
interface BatchOperationResult {
  success: number                // 成功数
  failed: number                 // 失败数
  errors?: string[]              // 错误信息列表
}
```

### TodayWordsResult

v1.4 新增 `quizResults` 字段。

```typescript
interface TodayWordsResult {
  newWords: Word[]
  reviewWords: Word[]
  testedNewWordIds: number[]
  testedReviewWordIds: number[]
  quizResults: Record<number, boolean>  // v1.4 新增
}
```

---

## 14.2 v1.4 新增 IPC 通道

在 `electron/handlers/recitationHandlers.ts` 注册的新 IPC Handlers。

| 通道 (Channel) | 参数 | 返回值 | 说明 |
|---------------|------|--------|------|
| `recitation:rename-book` | `bookId: number, newName: string` | `Promise<boolean>` | 重命名词书 |
| `recitation:export-book` | `bookId: number, exportPath: string` | `Promise<boolean>` | 导出词书为 JSON 到指定路径 |
| `recitation:export-book-to-dialog` | `bookId: number` | `Promise<string \| null>` | 弹出对话框选择导出路径并导出 |
| `recitation:batch-delete-words` | `bookId: number, wordIds: number[]` | `Promise<{success: number, failed: number, errors?: string[]}>` | 批量删除单词 |

---

## 14.3 Preload 桥接扩展

在 `electron/preload.ts` 的 `recitationAPI` 对象中新增以下方法：

```typescript
interface RecitationAPI {
  // ... 已有方法

  // === v1.4 新增 ===
  renameBook(bookId: number, newName: string): Promise<boolean>
  exportBook(bookId: number, exportPath: string): Promise<boolean>
  exportBookToDialog(bookId: number): Promise<string | null>
  batchDeleteWords(bookId: number, wordIds: number[]): Promise<{success: number, failed: number, errors?: string[]}>
}
```

---

## 14.4 RecitationService 接口更新

在 `src/services/recitationService.ts` 的 `RecitationService` 接口中新增以下方法：

```typescript
interface RecitationService {
  // ... 已有方法

  // === v1.4 新增 ===

  /** 创建空白词书（复用 addBook IPC，path 设为空字符串） */
  createBook(name: string, description?: string): Promise<Book | null>

  /** 重命名词书 */
  renameBook(bookId: number, newName: string): Promise<boolean>

  /** 导出词书为 JSON 文件（弹出保存对话框） */
  exportBook(bookId: number): Promise<boolean>

  /** 搜索词书（客户端过滤，从已加载列表中按名称模糊匹配） */
  searchBooks(keyword: string): Promise<Book[]>

  /** 批量删除单词 */
  batchDeleteWords(bookId: number, wordIds: number[]): Promise<BatchOperationResult>

  /** 从文件批量导入单词到指定词书（仅存根，待后续实现） */
  batchImportWords(bookId: number): Promise<BatchOperationResult>
}
```

**实现**: `createRecitationService()` (服务层) / `useRecitationService()` (React Hook)
**依赖**: `window.electronAPI.recitationAPI` (IPC 桥接)
**位置**: `src/services/recitationService.ts` / `src/hooks/useRecitationService.ts`

> **实现细节**: 
> - `createBook` 在服务层复用 `addBook` IPC（path=''，count=0），不涉及后端独立 IPC 通道
> - `searchBooks` 为纯客户端过滤，从 `getAllBooks()` 结果中按名称模糊匹配，不涉及独立 IPC 通道
> - `batchImportWords` 为仅存根，暂未实现

---

## 14.5 新建词书 (Create Book)

### 功能描述

用户通过 UI 创建一个空的词书，输入词书名称和可选描述，系统在数据库中创建记录后刷新词书列表。

### UI 交互

点击工具栏"新建"按钮 → 弹出 `CreateBookDialog` 模态框 → 输入名称 + 可选描述 → 确认创建 → 刷新列表并自动选中新词书。

### 组件 API

```typescript
interface CreateBookDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (book: Book) => void
}
```

### 调用流程

```
CreateBookDialog 确认
  → recitationService.createBook(name, description)
  → window.electronAPI.recitationAPI.addBook({ name, path: '', count: 0, description })
  → 后端 DAL 在 books 表插入记录
  → 返回新 Book
  → 前端刷新列表 + 选中新词书
```

### 数据流

```
BookManagerPanel
  └─ handleCreate()
      ├─ setCreateDialogOpen(true)
      └─ CreateBookDialog
          └─ onCreate(name, desc)
              ├─ recitationService.createBook(name, desc)
              │   └─ window.electronAPI.recitationAPI.addBook(...)
              └─ loadBooks() // 刷新列表
```

---

## 14.6 重命名词书 (Rename Book)

### 功能描述

用户修改已存在词书的名称，支持内联编辑或弹窗编辑两种方式。

### UI 交互

**方式一（推荐）**：双击或右键词书卡片名称 → 名称变为可编辑输入框 → Enter 确认 / Escape 取消。
**方式二**：选中词书后，工具栏出现 Rename 按钮 → 弹出重命名输入框。

### 组件 API

```typescript
// 内联编辑状态管理（在 BookCard 内部）
interface BookCardRenameState {
  editing: boolean
  value: string
}
```

### 调用流程

```
用户确认重命名
  → recitationService.renameBook(bookId, newName)
  → window.electronAPI.recitationAPI.renameBook(bookId, newName)
  → 后端 DAL 更新 books 表 name 字段
  → 返回 boolean
  → 前端刷新列表
```

### 后端实现 (electron/recitation/)

```typescript
// bookDAL.ts 新增
class BookDAL {
  rename(id: number, newName: string): boolean {
    const stmt = this.db.prepare('UPDATE books SET name = ? WHERE id = ?')
    return stmt.run(newName, id).changes > 0
  }
}
```

---

## 14.7 导出词书 (Export Book)

### 功能描述

将指定词书的所有单词导出为 JSON 文件，格式与 KyleBing 导入格式兼容，便于备份或分享。

### 导出格式

```typescript
interface ExportedBook {
  name: string
  description?: string
  export_time: string          // ISO datetime
  word_count: number
  words: Array<{
    word: string
    phonetic: string
    definition: string
    example: string
  }>
}
```

### UI 交互

选中词书 → 工具栏"导出"按钮 → 弹出系统保存对话框（默认文件名 `{词书名}.json`）→ 选择路径后保存 → 提示成功/失败。

### 调用流程

```
handleExport(bookId)
  → recitationService.exportBook(bookId)
  → window.electronAPI.recitationAPI.exportBookToDialog(bookId)
  → 主进程：弹出保存对话框 → 读取 words → 组装 JSON → 写入文件
  → 返回保存路径或 null（用户取消）
  → 前端提示导出成功
```

---

## 14.8 词书搜索 (Search Books)

### 功能描述

在词书列表上方提供搜索输入框，用户输入关键词后实时过滤词书列表。

### UI 交互

词书列表顶部添加搜索输入框 → 用户输入时实时过滤（防抖 300ms）→ 匹配字段：词书名称 → 无匹配时显示空状态提示。

### 组件状态管理

```typescript
// BookManagerPanel 内部状态
const [searchKeyword, setSearchKeyword] = useState('')
const [searchResults, setSearchResults] = useState<BookWithProgress[]>([])
```

### 数据流

```
搜索输入
  → setSearchKeyword(value)
  → 防抖 300ms
  → 客户端：books.filter(b => b.book.name.includes(keyword))
  → 设置 searchResults
  → 列表渲染 searchResults
```

> **注意**: 词书搜索为纯客户端过滤，通过 `getAllBooks()` 已加载列表进行名称模糊匹配，无需后端独立 IPC 通道。

---

## 14.9 单词批量操作 (Batch Word Operations)

### 功能描述

在 WordManagerDialog 中支持批量选择单词并进行删除操作。

### 批量删除

**UI 交互**：
- WordManagerDialog 单词列表每行左侧添加 Checkbox
- 表头添加全选/取消全选 Checkbox
- 选中至少一个单词时，工具栏出现"批量删除"按钮（红色）
- 点击后弹出确认对话框："确定删除选中的 N 个单词？"

**组件 API**：

```typescript
interface WordManagerDialogProps {
  bookId: number
  bookName: string
  onClose: () => void
  stageFilter?: StageFilter
  // v1.4 新增
  batchMode?: boolean                 // 是否启用批量模式
}

interface BatchSelectionState {
  selectedIds: Set<number>            // 选中单词 ID 集合
  selectAll: boolean                  // 是否全选
  indeterminate: boolean              // 是否半选状态
}
```

**调用流程**：

```
用户点击"批量删除"
  → 确认对话框
  → recitationService.batchDeleteWords(bookId, selectedIds)
  → window.electronAPI.recitationAPI.batchDeleteWords(bookId, wordIds)
  → 后端 DAL：DELETE FROM words WHERE id IN (?) AND book_id = ?
  → 返回 BatchOperationResult
  → 前端刷新单词列表
```

---

## 14.10 BookManagerPanel UI 结构更新

更新后的工具栏和卡片交互布局：

```
┌─────────────────────────────────────────────┐
│ [新建] [导入] [导出] [重命名] [删除] [刷新]    │ ← 工具栏
│ 搜索: [________________________]              │ ← 搜索框
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐      │
│ │ 📖 四级词汇 (双击名称可重命名)         │      │ ← BookCard
│ │ ▓▓▓▓▓▓▓▓▓░░░░░░░ 45%               │      │    (内联重命名)
│ │ 已学 150/300  待复习 23              │      │
│ │ [查看单词]                           │      │
│ └─────────────────────────────────────┘      │
│ ┌─────────────────────────────────────┐      │
│ │ 📖 考研词汇                          │      │
│ │ ▓▓▓▓▓▓░░░░░░░░ 30%                 │      │
│ │ 已学 90/300  待复习 12              │      │
│ │ [查看单词]                           │      │
│ └─────────────────────────────────────┘      │
├─────────────────────────────────────────────┤
│ 共 2 本词书                                   │
└─────────────────────────────────────────────┘
```
