# TSBook2 软件架构 — 数据流程、扩展点与参考 (v2.2)

> v2.2 更新：新增完形填空题目生成流程、检测进度槽位持久化流程、JSONL 词书导入流程、搜索会话与高亮生命周期；目录结构与设计模式补充 v2.2 变更。
> 其余章节与 v2.1 一致，参见 [v2.1 reference.md](../v2.1/architecture/reference.md)。

## 4. 数据流程

### 4.11 完形填空题目生成流程 — v2.2 新增

```
【生成文章】
BookManagerPanel「生成文章」
  → translationService.generateSceneText(words)
  → articleUtils.processArticleText(article, newWords, reviewWords, bookId, bookName)
       ├── 标注：新词 → **word**，复习词 → <u>word</u>
       ├── 段落拆分 → markedParagraphs → cells[].content
       └── extractClozeSentences(paragraphs, newWords+reviewWords)
             → wordMeta.{newWords,reviewWords}[].sentences（每词 ≤3 条）
  → NotebookFile.wordMeta → serializeNotebookFile(cells, wordMeta) → .transnb

【发起检测】
NotebookToolbar「检测文章」
  → 读取 notebook.wordMeta
  → 对 sentences 为空的词现场 extractClozeSentences(cells[].content) 兜底
  → 逐词生成题目：
       有 sentences → [1 道释义题, 1 道 cloze]
       无 sentences → [2 道释义题]
  → 打乱顺序 → recitationStore.startQuiz(questions) → createQuizState()

【答题展示】
QuizPanel → FloatingOptions
  cloze 卡片：clozeSentence.split('____') 分段渲染 + 高亮 ____
  F / 点击卡片 → 翻转卡片展示完整单词数据（cloze 题附填入答案后的完整句子）
```

### 4.12 检测进度槽位持久化与恢复流程 — v2.2 新增

```
【保存】
QuizPanel「暂停并返回」
  ├── 文章检测：saveQuizProgress('article')  → 槽位 'article'
  └── 词书检测：saveQuizProgress('book')     → 槽位 `book_${selectedBookId}`
        ↓
recitationStore.saveQuizProgress(source)
  ├── set({ savedQuizProgress: { ...prev, [slotKey]: snapshot } })
  └── persistSavedProgress(slotKey, snapshot)
        → recitation:set-config(
             'saved_quiz_progress'                  | article,
             'saved_quiz_progress_book_${bookId}'   | book,
             snapshot )
        → {workspace}/.TransRead/studywordmode.json

【恢复（应用启动）】
App useEffect（依赖 workspacePath）
  → recitationService.init(workspacePath)
  → clearSavedQuizProgressSlots()
  → loadSavedQuizSlots()：recitation:get-config()
        遍历 'saved_quiz_progress' / 'saved_quiz_progress_book_*'
        → hydrateSavedQuizProgressSlot(slotKey, snapshot)

【恢复（用户触发）】
NotebookToolbar「检测文章」 → hasSavedQuizProgress('article') → restoreQuizProgress('article')
BookManagerPanel「开始检测」 → 当前/其他词书槽位确认 → restoreQuizProgress(slotKey)
  ├── answers/results: Record → Map 重建 quizState
  ├── articleQuizSource = snapshot.source !== 'book'
  ├── 非 article 槽位：setConfig('current_book_id', snapshot.selectedBookId)
  └── 删除该槽并 persistSavedProgress(slotKey, null)（一次性消费）
```

### 4.13 JSONL 词书导入流程 — v2.2 新增

```
ImportBookDialog（本地 / 远程两种入口）
【本地】
  open-book-dialog（filter: json, jsonl）→ filePath
  → recitation:import-book-from-file
【远程】
  recitation:fetch-remote-books(source)
      → gitHubBookFetcher：扫描仓库，匹配 .json / .jsonl
  → 书名 = 去扩展名文件名 + ` (${dir})`（避免跨目录同名）
  → recitation:import-remote-book(downloadUrl, bookName)
        ↓
  BookImporter._parseContent(content)
      1) JSON.parse(content.trim())
      2) 失败 → 逐行 JSON.parse（JSON Lines），跳过空行与损坏行
        ↓
  _parseWords(data) → Book + Word[] → better-sqlite3 落库
```

