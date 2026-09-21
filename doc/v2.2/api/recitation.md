# TSBook2 API — 检测（测验）模块 (v2.2)

> v2.2 变更：新增 **完形填空题型**（`cloze`）与 **「不认识」作答标记**（`DONT_KNOW_ANSWER`）；**检测进度由单快照改为多槽位暂存**。
> 词书管理/数据库相关接口与 v2.1 一致，参见 [v2.1 recitation.md](../v2.1/api/recitation.md) 与 [v2.0 recitation.md](../v2.0/api/recitation.md)。

## 14.1 题型定义 — [quizTypes.ts](../../../src/recitation/quizTypes.ts)

```typescript
// v2.2：新增 'cloze'
export type QuizQuestionType = 'word-to-meaning' | 'meaning-to-word' | 'cloze'

/**
 * 「不认识」专用作答标记：不指向任何选项（A-D），
 * 用于记录记忆失败，界面不会高亮任何错误选项。
 */
export const DONT_KNOW_ANSWER = 'N'

export interface QuizQuestion {
  id: number
  type: QuizQuestionType
  wordId: number
  word: string
  correctAnswer: string
  options: QuizOption[]
  answered?: string          // 用户选择的选项 ID 'A'|'B'|'C'|'D'；「不认识」为 'N'
  clozeSentence?: string     // v2.2 新增：完形填空句子（含 ____ 占位符）
  phonetic?: string
  definition?: string
  example?: string
  stage?: number
}
```

### 判定语义

| 作答值 | 判定 | 界面表现 |
|---|---|---|
| `'A' \| 'B' \| 'C' \| 'D'` | 与 `correctAnswer` 比较 | 正确/错误选项分别高亮 |
| `DONT_KNOW_ANSWER`（`'N'`） | 恒为错误（`correctAnswer !== 'N'`） | 不高亮任何错误选项，直接翻卡展示词义 |

> `DONT_KNOW_ANSWER` 复用了现有判定链路：`computeAnswerResult()` 无需为它增加分支。

---

## 14.2 测验引擎 — [quizEngine.ts](../../../src/recitation/quizEngine.ts)

v2.2 **无签名变更**，仍为三个纯函数：

```typescript
export function createQuizState(questions: QuizQuestion[]): QuizState

export function computeAnswerResult(
  quizState: QuizState,
  sidebarData: WordSidebarData | null,
  pendingSyncResults: Record<number, boolean>,
  questionIndex: number,
  selectedOptionId: string
): { quizState: QuizState; sidebarData: WordSidebarData | null; pendingSyncResults: Record<number, boolean> }

export function updateSidebarForAnswer(
  data: WordSidebarData | null,
  wordId: number,
  isCorrect: boolean
): WordSidebarData | null
```

> 说明：`computeAnswerResult` 以 **`question.id`** 为键写入 `answers` / `results`，因此同一单词的多道题（如「1 道释义题 + 1 道完形填空」）结果互不覆盖。

---

## 14.3 检测进度多槽位暂存 — v2.2 重构

### 快照结构

```typescript
// src/store/recitationStore.ts
export interface QuizProgressSnapshot {
  source?: 'article' | 'book'   // v2.2 新增：来源标记
  questions: QuizQuestion[]
  currentIndex: number
  answers: Record<string, string>    // question.id(string) → optionId
  results: Record<string, boolean>   // question.id(string) → isCorrect
  startTime: number
  selectedBookId: number | null
  selectedBookName: string | null
  pendingSyncResults: Record<number, boolean>
  sidebarData: WordSidebarData | null
}
```

### 槽位与持久化映射

| 槽位 key (`slotKey`) | 场景 | 持久化 config key（`studywordmode.json`） |
|---|---|---|
| `article` | 文章检测（笔记工具栏发起） | `saved_quiz_progress` |
| `book_${bookId}` | 词书检测（词书管理面板发起） | `saved_quiz_progress_book_${bookId}` |

Store 状态字段由 v2.1 的 `savedQuizProgress: QuizProgressSnapshot | null` 改为：

```typescript
savedQuizProgress: Record<string, QuizProgressSnapshot | null>
```

### Store 操作（签名变更）

```typescript
saveQuizProgress: (source: 'article' | 'book') => void      // v2.2：新增 source 参数
hasSavedQuizProgress: (slotKey: string) => boolean          // v2.2：新增 slotKey
restoreQuizProgress: (slotKey: string) => void              // v2.2：新增 slotKey
clearSavedQuizProgress: (slotKey: string) => void           // v2.2：新增 slotKey
hydrateSavedQuizProgressSlot: (slotKey: string, snapshot: QuizProgressSnapshot | null) => void  // v2.2 重命名
clearSavedQuizProgressSlots: () => void                     // v2.2 新增
```

> v2.1 的 `hydrateSavedQuizProgress(snapshot)` 已由 `hydrateSavedQuizProgressSlot(slotKey, snapshot)` 取代。

### 槽位生命周期

