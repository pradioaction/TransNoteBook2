# TSBook2 背诵模式数据层文档

> 本文档描述 TSBook2 背诵模式（Recitation Mode）数据层的架构、文件结构、接口和用法。
> 适用于后续 UI 层开发和其他模块对接。

---

## 一、架构概览

背诵模式数据层采用 **Electron 主进程 + IPC + 渲染进程服务** 的三层架构：

```
┌─────────────────────────────────────────────────────────────────┐
│                   渲染进程 (Renderer)                            │
│                                                                 │
│  React 组件                                                      │
│      │                                                          │
│      ▼                                                          │
│  useRecitationService() Hook                                    │
│      │                                                          │
│      ▼                                                          │
│  createRecitationService() 工厂                                  │
│      │                                                          │
│      ▼                                                          │
│  window.electronAPI.recitationAPI (preload 桥接)                  │
│      │                                                          │
│      └──────────── IPC invoke ────────────────┐                 │
└────────────────────────────────────────────────┼─────────────────┘
                                                 │
┌────────────────────────────────────────────────┼─────────────────┐
│                   主进程 (Main Process)         │                 │
│                                                 ▼                 │
│  ipcMain.handle('recitation:*')                                  │
│      │                                                          │
│      ├── BookService      (词书管理业务逻辑)                      │
│      │   └── ConfigProvider (依赖注入 → studywordmode.json)       │
│      ├── StudyService     (学习记录 + 艾宾浩斯算法)               │
│      │   └── ConfigProvider (依赖注入 → studywordmode.json)       │
│      │                                                          │
│      ▼                                                          │
│  RecitationDAL (组合层)                                          │
│      ├── BookDAL          (词书表 CRUD)                          │
│      ├── WordDAL          (单词表 CRUD + 查询)                    │
│      ├── UserStudyDAL     (学习记录表 CRUD)                      │
│      └── StatDAL          (统计查询)                              │
│          │                                                      │
│          ▼                                                      │
│  DatabaseManager (better-sqlite3)                                │
│      └── words.db  (SQLite 数据库)                                │
└─────────────────────────────────────────────────────────────────┘
```

### 设计原则

- **数据层在主进程**：所有数据库操作（`better-sqlite3`）运行在 Electron 主进程，渲染进程不直接访问文件系统或数据库
- **IPC 桥接**：渲染进程通过 `preload.ts` 暴露的类型安全桥接调用主进程方法
- **接口与 Python 版本一致**：所有 DAL 和 Service 的方法签名、行为逻辑完全对标原始 Python `src/recitation/` 模块
- **工作区隔离**：不同工作区使用独立的 `.TransRead/words.db` 数据库文件

---

## 二、文件结构

```
tsbook2/
├── electron/
│   ├── main.ts                          # IPC 处理器注册 + 服务生命周期管理
│   ├── preload.ts                       # recitationAPI 上下文桥接
│   ├── workspace/                       # 工作区通用能力
│   │   └── configProvider.ts            # ConfigProvider 接口 + FileBasedConfig 实现
│   └── recitation/
│       ├── database.ts                  # PathManager + DatabaseManager
│       ├── bookDAL.ts                   # 词书数据访问层
│       ├── wordDAL.ts                   # 单词数据访问层
│       ├── userStudyDAL.ts             # 学习记录数据访问层
│       ├── statDAL.ts                   # 统计数据访问层
│       ├── recitationDAL.ts            # DAL 组合层
│       ├── ebbinghaus.ts               # 艾宾浩斯遗忘曲线算法
│       ├── bookImporter.ts             # KyleBing 格式词书导入器
│       ├── studyService.ts             # 学习服务（核心业务逻辑）
│       └── bookService.ts              # 词书管理服务
│
├── src/
│   ├── recitation/
│   │   ├── types.ts                    # 数据模型类型定义（共享）
│   │   └── index.ts                    # 统一导出
│   ├── services/
│   │   ├── types.ts                    # RecitationService 接口
│   │   ├── recitationService.ts        # IPC 调用封装工厂
│   │   └── index.ts                    # 统一导出
│   └── hooks/
│       └── useRecitationService.ts     # React Hook
```

---

## 三、数据模型

### 数据库表结构 (words.db)

