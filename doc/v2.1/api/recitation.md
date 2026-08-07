# TSBook2 API -- 背诵/词书管理模块

> v2.1 变更：测验引擎提取到 `quizEngine.ts`，`batchImportWords` 标记 TODO。

与 v2.0 一致的内容参见 [v2.0 recitation.md](../v2.0/api/recitation.md)。

## 14.12 quizEngine 模块 — v2.1 新增

`src/recitation/quizEngine.ts` 提取了 `recitationStore` 中的测验引擎纯逻辑：

```typescript
// 创建初始测验状态
export function createQuizState(questions: QuizQuestion[]): QuizState

// 处理单次答题（纯函数）
export function computeAnswerResult(
  quizState: QuizState,
  sidebarData: WordSidebarData | null,
  pendingSyncResults: Record<number, boolean>,
  questionIndex: number,
  selectedOptionId: string
): { quizState: QuizState; sidebarData: WordSidebarData | null; pendingSyncResults: Record<number, boolean> }

// 更新侧边栏单词状态
export function updateSidebarForAnswer(
  data: WordSidebarData | null,
  wordId: number,
  isCorrect: boolean
): WordSidebarData | null
```

`recitationStore` 的 `startQuiz` 和 `answerQuestion` 委托给 quizEngine，Store 代码量减少约 40 行。

## 14.13 batchImportWords — v2.1 变更

```typescript
// src/services/recitationService.ts
batchImportWords: async (bookId: number) => {
  // TODO: 实现批量导入单词功能 — 需要新增 IPC 通道和 electron 端处理逻辑
  console.warn('batchImportWords not yet implemented, bookId:', bookId)
  return { success: 0, failed: 0 }
}
```

> v2.1: stub 添加明确 TODO 注释和 console.warn，替代原来的通用 stub 注释。
