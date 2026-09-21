# TSBook2 API — 工具函数与调用示例 (v2.2)

> v2.2 变更：`articleUtils` 新增导出函数 `extractClozeSentences()`；`processArticleText()` 返回值中的 `wordMeta` 增加逐词 `sentences`；`fileUtils` 的 `splitTextIntoParagraphs()` 新增 `SplitMode` 参数（v2.1 文档未记录）。

## 3. 工具层 — [utils/fileUtils.ts](../../../src/utils/fileUtils.ts)

```typescript
export function parseNotebookFile(content: string): NotebookData
export function serializeNotebookFile(cells: NotebookCell[], wordMeta?: ArticleWordMeta): string
export type SplitMode = 'singleNewline' | 'doubleNewline'
export function splitTextIntoParagraphs(text: string, mode: SplitMode = 'doubleNewline'): string[]
```

| 函数 | v2.2 状态 |
|---|---|
| `parseNotebookFile` | 兼容 v1.0/v2.0；逐字段兜底（缺失字段补默认值，`id` 缺失时 `crypto.randomUUID()`）；**同时解析 `wordMeta`**；无效 JSON 返回 `{ version: '2.0', cells: [] }` |
| `serializeNotebookFile` | 固定写 `version: '2.0'`；**第二参数 `wordMeta` 存在时才写入 `wordMeta` 字段**；缩进 2 空格 |
| `splitTextIntoParagraphs` | `doubleNewline`（默认）按 `\n\n+` 切分；`singleNewline` 按 `\n+` 切分；统一 `\r\n → \n`，过滤空段落 |

> **勘误**：v2.1 文档将 `splitTextIntoParagraphs(text)` 记为单参数，实际支持 `SplitMode`；`serializeNotebookFile` 实际支持第二参数 `wordMeta`。

## 4. 文章工具 — [utils/articleUtils.ts](../../../src/utils/articleUtils.ts)

```typescript
export interface ProcessedArticle {
  title: string
  markedParagraphs: string[]
  wordMeta: ArticleWordMeta
}

export function processArticleText(
  article: string,
  newWords: { id: number; word: string }[],
  reviewWords: { id: number; word: string }[],
  bookId: number,
  bookName: string,
  splitMode: SplitMode = 'singleNewline',
): ProcessedArticle

// v2.2 新增
export function extractClozeSentences(
  paragraphs: string[],
  words: { id: number; word: string }[],
): Record<number, string[]>       // 单词 id → 句子列表（每词最多 3 条）
```

### 4.1 processArticleText 处理流程

1. 用 `generateWordForms()` 为每个新词/复习词生成常见形态（复数、`-ing`、`-ed`、`-er`、`-est`、`-ly` 等）→ 形态到 `{ original, type }` 的映射
2. 按形态长度降序拼成大正则，一次性替换：新词 → `**word**`，复习词 → `<u>word</u>`（保留原文大小写）
3. 按 `splitMode` 拆分段落
4. 提取标题（首段首句，去掉标注标记，回退取前 80 字）
5. **v2.2**：调用 `extractClozeSentences()` 为每个词提取所在句子，写入 `wordMeta.newWords[i].sentences` / `wordMeta.reviewWords[i].sentences`

### 4.2 extractClozeSentences — v2.2 新增

```typescript
export function extractClozeSentences(
  paragraphs: string[],
  words: { id: number; word: string }[],
): Record<number, string[]>
```

规则：

1. 对每个单词生成形态集合（小写），用于识别句子中该词的标记
2. 按句边界 `[^.!?]+[.!?]?` 切分段落
3. 在句子中查找 `**word**`（新词）或 `<u>word</u>`（复习词）标记，标记内文本命中形态集合即为该词自身的标记
4. 将该词标记整体替换为占位符 `____`
5. 清理其他标记：`**...**` 去星号保留文字，`<u>` / `</u>` 标签去除
6. 去重；每个单词最多收集 **3 条**句子

**示例**

```typescript
const paragraphs = ['The **quick** fox <u>jumps</u> over the lazy dog. It ran fast.']
extractClozeSentences(paragraphs, [{ id: 1, word: 'quick' }])
// → { 1: ['The ____ fox jumps over the lazy dog.'] }
```

### 4.3 回调链路（v2.2）

```
BookManagerPanel「生成文章」
  → recitationService / translationService.generateSceneText(words)
  → processArticleText(article, newWords, reviewWords, bookId, bookName)
        ├── markedParagraphs → 新建 .transnb 的 cells[].content
        └── wordMeta（含 sentences）→ NotebookFile.wordMeta → 随文件持久化
                 ↓
NotebookToolbar「检测文章」
  ├── 有 sentences 的词 → 1 道释义题 + 1 道 cloze
  └── 无 sentences 的词（旧文件）→ 现场 extractClozeSentences() 兜底（不写回文件）
```

## 5. 调用示例

### 5.1 打开 .transnb 文件

```typescript
const api = window.electronAPI
if (!api) return

const filePath = await api.openFileDialog()
if (!filePath) return

const content = await api.readFile(filePath)
const data = parseNotebookFile(content)      // → { version, cells, wordMeta? }
const fileName = filePath.split(/[/\\]/).pop() || 'untitled.transnb'

useNotebookStore.getState().openFile({
  path: filePath,
  name: fileName,
  isModified: false,
  cells: data.cells,
  wordMeta: data.wordMeta,
})
useSettingStore.getState().addRecentFile(filePath)   // 最近文件在 SettingStore（不是 WorkspaceStore）
```

### 5.2 保存文件（含 wordMeta）

```typescript
const nb = useNotebookStore.getState().notebook
if (!nb?.path) return
const json = serializeNotebookFile(nb.cells, nb.wordMeta)
await window.electronAPI?.writeFile(nb.path, json)
useNotebookStore.getState().setModified(false)
```

### 5.3 JSONL 词书导入（v2.2）

```typescript
// 主进程：electron/recitation/bookImporter.ts
//   1) 先按整体 JSON.parse 解析
//   2) 失败则按 JSON Lines 逐行 JSON.parse，跳过空行与损坏行（console.warn）
// 远程扫描：gitHubBookFetcher 同时匹配 .json 与 .jsonl

const path = await window.electronAPI?.openBookDialog()   // 过滤器：json + jsonl
if (path) await useRecitationService().importBook(path)
```

> 批量导入远程词书时书名规则（[ImportBookDialog.tsx](../../../src/components/recitation/ImportBookDialog.tsx)）：
> `bookName = file.dir ? \`${baseName} (${file.dir})\` : baseName`，用于区分不同目录下的同名文件（如 `full/雅思.jsonl` 与 `simple/雅思.jsonl`）。