### 4.14 搜索会话与高亮生命周期 — v2.2 新增

```
【建立会话】SearchPanel 输入关键词
  → SearchStore.setKeyword(value)
  → 300ms 防抖 → setResults(searchInCells(cells, value))

【点击结果】
  SearchPanel → SearchStore.selectResult(cellIndex, matchedText)
  ├── selectedIndex / scrollToCellIndex = cellIndex
  └── highlightText = matchedText
        ├── NotebookEditor：查询 [data-cell-index] → scrollIntoView → setScrollToCell(null)
        └── CellEditor（阅读态）：DOMParser 解析 marked 输出 → TreeWalker 遍历文本节点注入 <mark>

【会话清理（三条边界）】
  1) 关键词清空 → setKeyword('') → highlightText = ''
  2) 文件切换/关闭 → notebookStore.{openFile|closeNotebook|switchToFile|setNotebook} → resetSearch()
  3) 进入检测模式 → recitationStore.enterRecitationMode()
        （activate() 与「检测文章」的 restoreQuizProgress() 都经过此处）
        → resetSearch() + readingTimerStore.stopTimer(' (quiz started)')
```

> 设计要点：搜索是**阅读态的视图级会话**，其状态不能跨文档、跨模式存活；`resetSearch()` 是唯一的全量清理入口。

## 5. 扩展点

### 5.10 新增检测题型 — v2.2

1. 在 `recitation/quizTypes.ts` 的 `QuizQuestionType` 联合类型中添加新字面量
2. 在 [NotebookToolbar.tsx](../../../src/components/notebook/NotebookToolbar.tsx) 的题目生成段追加该题型的 `QuizQuestion`（注意 `id` 分配不要与 `wordId * 2` / `wordId * 2 + 1` / `wordId * 2 + 100000` 冲突）
3. 在 [FloatingOptions.tsx](../../../src/components/recitation/FloatingOptions.tsx) 中按 `question.type` 分支渲染卡片头部与提示文案（同步 `src/locales/{zh-CN,en-US}.json`）
4. 若需新的判定语义，在 [quizEngine.ts](../../../src/recitation/quizEngine.ts) 的 `computeAnswerResult()` 中扩展（当前 `DONT_KNOW_ANSWER` 复用「不等即错」逻辑，无需分支）

### 5.11 新增检测进度槽位 — v2.2

1. 槽位 key 统一形如 `<domain>_${id}`，`article` 为保留字
2. 在 [recitationStore.ts](../../../src/store/recitationStore.ts) 的 `persistSavedProgress()` 中补充 `slotKey → configKey` 映射规则（当前为 `book_` 前缀特判）
3. 在 [App.tsx](../../../src/App.tsx) 的 `loadSavedQuizSlots()` 中补充该前缀的扫描分支

### 5.12 新增 TTS/翻译 Provider

与 v2.1 一致（翻译：新增 Provider 类 + `providerFactory` 分支；TTS：新增 Provider 类 + 打开 `SHOW_DEV_TTS_PROVIDERS` 或改写 `createSystemTTSProviders()`）。

## 7. 目录结构（v2.2）