#### book 表 — 词书

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 词书 ID |
| `name` | TEXT NOT NULL | 词书名 |
| `path` | TEXT NOT NULL | 词书文件路径 |
| `count` | INTEGER DEFAULT 0 | 单词总数 |
| `create_time` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### word 表 — 单词

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 单词 ID |
| `book_id` | INTEGER FK → book.id | 所属词书 |
| `word` | TEXT NOT NULL | 英文单词 |
| `phonetic` | TEXT DEFAULT '' | 音标 |
| `definition` | TEXT DEFAULT '' | 中文释义 |
| `example` | TEXT DEFAULT '' | 例句 |
| `raw_data` | TEXT DEFAULT '' | 原始 JSON 数据 |

外键：`book_id → book(id) ON DELETE CASCADE`

#### user_study 表 — 学习记录

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 记录 ID |
| `book_id` | INTEGER FK → book.id | 词书 ID |
| `word_id` | INTEGER FK → word.id | 单词 ID |
| `stage` | INTEGER DEFAULT 0 | 艾宾浩斯阶段 (0-8) |
| `weight` | REAL DEFAULT 0.0 | 复习权重 |
| `last_review` | TIMESTAMP | 上次复习时间 |
| `next_review` | TIMESTAMP | 下次复习时间 |

外键：`book_id → book(id), word_id → word(id) ON DELETE CASCADE`

索引：`word.book_id`, `user_study.book_id`, `user_study.word_id`, `user_study.next_review`

### TypeScript 类型 (src/recitation/types.ts)

```typescript
interface Book {
  id?: number
  name: string
  path: string
  count: number
  create_time?: string | null
}

interface Word {
  id?: number
  book_id: number
  word: string
  phonetic: string
  definition: string
  example: string
  raw_data: string
}

interface UserStudy {
  id?: number
  book_id: number
  word_id: number
  stage: number
  weight: number
  last_review: string | null
  next_review: string | null
}
```

---

## 四、IPC 通道清单

所有通道以 `recitation:` 为前缀，通过 `window.electronAPI.recitationAPI` 调用。

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `recitation:init` | `workspacePath: string` | `boolean` | 初始化工作区数据库 |
| `recitation:add-book` | `book: Book` | `Book \| null` | 添加词书 |
| `recitation:get-book-by-id` | `bookId: number` | `Book \| null` | 查询单个词书 |
| `recitation:get-all-books` | — | `Book[]` | 获取所有词书 |
| `recitation:delete-book` | `bookId: number` | `boolean` | 删除词书 |
| `recitation:get-book-progress` | `bookId: number` | `BookProgress` | 获取词书进度 |
| `recitation:get-all-books-with-progress` | — | `BookWithProgress[]` | 获取所有词书及进度 |
| `recitation:import-book-from-file` | `filePath: string` | `Book \| null` | 从 JSON 文件导入词书 |
| `recitation:get-words-by-book` | `bookId: number` | `Word[]` | 获取词书所有单词 |
| `recitation:get-unstudied-words` | `bookId, limit?` | `Word[]` | 获取未学单词 |
| `recitation:get-words-for-review` | `bookId, limit?` | `Word[]` | 获取待复习单词 |
| `recitation:search-words` | `searchText, bookId?` | `Word[]` | 搜索单词 |
| `recitation:start-study-word` | `bookId, wordId` | `UserStudy \| null` | 开始学习单词 |
| `recitation:review-word` | `bookId, wordId, isCorrect` | `UserStudy \| null` | 复习单词 |
| `recitation:get-config` | — | `Record<string, unknown>` | 获取完整配置 |
| `recitation:set-config` | `key, value` | `boolean` | 设置配置项 |
| `recitation:get-today-words` | `bookId, forceRefresh?` | `TodayWordsResult` | 获取今日单词 |
| `recitation:refresh-today-words` | `bookId` | `TodayWordsResult` | 强制刷新今日单词 |

---

## 五、服务层接口 (RecitationService)

### 接口定义