```
开始检测 → saveQuizProgress(source)
  article → 槽位 'article'          → setConfig('saved_quiz_progress', snapshot)
  book    → 槽位 `book_${bookId}`   → setConfig('saved_quiz_progress_book_${bookId}', snapshot)
        ↓
「暂停并返回」（文章检测 / 词书检测均可）
  article → 置 articleQuizSource=false 并 deactivate()
  book    → 清空 quizState，回到 phase='book-manager'
        ↓
恢复时（restoreQuizProgress(slotKey)）：
  1. 重建 quizState（answers/results 由 Record 转回 Map）
  2. articleQuizSource = snapshot.source !== 'book'
  3. 若 slotKey !== 'article' → setConfig('current_book_id', snapshot.selectedBookId) 同步当前词书
  4. 删除该槽并持久化 null（一次性消费）
```

> **v2.1 文档勘误**：v2.1 文档只描述了「`saved_quiz_progress` 单槽 + 启动时直接 `getConfig()`」。v2.2 起为多槽位，且**启动加载时机**改为等待 `recitationService.init(workspacePath)` 成功后执行（服务未就绪时 `get-config` 返回 `{}`）。

### 启动加载 — [App.tsx](../../../src/App.tsx)

```typescript
useEffect(() => {
  if (!workspacePath) return
  recitationService.init(workspacePath).then((ok) => {
    useRecitationStore.getState().clearSavedQuizProgressSlots()
    if (ok) loadSavedQuizSlots()   // 遍历 get-config() 的 saved_quiz_progress / saved_quiz_progress_book_*
  })
}, [workspacePath, recitationService])
```

---

## 14.4 题目生成 — [NotebookToolbar.tsx](../../../src/components/notebook/NotebookToolbar.tsx)

v2.2 起，文章检测的题目构成为：

| 单词情况 | 生成题目 |
|---|---|
| 有完形填空句子（`wordMeta.sentences` 非空） | 1 道释义题（`word-to-meaning` / `meaning-to-word` 随机取一）+ 1 道 `cloze` |
| 无句子（旧 `.transnb` 且实时提取失败） | 2 道释义题（与 v2.1 行为一致） |

- **旧文件兜底**：`wordMeta.sentences` 是生成文章时的快照；对缺失该字段的旧文件，检测时从当前 `notebook.cells` 实时调用 `extractClozeSentences()` 提取（**仅内存使用，不写回文件**）。
- **完形填空题目**：`id = wordId * 2 + 100000`（避免与释义题 id 冲突）；干扰项从 `selectedWords` 随机取 3 个，不足时以 `'(备选单词)'` 补齐；优先选长度 ≤ 80 的短句。

---

## 14.5 检测日志

v2.2 起检测日志的写入点**从 [ReviewPanel.tsx](../../../src/components/recitation/ReviewPanel.tsx) 迁移至 [QuizPanel.tsx](../../../src/components/recitation/QuizPanel.tsx)（ReviewPanel 中的实现已删除）**：

| 时机 | 日志内容 |
|---|---|
| 进入检测 | `【开始检测】词书: {name} \| 单词数: {n} \| 总题数: {m}` |
| 进入结果页 | `【检测完成】词书: {name} \| 总题数: {m} \| 正确: {c} \| 错误: {w} \| 正确率: {p}% \| 用时: {mm}分{ss}秒` |

两处均使用 `useRef` 守卫，避免 React StrictMode 下重复写入。

---

## 14.6 交互变更（QuizPanel）

| 交互 | v2.2 行为 |
|---|---|
| 新增「查看意思」按钮（`quizPanel.dontKnow`） | 以 `DONT_KNOW_ANSWER` 作答（后台记错）并翻卡查看词义；已作答时禁用 |
| `F` / `0` 键 | **作答前** = 「不认识」（记错 + 翻卡）；**作答后** = 翻转查看详情（两键等价，`0` 便于右手区单手操作） |
| `Enter` / `Space` / `→` / `↓` / 「下一题」 | 最后一题且 `isComplete` 时 → 进入完成页（此前会无响应） |
| 「下一题」按钮禁用条件 | `currentIndex >= total - 1 && !isComplete` |
| 「暂停并返回」 | 词书检测同样支持（保存 `book_${bookId}` 槽位并回到词书管理） |
| 翻转卡片 | `cloze` 题展示填入了正确答案的完整句子（`clozeSentence.replace('____', correctText)`） |

---

## 14.7 词书管理交互（BookManagerPanel）

- **恢复检测进度确认**：`handleStartQuiz(bookId)` 先检查槽位
  - 当前词书有暂存 → 弹 `bookManager.resumeQuizConfirm`，确认则 `restoreQuizProgress('book_${bookId}')`
  - 其他词书有暂存 → 弹 `bookManager.switchBookResumeConfirm`（带 `bookName`），确认则 `selectBook()` + 恢复对应槽位
- **删除词书确认**：`handleDelete()` 新增 `bookManager.confirmDelete` 二次确认，删除后调用 `clearSavedQuizProgress('book_${bookId}')` 清理残留槽位

```typescript
interface BatchOperationResult { success: number; failed: number; errors?: string[] }
```

## 14.8 batchImportWords — 仍为 stub（未变更）

```typescript
batchImportWords: async (bookId: number) => {
  // TODO: 实现批量导入单词功能 — 需要新增 IPC 通道和 electron 端处理逻辑
  console.warn('batchImportWords not yet implemented, bookId:', bookId)
  return { success: 0, failed: 0 }
}
```