```
TSBook2/
├── electron/                     # 主进程
│   ├── main.ts                   # 窗口管理 + 处理器注册
│   ├── preload.ts                # contextBridge（含 recitationAPI / tts / edgeTts）
│   ├── state.ts                  # recitationState 单例 + settings.json 读写
│   ├── types.ts                  # FileEntry / DirEntry / ImportResult
│   ├── handlers/
│   │   ├── fileHandlers.ts       # read/write/exists/delete/rename/append/read-clipboard/read-directory(-recursive)
│   │   ├── dialogHandlers.ts     # open/save/folder/import/book-dialog（v2.2：jsonl）
│   │   ├── settingsHandlers.ts   # get/set-settings
│   │   ├── recitationHandlers.ts # 背诵模式全量 CRUD + 学习流程 + 统计
│   │   ├── workspaceConfigHandlers.ts
│   │   ├── ttsHandlers.ts        # Kokoro GPU TTS（默认隐藏）
│   │   └── edgeTtsHandlers.ts    # Edge TTS（默认隐藏）
│   ├── workspace/
│   │   └── configProvider.ts     # ConfigProvider 接口 + FileBasedConfig
│   └── recitation/
│       ├── database.ts / bookDAL.ts / wordDAL.ts / userStudyDAL.ts / recitationDAL.ts / statDAL.ts
│       ├── ebbinghaus.ts / bookService.ts / studyService.ts
│       ├── bookImporter.ts       # v2.2：_parseContent() 兼容 JSON Lines
│       └── githubBookFetcher.ts  # v2.2：匹配 .json + .jsonl
├── src/                          # 渲染进程
│   ├── main.tsx / App.tsx        # 入口；App 负责主题/设置/TTS 配置加载 + 检测进度回填
│   ├── components/
│   │   ├── layout/               # AppShell / ActivityBar / Sidebar / Panel / StatusBar
│   │   ├── notebook/             # NotebookEditor / NotebookToolbar（v2.2：cloze 出题）
│   │   ├── cells/                # CellContainer / CellEditor / CellOutput / CellToolbar / CellCollapseIndicator
│   │   ├── common/               # SpeakButton / ContextMenu / ErrorBoundary（v2.2：分区错误边界）
│   │   ├── file/                 # FileExplorer
│   │   ├── import/               # ImportDialog
│   │   ├── reading/              # ReadingTimer
│   │   ├── search/               # SearchPanel
│   │   ├── settings/             # SettingsDialog（v2.2：输入 trim + 遮罩不关闭）
│   │   ├── welcome/              # WelcomePage
│   │   ├── icons.tsx
│   │   └── recitation/           # RecitationShell / BookManagerPanel / BookCard / StatsPanel
│   │                             # QuizPanel / FloatingOptions / ReviewPanel / WordSidebar
│   │                             # WordListItem / WordManagerDialog / WordEditorDialog
│   │                             # CreateBookDialog / ImportBookDialog / ResizeHandle
│   ├── hooks/                    # useTheme / useKeyboard / useFileService / useCellService
│   │                             # useTranslationService / useRecitationService / useBookmark
│   │                             # useTTSService / useSpeek
│   ├── services/                 # types / index / translationService / recitationService
│   │                             # ttsService / logService
│   ├── store/                    # notebookStore / workspaceStore / themeStore / settingStore
│   │                             # ttsSettingStore / recitationStore / outputStore
│   │                             # workspaceConfigStore / readingTimerStore
│   ├── recitation/               # types / quizTypes / quizEngine / wordSidebarTypes / ebbinghaus / index
│   ├── translation/              # types / providerFactory / providers/{ollama,openai,ark}
│   ├── tts/                      # types / providerFactory / providers/{webSpeech,kokoroTrt,edgeTts}
│   ├── types/                    # notebook.ts（全局 + Window 声明）/ electron.ts / vite-env.d.ts
│   ├── utils/                    # fileUtils / articleUtils（v2.2：extractClozeSentences）
│   ├── styles/                   # global.css / themes.ts
│   └── locales/                  # i18n.ts / zh-CN.json / en-US.json
├── native/kokoro-trt-native/     # Kokoro C++ Napi Addon 工程
├── scripts/                      # dev-electron.js / build-native-dist.js
├── tests/                        # store/notebookStore.test.ts / store/themeStore.test.ts
│                                 # store/searchStore.test.ts（v2.2）/ components/SearchPanel.test.tsx（v2.2）
│                                 # components/fileUtils.test.ts / setup.ts
├── docs/                         # tts-kokoro-20260722.md（TTS 引擎专题）
└── doc/                          # 文档（本目录）
```