```typescript
interface RecitationService {
  init(workspacePath: string): Promise<boolean>
  getBooks(): Promise<Book[]>
  getBookById(bookId: number): Promise<Book | null>
  importBook(filePath: string): Promise<Book | null>
  deleteBook(bookId: number): Promise<boolean>
  getBookProgress(bookId: number): Promise<BookProgress>
  getAllBooksWithProgress(): Promise<BookWithProgress[]>
  getWordsByBook(bookId: number): Promise<Word[]>
  getUnstudiedWords(bookId: number, limit?: number): Promise<Word[]>
  getWordsForReview(bookId: number, limit?: number): Promise<Word[]>
  searchWords(searchText: string, bookId?: number): Promise<Word[]>
  startStudyWord(bookId: number, wordId: number): Promise<UserStudy | null>
  reviewWord(bookId: number, wordId: number, isCorrect: boolean): Promise<UserStudy | null>
  getConfig(): Promise<Record<string, unknown>>
  setConfig(key: string, value: unknown): Promise<boolean>
  getTodayWords(bookId: number, forceRefresh?: boolean): Promise<TodayWordsResult>
  refreshTodayWords(bookId: number): Promise<TodayWordsResult>
}
```

### React Hook 使用方式

```typescript
import { useRecitationService } from '@/hooks/useRecitationService'

function MyComponent() {
  const recitationService = useRecitationService()

  useEffect(() => {
    // 1. 初始化
    await recitationService.init('/path/to/workspace')

    // 2. 导入词书
    const book = await recitationService.importBook('/path/to/book.json')

    // 3. 获取今日单词
    const { newWords, reviewWords } = await recitationService.getTodayWords(book.id)

    // 4. 开始学习
    await recitationService.startStudyWord(book.id, newWords[0].id)

    // 5. 复习
    await recitationService.reviewWord(book.id, newWords[0].id, true)
  }, [])
}
```

---

## 六、核心业务逻辑

### 6.1 艾宾浩斯遗忘曲线 (EbbinghausAlgorithm)

位于 `electron/recitation/ebbinghaus.ts`。

**9 个复习阶段的时间间隔：**

| 阶段 | 间隔 | 说明 |
|------|------|------|
| 0 | 5 分钟 | 首次学习 |
| 1 | 30 分钟 | 第一次复习 |
| 2 | 12 小时 | 第二次复习 |
| 3 | 1 天 | 第三次复习 |
| 4 | 2 天 | 第四次复习 |
| 5 | 4 天 | 第五次复习 |
| 6 | 7 天 | 第六次复习 |
| 7 | 15 天 | 第七次复习 |
| 8 | 30 天 | 第八次复习 |

**阶段更新规则：**
- 答对：`stage = min(stage + 1, 8)`，使用新阶段的间隔
- 答错：`stage = max(stage - 1, 0)`，退回前一阶段

**权重计算公式：**

```
weight = 1.0 + (1.0 - stage / 9) * exp(progress * 3)
```

其中 `progress = 1.0 - timeUntilReview / totalInterval`，范围 [0, 1]。

### 6.2 今日单词缓存逻辑

位于 `electron/recitation/studyService.ts` 的 `getTodayWords()` 方法。

- **同一天内不自动刷新**：首次调用时从数据库抽取单词，将单词 ID 列表缓存到 `studywordmode.json`
- **force_refresh=True** 强制重新抽取
- **跨天自动清理**：日期变更时自动删除前一天的今日单词缓存
- **缓存内容**：`today_words_{bookId}` 键下存储 `{ new_words: number[], review_words: number[] }`

### 6.3 取词逻辑

**新学单词** (`getUnstudiedWords`)：
1. 查询 `word` 表 LEFT JOIN `user_study` 表，筛选 `user_study.id IS NULL` 的单词
2. 如果数量超过 limit，取前 limit 个后随机打乱

**复习单词** (`getWordsForReview`)：
1. JOIN `word` 和 `user_study` 表，筛选 `next_review <= now` 的单词
2. 按 `weight DESC` 排序（权重越高越优先复习）
3. 如果数量超过 limit，取前 limit 个后随机打乱

### 6.4 配置持久化

配置文件：`{workspace}/.TransRead/studywordmode.json`

由 `FileBasedConfig` 类（`electron/workspace/configProvider.ts`）统一管理文件 I/O，`StudyService` 和 `BookService` 通过依赖注入共享同一个 `ConfigProvider` 实例存取配置，消除重复的文件读写代码。

