# TSBook2 软件架构 — 项目概述与系统架构 (v2.2)

> v2.2 聚焦**检测（测验）体验与数据健壮性**：完形填空题型、检测进度多槽位暂存、JSONL 词书导入、设置输入归一化。
> 项目定位、技术栈、与原项目 TransNb 的对比与 v2.0/v2.1 一致，参见 [v2.1 overview.md](../v2.1/architecture/overview.md)、[v2.0 overview.md](../v2.0/architecture/overview.md)。

## 1. 版本基线说明

| 版本 | 时间基线 | 内容来源 |
|---|---|---|
| v2.1 | 文档最后修订 2026-08-02，随提交 `a4d63bf`(2026-08-07) 落库 | TTS 单例 / ttsSettingStore / outputStore 解耦 / quizEngine 提取 |
| **v2.2** | **2026-08-07 之后** | 提交 `bac66dc`、`3cad3a7`、`c5188de`、`1ca3621`、`110b801` |

| 提交 | 日期 | 摘要 |
|---|---|---|
| `bac66dc` | 2026-08-07 | 优化侧边栏单词显示：优先展示完整单词 |
| `3cad3a7` | 2026-08-09 | 优化检测体验 — 最后一题停留复习 + 添加检测日志 |
| `c5188de` | 2026-08-12 | 文章检测新增完形填空题型 |
| `1ca3621` | 2026-08-20 | 检测进度多槽位保存，新增「不认识」按钮与 F 键作答前行为 |
| `110b801` | 2026-09-12 | 远端词书支持 JSONL，优化设置与单元格交互 |

## 2. 系统架构 — v2.2 变更点

### 2.1 整体架构图（变更部分）

```
src/
├── store/
│   ├── recitationStore.ts   # v2.2 变更：检测进度由单快照 → Record<slotKey, snapshot>
│   └── workspaceStore.ts    # v2.2 变更：setWorkspace() 后自动 init 背诵数据库
├── recitation/
│   ├── quizTypes.ts         # v2.2 变更：题型 + 'cloze'，新增 DONT_KNOW_ANSWER
│   └── quizEngine.ts        # v2.2 无变更（纯函数签名稳定）
├── utils/
│   └── articleUtils.ts      # v2.2 变更：新增 extractClozeSentences()
├── components/recitation/
│   ├── QuizPanel.tsx        # v2.2 变更：完成页、不认识按钮、F/0 键语义、检测日志
│   ├── FloatingOptions.tsx  # v2.2 变更：cloze 卡片高度与 ____ 高亮
│   ├── BookManagerPanel.tsx # v2.2 变更：进度恢复确认、删除词书确认
│   └── WordListItem.tsx     # v2.2 变更：flex 布局，优先展示完整单词
└── types/notebook.ts        # v2.2 变更：ArticleWordMeta.sentences

electron/
├── handlers/dialogHandlers.ts       # v2.2 变更：open-book-dialog 支持 jsonl
└── recitation/
    ├── bookImporter.ts              # v2.2 变更：_parseContent() 兼容 JSON Lines
    └── githubBookFetcher.ts         # v2.2 变更：扫描 .json 与 .jsonl
```

### 2.2 Store 清单（v2.2）

| Store | 文件 | 变更 |
|---|---|---|
| notebookStore | `store/notebookStore.ts` | 无变更 |
| workspaceStore | `store/workspaceStore.ts` | **v2.2 变更**：`setWorkspace()` 触发背诵数据库自动初始化 |
| themeStore | `store/themeStore.ts` | 无变更 |
| settingStore | `store/settingStore.ts` | 无变更 |
| ttsSettingStore | `store/ttsSettingStore.ts` | 无变更 |
| **recitationStore** | `store/recitationStore.ts` | **v2.2 变更**：`savedQuizProgress` 槽位化 + 相关 action 签名变更 |
| outputStore | `store/outputStore.ts` | 无变更 |
| workspaceConfigStore | `store/workspaceConfigStore.ts` | 无变更 |
| readingTimerStore | `store/readingTimerStore.ts` | 无变更 |

### 2.3 v2.2 新增/变更接口速览

| 接口 | 位置 | 说明 |
|---|---|---|
| `QuizQuestionType` + `'cloze'` | `recitation/quizTypes.ts` | 新增完形填空题型 |
| `DONT_KNOW_ANSWER = 'N'` | `recitation/quizTypes.ts` | 「不认识」作答标记 |
| `QuizQuestion.clozeSentence?` | `recitation/quizTypes.ts` | 含 `____` 占位符的句子 |
| `ArticleWordMeta.newWords/reviewWords[].sentences?` | `types/notebook.ts` | 逐词完形填空句（最多 3 条） |
| `extractClozeSentences(paragraphs, words)` | `utils/articleUtils.ts` | 从已标注段落提取句子 |
| `QuizProgressSnapshot.source?` | `store/recitationStore.ts` | `'article' \| 'book'` |
| `savedQuizProgress: Record<string, QuizProgressSnapshot \| null>` | `store/recitationStore.ts` | 槽位化（`article` / `book_${bookId}`） |
| `BookImporter._parseContent()` | `electron/recitation/bookImporter.ts` | JSON → JSONL 降级解析 |