### 7.1 目录结构变更说明（v2.2）

| 条目 | 说明 |
|---|---|
| `src/reading/` | **不存在**。v2.1 文档目录树未列 `components/reading/`，实际 `ReadingTimer.tsx` 位于 `components/reading/` |
| `src/test-timer/` | 存在该目录且**当前为空**，未参与主流程 |
| `src/styles/global.css` | 实际存在（v2.1 文档仅在 v2.0 树中列出） |

## 8. 设计模式（v2.2）

| 模式 | 应用位置 | 版本 |
|---|---|---|
| 模块级单例 | `getTTSService()`、`useTranslationService.getService()`、`useRecitationService.getService()`、`workspaceStore.getRecitationService()` | v2.1 / **v2.2 新增 workspaceStore 处** |
| subscribe 解耦 | `outputStore.subscribe()` → `logService` | v2.1 |
| 回调解耦 | `TranslationServiceDeps.onTranslateComplete` | v2.1 |
| 纯函数引擎 | `quizEngine.ts`（v2.2 新增题型无需改动引擎） | v2.1 |
| **槽位化持久化（Slot Registry）** | `savedQuizProgress: Record<slotKey, snapshot>`：`article` / `book_${bookId}`，key 即命名空间 | **v2.2 新增** |
| **降级解析（Fallback Parsing）** | `BookImporter._parseContent()`：JSON → JSON Lines | **v2.2 新增** |
| **哨兵值作答（Sentinel Answer）** | `DONT_KNOW_ANSWER = 'N'`：不指向任何选项，复用「不等即错」判定 | **v2.2 新增** |

## 12. 版本状态

> 当前版本: v2.2 | 最后更新: 2026-09-20

### v2.2（已完成）— 检测体验与数据健壮性
- **完形填空题型**：新增 `cloze` 题型 + `extractClozeSentences()` + `wordMeta.sentences`
- **不认识按钮 / F、0 键语义**：`DONT_KNOW_ANSWER`，作答前 F/0 = 不认识，作答后 F/0 = 详情（0 为右手区等效键）
- **完成页停留**：最后一题答完不再跳空，进入结果页
- **检测进度多槽位**：`article` / `book_${bookId}` 独立暂存、恢复即消费
- **检测日志归属**：ReviewPanel → QuizPanel（开始 + 完成各一条）
- **JSONL 词书**：本地对话框、远程扫描、导入解析三层支持
- **工作区自动初始化**：`setWorkspace()` 即初始化背诵数据库
- **输入归一化**：SettingsDialog + 三个翻译 Provider 的 `trim()`
- **侧边栏单词显示**：长单词优先完整展示
- **搜索稳定性与收口（补记）**：`SearchStore` 统一搜索会话；稳定选择器消除 `getSnapshot` 无限循环（修复点击搜索即白屏）；分区 ErrorBoundary；检测模式快捷键守卫 / 计时器生命周期 / 待同步结果快照化（见 [modules.md §3.27](./modules.md#327-搜索面板稳定性与搜索会话收口--v22-补记)）
- **v2.1 文档勘误**：14 项（见 [modules.md](./modules.md#326-v21-文档勘误补记)）

### v2.1（已完成）— 架构优化
TTSService 单例 / ttsSettingStore 拆分 / outputStore subscribe 解耦 / TranslationService 回调解耦 / quizEngine 提取 / Kokoro GPU TTS 引擎（Electron 集成待修复）

### v2.0（已完成）
远程词书导入（GitHub/Gitee）/ 侧边栏搜索 / 词书 UI-IX 改进 / TTS 语音朗读（WebSpeech）

### v1.4（已完成）
IPC Handler 模块化 / ConfigProvider / workspaceConfigStore / 单元格收藏 / 词书操作增强 / 日志模块重构