```typescript
// main.ts 中创建共享实例
const configProvider = new FileBasedConfig(path.join(workspacePath, '.TransRead', 'studywordmode.json'))
_studyService = new StudyService(dal, configProvider)
_bookService = new BookService(dal, configProvider)
```

```json
{
  "daily_new_words": 20,
  "daily_review_words": 50,
  "current_book_id": 1,
  "today_date": "2026-06-13",
  "today_words_1": {
    "new_words": [101, 102, 103],
    "review_words": [201, 202]
  }
}
```

---

## 七、如何对接 UI 层

### 侧边栏添加背诵模式 Tab

参考现有 `ActivityBar` + `Sidebar` 模式：

1. 在 `workspaceStore` 中添加新的 `sidebarActiveTab` 值（如 `'recitation'`）
2. 在 `ActivityBar.tsx` 中添加背诵模式图标按钮
3. 在 `Sidebar.tsx` 中添加条件渲染分支，加载背诵模式组件
4. 首次进入时调用 `recitationService.init(workspacePath)` 初始化数据库

### 核心流程

```
选择词书 → 获取今日单词 → 学习模式选择 → 检测/文章生成
    ↓            ↓              ↓               ↓
 BookService  StudyService   UI 路由      TranslationService
                                        .generateSceneText()
```

### 检测功能的数据流

1. `recitationService.getTodayWords(bookId)` → 获取今日新学 + 复习单词
2. UI 展示选择题（单词→释义 / 释义→单词）
3. 交卷后调用 `recitationService.reviewWord(bookId, wordId, isCorrect)`
4. 调用 `recitationService.processQuizResults(...)` 完成完整流程（需要在主进程暴露此 IPC 或在组件中组合调用）

---

## 八、与原始 Python 项目的兼容性

| 项目 | Python 文件 | TypeScript 文件 | 状态 |
|------|------------|----------------|------|
| 数据模型 | `models.py` | `src/recitation/types.ts` | 完全对应 |
| 路径管理 | `path_manager.py` | `electron/recitation/database.ts` (PathManager) | 完全一致 |
| 数据库管理 | `database.py` | `electron/recitation/database.ts` (DatabaseManager) | 完全一致 |
| 词书 DAL | `dal/book_dal.py` | `electron/recitation/bookDAL.ts` | 完全一致 |
| 单词 DAL | `dal/word_dal.py` | `electron/recitation/wordDAL.ts` | 完全一致 |
| 学习记录 DAL | `dal/user_study_dal.py` | `electron/recitation/userStudyDAL.ts` | 完全一致 |
| 统计 DAL | `dal/stat_dal.py` | `electron/recitation/statDAL.ts` | 完全一致 |
| 组合 DAL | `recitation_dal.py` | `electron/recitation/recitationDAL.ts` | 完全一致 |
| 艾宾浩斯算法 | `ebbinghaus.py` | `electron/recitation/ebbinghaus.ts` | 完全一致 |
| 词书导入 | `book_importer.py` | `electron/recitation/bookImporter.ts` | 完全一致 |
| 学习服务 | `study_service.py` | `electron/recitation/studyService.ts` | 注入 ConfigProvider |
| 词书服务 | `book_service.py` | `electron/recitation/bookService.ts` | 注入 ConfigProvider |
| 工具函数 | `utils.py` | (渲染端可参考 `formatPhonetic` 逻辑) | 待移植 |

**数据库兼容性**：TSBook2 生成的 `words.db` 可直接被原始 Python 项目读取，反之亦然。
**配置兼容性**：`studywordmode.json` 格式完全一致。

---

## 九、注意事项

1. **初始化时机**：必须在设置工作区路径后调用 `recitation:init` 才能使用其他功能
2. **工作区切换**：切换工作区时需要重新初始化数据库（调用 `recitation:init`）
3. **今日单词缓存**：同一本书同一天内 `getTodayWords` 返回相同数据，如需重新抽取需设置 `forceRefresh: true`
4. **批处理性能**：批量导入词书时使用事务（`db.transaction()`）+ 分组更新数量
5. **外键约束**：数据库启用了 `foreign_keys = ON`，删除词书会自动级联删除相关单词和学习记录
6. **隐藏目录**：`.TransRead` 目录在 Windows 上通过 `attrib +h` 设置为隐藏目录
