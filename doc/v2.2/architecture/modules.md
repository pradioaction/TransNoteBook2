# TSBook2 软件架构 — 核心模块详解 (v2.2)

> v2.2 新增章节：3.19 完形填空题型、3.20 检测进度多槽位、3.21 JSONL 词书导入、3.22 检测日志归属迁移、3.23 工作区自动初始化背诵库、3.24 设置与 Provider 输入归一化、**3.27 搜索面板稳定性与搜索会话收口**。
> 3.1–3.18 与 v2.1 一致，参见 [v2.1 modules.md](../v2.1/architecture/modules.md)。

## 3.19 完形填空题型（cloze）— v2.2 新增

### 题目构成

文章检测的题目生成规则由「每词固定 2 道释义题」调整为：

| 单词情况 | 题目 |
|---|---|
| `wordMeta.newWords[i].sentences` 非空 | 1 道释义题（`word-to-meaning` / `meaning-to-word` 随机取一）+ 1 道 `cloze` |
| `sentences` 为空 | 2 道释义题（与 v2.1 一致） |

设计意图：避免同一单词出现「2 道释义题 + 1 道完形填空 = 被测 3 次」。

### 句子来源与旧文件兜底

```
生成文章时（BookManagerPanel）
  processArticleText()
    → extractClozeSentences(markedParagraphs, newWords + reviewWords)
    → wordMeta.newWords/reviewWords[].sentences   ← 快照，随 .transnb 持久化

发起检测时（NotebookToolbar）
  ├── sentences 非空 → 直接出题
  └── sentences 缺失（旧 .transnb）→ 从当前 notebook.cells 内容现场提取
                                     （仅内存使用，不写回文件）
```

### 关键实现

文件：[utils/articleUtils.ts](../../../src/utils/articleUtils.ts)、[components/notebook/NotebookToolbar.tsx](../../../src/components/notebook/NotebookToolbar.tsx)、[components/recitation/FloatingOptions.tsx](../../../src/components/recitation/FloatingOptions.tsx)

- 句子选择：优先长度 ≤ 80 字符的短句，否则取第一条
- 干扰项：从 `selectedWords` 随机取 3 个其他单词；不足时以 `'(备选单词)'` 补齐至 4 项
- 题目 `id`：`wordId * 2 + 100000`（避开释义题的 `wordId * 2` / `wordId * 2 + 1`）
- 卡片展示：按 `clozeSentence.split('____')` 分段渲染，占位符以主题色加粗显示；卡片高度使用 `CARD_H_CLOZE`
- 翻转卡片：展示填入了正确答案的完整句子（`clozeSentence.replace('____', correctText)`）
- i18n：`floatingOptions.cloze` / `floatingOptions.selectWordInBlank`

### 标记协议（沿用）

| 标记 | 含义 | 产生位置 |
|---|---|---|
| `**word**` | 新词 | [articleUtils.ts#L114](../../../src/utils/articleUtils.ts#L114) |
| `<u>word</u>` | 复习词 | [articleUtils.ts#L114](../../../src/utils/articleUtils.ts#L114) |

`extractClozeSentences()` 会把「该词自身的标记」替换为 `____`，并清理句中其他标记。

---

## 3.20 检测进度多槽位暂存 — v2.2 重构

### 问题

v2.1 只有一个 `saved_quiz_progress` 槽位：文章检测与词书检测互相覆盖；「暂停并返回」对词书检测不可用。

### 方案

```
savedQuizProgress: Record<string, QuizProgressSnapshot | null>

slotKey = 'article'                → config key 'saved_quiz_progress'
slotKey = `book_${bookId}`         → config key `saved_quiz_progress_book_${bookId}`
```

持久化文件仍为工作区内的 `.TransRead/studywordmode.json`（经 `recitation:set-config`）。

### 生命周期

| 阶段 | 行为 |
|---|---|
| 开始检测 | `saveQuizProgress('article' \| 'book')` → 写入对应槽位 |
| 恢复 | `hasSavedQuizProgress(slotKey)` 判定 → `restoreQuizProgress(slotKey)`；词书槽位恢复时同步 `current_book_id`；**恢复即消费**（删除该槽并持久化 `null`） |
| 放弃 | 用户拒绝继续 → `clearSavedQuizProgress(slotKey)` |
| 删除词书 | `clearSavedQuizProgress(\`book_${bookId}\`)` 连带清理 |
| 启动加载 | 工作区就绪 + `recitationService.init()` 成功后 `loadSavedQuizSlots()` 遍历 `saved_quiz_progress*` 键回填；加载前先 `clearSavedQuizProgressSlots()` |

> 启动时机的变化是必需的：v2.1 在 `App` 首次挂载即 `getConfig()`，此时数据库尚未初始化，`get-config` 返回 `{}`，导致进度实际无法恢复。

### 交互确认（BookManagerPanel）

| 场景 | 提示文案 |
|---|---|
| 当前词书有暂存 | `bookManager.resumeQuizConfirm` — 继续 / 放弃 |
| 其他词书有暂存 | `bookManager.switchBookResumeConfirm`（带 `bookName`）— 切换并继续 / 放弃 |
| 删除词书 | `bookManager.confirmDelete`（带 `bookName`）— 二次确认 |

---

## 3.21 远程词书 JSONL 支持 — v2.2 新增

### 兼容策略

```
content.trim()
  ├── 整体 JSON.parse 成功 → 直接使用
  └── 失败 → 按 JSON Lines 解析：逐行 JSON.parse
             跳过空行；损坏行 console.warn 后跳过
```

### 涉及改动

| 文件 | 变更 |
|---|---|
| [electron/recitation/bookImporter.ts](../../../electron/recitation/bookImporter.ts) | 新增私有 `_parseContent(content)`；`importFromFile()` / `importFromContent()` 均改用它 |
| [electron/recitation/gitHubBookFetcher.ts](../../../electron/recitation/gitHubBookFetcher.ts) | 文件匹配由 `.json` 放宽为 `.json` + `.jsonl` |
| [electron/handlers/dialogHandlers.ts](../../../electron/handlers/dialogHandlers.ts) | `open-book-dialog` 过滤器 `Book Files (JSON/JSONL)`：`['json','jsonl']` |
| [components/recitation/ImportBookDialog.tsx](../../../src/components/recitation/ImportBookDialog.tsx) | 书名 = 去扩展名文件名 + 目录标识，避免跨目录同名冲突；空状态文案改为「没有 JSON / JSONL 词书文件」 |

---

## 3.22 检测日志归属迁移 — v2.2 修正

**v2.1**：检测结果日志写在 [ReviewPanel.tsx](../../../src/components/recitation/ReviewPanel.tsx) 保存结果的 `useEffect` 内，导致「词书检测」与「文章检测」两条链路的日志时机不一致，且进入结果页前已触发。

**v2.2**：日志迁至 [QuizPanel.tsx](../../../src/components/recitation/QuizPanel.tsx)，两个时机各写一条，均用 `useRef` 守卫防 StrictMode 重复：

| 时机 | 内容 |
|---|---|
| 进入检测 | `【开始检测】词书: {name} \| 单词数: {n} \| 总题数: {m}` |
| 进入结果页（`showComplete`） | `【检测完成】词书: {name} \| 总题数: {m} \| 正确: {c} \| 错误: {w} \| 正确率: {p}% \| 用时: {mm}分{ss}秒` |

日志经 `useOutputStore.addLog()` → `subscribe` → `logService.appendToFile()` → `.TransRead/log/yyyy-MM-dd.log`。

---

## 3.23 工作区自动初始化背诵数据库 — v2.2 变更

**v2.1**：背诵数据库仅在用户首次点击背诵图标（`RecitationShell` 挂载）时 `init`。

**v2.2**：[workspaceStore.setWorkspace()](../../../src/store/workspaceStore.ts#L39-L48) 在设置工作区后立即调用模块级单例 `createRecitationService().init(path)`：

```typescript
setWorkspace: (path) => {
  set({ workspacePath: path, workspaceFiles: [] })
  if (path) {
    get().scanWorkspaceFiles()
    getRecitationService().init(path).catch((err) => {
      console.error('[Recitation] 工作区加载后自动初始化数据库失败:', err)
    })
  }
}
```

意义：使 `App` 启动时的检测进度回填有可靠的数据基础（见 3.20）。失败仅记录日志，不阻塞 UI；`init` 内部对工作区切换做了旧库关闭与新库重建。

---

## 3.24 设置与 Provider 输入归一化 — v2.2 修正

**问题**：设置面板的输入框容易带入首尾空格（尤其复制粘贴的 endpoint / 环境变量名），导致 Provider 请求失败或 API Key 查找不到。

**修复**：

| 层 | 处理 |
|---|---|
| UI 层（[SettingsDialog.tsx](../../../src/components/settings/SettingsDialog.tsx)） | `handleAddModel()` 对 `name` / `endpoint` / `model` / `apiKeyEnv` 做 `trim()` 后再写库；`name` 与 `endpoint` 为空直接 return |
| Provider 层（ollama / openai / ark） | 构造函数对配置值 `trim()`，空白值回退默认值；`resolveApiKey()` 对 `apiKeyEnv`、`settingStore.envVars[].name`、`envVars[].value`、`process.env[...]` 全部 `trim()` |

附带变更：`SettingsDialog` 移除了遮罩层的 `onClick={onClose}` 与内容区 `stopPropagation`，**点击背景不再关闭设置弹窗**（避免误触丢失未保存输入）。

### 3.24.1 单元格阅读区高度修复（同批提交）

[CellEditor.tsx](../../../src/components/cells/CellEditor.tsx) 为编辑/阅读态外层与 `.md-body` 补充 `display: flex; flexDirection: column; flex: 1`，修复阅读态内容不足时译文区高度塌陷的视觉问题。

---

## 3.25 侧边栏单词显示优化 — v2.2 微调

[WordListItem.tsx](../../../src/components/recitation/WordListItem.tsx)：单词列由 `flexShrink: 0; minWidth: 30%; maxWidth: 60%` 改为 `flex: '0 1 auto'; minWidth: 0`，释义列改为 `flex: '1 1 0'`。效果是长单词优先完整展示，释义按剩余空间省略。

---

## 3.26 v2.1 文档勘误（补记）

v2.1 文档保持冻结，以下差异在此集中修正。其中**检测页翻转卡片自动朗读单词**（[QuizPanel.tsx](../../../src/components/recitation/QuizPanel.tsx) 中的自动 `speak()` effect）虽与 v2.1 文档同批提交（`a4d63bf`），但 v2.1 文档未记录，此处补记。

| 编号 | v2.1 文档 | 实际实现 |
|---|---|---|
| E-1 | 检测页无「自动朗读」描述 | 切换题目时自动朗读当前单词；翻转卡片展示时朗读主单词 |
| E-2 | `QuizPanel` 「暂停并返回」仅文章检测可用 | v2.2 起词书检测同样可用（见 3.20） |
| E-3 | `TranslationStatus` / `state: 'translating'` | `OperationStatus` / `state: 'running'`，新增 `operationType` |
| E-4 | `WorkspaceStore` 含 `recentFiles` / `addRecentFile` | 已迁移至 `SettingStore`；`WorkspaceStore` 新增 `sidebarWidth` |
| E-5 | `TodayWordsResult { new_words, review_words }` | camelCase 五字段：`newWords` / `reviewWords` / `testedNewWordIds` / `testedReviewWordIds` / `quizResults` |
| E-6 | 快捷键表列出 `Ctrl+S`/`Ctrl+O` 等为「待添加」 | 实际均已实现，另有 `Ctrl+Shift+Enter` / `Ctrl+Shift+I` / `Ctrl+J`（详见 [v2.2 api/stores-hooks-services.md](../api/stores-hooks-services.md)） |
| E-7 | `NotebookData` / `NotebookFile` 未提 `wordMeta` | 均含 `wordMeta?: ArticleWordMeta` |
| E-8 | `serializeNotebookFile(cells)` / `splitTextIntoParagraphs(text)` | 均支持第二参数（`wordMeta` / `SplitMode`） |
| E-9 | TTS 模块文件仅列 `webSpeech.ts` + `kokoroTrt.ts` | 另有 `edgeTts.ts` + `electron/handlers/edgeTtsHandlers.ts`；Kokoro/Edge 受 `SHOW_DEV_TTS_PROVIDERS = false` 隐藏 |
| E-10 | `tts` 桥接为必选属性 | 实为 `tts?` / `edgeTts?` 可选属性 |
| E-11 | `TranslationService` 无 `reviewCell` | 已实现 `reviewCell(index, promptTemplate?)` + `promptTemplates.review` |
| E-12 | `FileService` 无 `saveImportAsTransnb` | 已实现 `saveImportAsTransnb(options: ImportTextOptions)` |
| E-13 | `RecitationService` 方法清单不全 | 实现另有 `createBook` / `searchBooks` / `addWord` / `updateWord` / `deleteWord` / `getStageDistribution` / `getOverallStageDistribution` / `getWordsByStage`（接口声明待补齐） |
| E-14 | `NotebookStore` 含 `createEmptyNotebook()` | 实现中有该方法，但 `NotebookStore` 接口**未声明** |
| E-15 | v2.0 文档称搜索「清空搜索或双击编辑时自动清除高亮」 | 当时仅「双击进入编辑态」会清除高亮，清空搜索框**不会**清除；v2.2 已在 `SearchStore.setKeyword('')` 中补齐（见 §3.27） |

---

## 3.27 搜索面板稳定性与搜索会话收口 — v2.2 补记

### 问题

| 现象 | 根因 |
|---|---|
| 点击活动栏「搜索」图标后整个应用变空白（控制台先报 `The result of getSnapshot should be cached to avoid an infinite loop`，随后 `Maximum update depth exceeded`） | [SearchPanel.tsx](../../../src/components/search/SearchPanel.tsx) 的选择器写成 `s.notebook?.cells ?? []`，未打开文件时每次调用都新建空数组；zustand v5 的 `useStore` 直接把选择器结果交给 `useSyncExternalStore`（无相等比较缓存），快照永不相等 → 无限重渲染；渲染进程此前没有任何 ErrorBoundary，React 卸载整棵树 |
| 搜索 → 点击结果 → 开始检测 → 中途退出，返回阅读界面仍满屏 `<mark>` 高亮，而搜索框为空且清不掉 | 搜索会话被拆成两处：`keyword` / `results` / `selectedIndex` 是 SearchPanel 局部 state，`highlightText` / `scrollToCellIndex` 在 notebookStore。进入检测时侧边栏（含 SearchPanel）随阅读态卸载，关键词丢失而全局高亮保留；`clearSearchHighlight()` 当时只在进入编辑态时调用 |

### 方案

1. **搜索会话统一到 `SearchStore`**（新增 [store/searchStore.ts](../../../src/store/searchStore.ts)）
   - 字段：`keyword` / `results` / `selectedIndex` / `highlightText` / `scrollToCellIndex`
   - 清理时机：清空关键词（`setKeyword('')` 顺带清高亮）/ 文件切换（`notebookStore` 的 `openFile`、`closeNotebook`、`switchToFile`、`setNotebook`）/ 进入检测模式（`recitationStore.enterRecitationMode()`）
2. **稳定选择器规范**：选择器禁止返回 `?? []` / `?? {}` / `.map()` 等每次新建的引用，空值兜底使用模块级常量（`const EMPTY_CELLS: NotebookCell[] = []`）
3. **分区 ErrorBoundary**（新增 [components/common/ErrorBoundary.tsx](../../../src/components/common/ErrorBoundary.tsx)）：侧边栏内容区、阅读区（工具栏 + 编辑器 + 底部面板）、检测区各自隔离，单面板异常不再导致整页白屏，fallback 提供「重试」
4. **模式进出的统一收口**（`recitationStore.enterRecitationMode()`）：`activate()` 与 `restoreQuizProgress()` 均先清空搜索会话并停止阅读计时器
5. 同批附带修复：

| 修复项 | 文件 | 说明 |
|---|---|---|
| 检测模式快捷键守卫 | [hooks/useKeyboard.ts](../../../src/hooks/useKeyboard.ts) | `recitationStore.active` 为真时全局快捷键全部跳过，避免检测中 `Delete` 误删阅读稿单元格 |
| 计时器生命周期 | [components/reading/ReadingTimer.tsx](../../../src/components/reading/ReadingTimer.tsx)、`recitationStore` | 卸载时真正 `stopTimer()`（原先只写日志，`running` 残留）；「检测文章」恢复进度分支同样停表 |
| 待同步结果不丢失 | [components/recitation/QuizPanel.tsx](../../../src/components/recitation/QuizPanel.tsx) | 同步改为「快照 + 消费」：卸载兜底使用渲染期快照，修掉「退出」先 `reset()` 清空 `pendingSyncResults` 导致未满 10 条的已答单词丢失 |
| 高亮注入安全化 | [components/cells/CellEditor.tsx](../../../src/components/cells/CellEditor.tsx) | `<mark>` 改为文本节点级注入（`TreeWalker` 遍历 `marked` 输出），关键词命中标签名/属性时不再破坏 HTML 结构 |
| 出题纯函数化 | [components/notebook/NotebookToolbar.tsx](../../../src/components/notebook/NotebookToolbar.tsx) | 旧文章兜底提取的句子只写入本地 `Map`，不再原地改写 `wordMeta.sentences`；完形填空选句改为排序副本，避免污染阅读数据并随保存写回文件 |

### 涉及文件

| 文件 | 变更 |
|---|---|
| `src/store/searchStore.ts` | 新建：搜索会话状态 + `resetSearch()` / `clearHighlight()` |
| `src/store/notebookStore.ts` | 移除 5 个搜索成员；4 个文件切换入口调用 `resetSearch()` |
| `src/store/recitationStore.ts` | 新增 `enterRecitationMode()`；`activate()` / `restoreQuizProgress()` 接入 |
| `src/components/search/SearchPanel.tsx` | 选择器改为模块级常量兜底；状态改读 `SearchStore` |
| `src/components/cells/CellEditor.tsx`、`src/components/notebook/NotebookEditor.tsx` | 改订阅 `SearchStore`；高亮文本节点级注入 |
| `src/components/common/ErrorBoundary.tsx` | 新建：分区错误边界（`sidebar` / `reading` / `recitation`） |
| `src/components/layout/AppShell.tsx`、`Sidebar.tsx` | 接入错误边界 |
| `src/locales/{zh-CN,en-US}.json` | 新增 `errorBoundary.*` 文案 |
| `tests/store/searchStore.test.ts`、`tests/components/SearchPanel.test.tsx` | 新建：搜索会话语义 / 生命周期收口 / 无文件时挂载回归 |

---

## 3.28 答题自动朗读开关（autoRead）— v2.2 新增

### 需求

v2.1 起检测页存在 3 处硬编码的自动朗读（切题朗读题干、作答后朗读所选单词、翻卡朗读单词），用户无法按场景关闭；且 `meaning-to-word`（看中文释义选英文单词）题型完全不朗读，无法把朗读当作难度提示使用。

### 方案：4 个按「使用场景」划分的开关

```typescript
// src/store/ttsSettingStore.ts
export interface TTSAutoReadSettings {
  question: boolean   // 切题时朗读题干单词（仅英文题干题型，不泄露答案）
  hint: boolean       // 答题前朗读答案单词作为提示（会提前听到答案）
  answer: boolean     // 作答后朗读所选选项的单词
  flip: boolean       // 翻卡时朗读卡片上的单词
}
```

默认 `{ question: true, hint: false, answer: true, flip: true }`：前三项沿用 v2.1 行为，`hint` 默认关闭以免降低题目难度。

| 开关 | 触发时机 | 朗读内容 | 位置 |
|---|---|---|---|
| `question` | 切题（延迟 100ms） | 题干英文单词 | [QuizPanel.tsx](../../../src/components/recitation/QuizPanel.tsx#L347-L371) |
| `hint` | 切题（延迟 100ms） | 正确选项文本（答案单词） | 同上 `else` 分支 |
| `answer` | 作答后 | 所选选项的单词 | [QuizPanel.tsx](../../../src/components/recitation/QuizPanel.tsx#L242) |
| `flip` | 翻卡 | 卡片单词 | [QuizPanel.tsx](../../../src/components/recitation/QuizPanel.tsx#L373-L377) |

### 解耦要点

| 约束 | 说明 |
|---|---|
| 决策在 QuizPanel，执行在 TTS | `ttsService` / Provider 对「答题」场景零感知，依赖方向单向：`QuizPanel → useTTSService → ttsSettingStore`。若把场景判断下沉进 `ttsService`，才会形成反向耦合 |
| 命名按场景，不按题型 | 字段名不含 `quizTypes` 术语，题型增删不波及配置层 |
| 手动朗读独立 | `SpeakButton` 不受 `autoRead.*` 约束，仅 `tts.enabled` 可全局静音 |
| ref 快照读取 | `autoReadRef`（[QuizPanel.tsx#L46-L50](../../../src/components/recitation/QuizPanel.tsx#L46-L50)）避免把 `autoRead` 加入切题 `useEffect` 依赖后，改设置触发 `setIsFlipped(false)` 等副作用重跑 |
| 旧配置兼容 | `loadFromDisk()` 对 `autoRead` 逐层兜底，旧 `settings.json` 无该字段时回落默认值 |

### 顺带修正：答案单词取法

实现 `hint` 时暴露出 `QuizQuestion.word` 的语义随题型漂移：

| 题型 | `word` 实际内容 |
|---|---|
| `word-to-meaning` | 英文单词（= 题干） |
| `meaning-to-word` | **中文释义（= 题干）** |
| `cloze` | 英文单词（= 答案） |

故「答案单词」一律取正确选项文本 `q.options.find(o => o.id === q.correctAnswer)?.text`（与 [QuizPanel.tsx#L195](../../../src/components/recitation/QuizPanel.tsx#L195) 翻转卡数据、[FloatingOptions.tsx#L285-L287](../../../src/components/recitation/FloatingOptions.tsx#L285-L287) 题干朗读按钮一致）。字段语义本身未改，`QuizQuestion` 仍保留该陷阱，详见 [api/tts.md §13.5](../api/tts.md#135-答题自动朗读开关autoread--v22-新增)。

### 涉及文件

| 文件 | 变更 |
|---|---|
| `src/store/ttsSettingStore.ts` | 新增 `TTSAutoReadSettings` / `setAutoRead()`；`loadFromDisk()` 改逐层兜底 |
| `src/hooks/useTTSService.ts` | 返回值新增 `autoRead` / `setAutoRead` |
| `src/components/recitation/QuizPanel.tsx` | 4 处自动朗读按开关 gate；新增 `autoReadRef` 快照 |
| `src/components/settings/SettingsDialog.tsx` | TTS 页新增「自动朗读」分组（4 个复选框） |
| `src/locales/{zh-CN,en-US}.json` | 新增 `settings.ttsAutoRead*` 文案 |

