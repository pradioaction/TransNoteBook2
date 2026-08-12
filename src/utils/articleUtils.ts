import type { ArticleWordMeta } from '@/types/notebook'
import { splitTextIntoParagraphs } from './fileUtils'
import type { SplitMode } from './fileUtils'

/**
 * 生成单词的常见形态变化形式，用于文章中匹配
 */
function generateWordForms(word: string): string[] {
  const forms = new Set<string>()
  const lower = word.toLowerCase()

  // 原始形式
  forms.add(word)
  forms.add(lower)

  // 复数 / 第三人称单数
  if (/[sxz]$|sh$|ch$|o$/.test(lower)) forms.add(lower + 'es')
  else forms.add(lower + 's')

  // -ing 形式
  if (lower.endsWith('ie')) forms.add(lower.slice(0, -2) + 'ying')       // lie → lying
  else if (lower.endsWith('e')) forms.add(lower.slice(0, -1) + 'ing')    // make → making
  else forms.add(lower + 'ing')
  if (lower.length <= 3) forms.add(lower + lower[lower.length - 1] + 'ing') // run → running

  // -ed 过去式
  if (lower.endsWith('e')) forms.add(lower + 'd')                        // use → used
  else if (lower.endsWith('y') && !'aeiou'.includes(lower[lower.length - 2]))
    forms.add(lower.slice(0, -1) + 'ied')                                // study → studied
  else forms.add(lower + 'ed')
  if (lower.length <= 3) forms.add(lower + lower[lower.length - 1] + 'ed') // stop → stopped

  // -er 比较级
  if (lower.endsWith('e')) forms.add(lower + 'r')
  else {
    forms.add(lower + 'er')
    if (lower.length <= 3) forms.add(lower + lower[lower.length - 1] + 'er')
  }

  // -est 最高级
  if (lower.endsWith('e')) forms.add(lower + 'st')
  else {
    forms.add(lower + 'est')
    if (lower.length <= 3) forms.add(lower + lower[lower.length - 1] + 'est')
  }

  // -ly 副词
  if (lower.endsWith('y')) forms.add(lower.slice(0, -1) + 'ily')
  else forms.add(lower + 'ly')

  return [...forms]
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface ProcessedArticle {
  title: string
  markedParagraphs: string[]
  wordMeta: ArticleWordMeta
}

/**
 * 对文章进行单词标注、标题提取
 * @param article        AI 返回的原始文章文本
 * @param newWords        新学单词列表
 * @param reviewWords     复习单词列表
 * @param bookId          词书 ID
 * @param bookName        词书名称
 * @param splitMode       段落拆分方式（默认单换行）
 */
export function processArticleText(
  article: string,
  newWords: { id: number; word: string }[],
  reviewWords: { id: number; word: string }[],
  bookId: number,
  bookName: string,
  splitMode: SplitMode = 'singleNewline',
): ProcessedArticle {
  // 1. 构建所有单词形式 → 标记类型 的映射
  const formEntryMap = new Map<string, { original: string; type: 'new' | 'review' }>()

  for (const w of newWords) {
    for (const form of generateWordForms(w.word)) {
      const key = form.toLowerCase()
      if (!formEntryMap.has(key)) {
        formEntryMap.set(key, { original: w.word, type: 'new' })
      }
    }
  }
  for (const w of reviewWords) {
    for (const form of generateWordForms(w.word)) {
      const key = form.toLowerCase()
      if (!formEntryMap.has(key)) {
        formEntryMap.set(key, { original: w.word, type: 'review' })
      }
    }
  }

  // 2. 按长度降序排列（长词优先匹配）
  const sortedForms = [...formEntryMap.entries()].sort((a, b) => b[0].length - a[0].length)

  // 3. 构建一个大的正则表达式，一次性替换
  const pattern = sortedForms.map(([form]) => escapeRegex(form)).join('|')
  const wordRegex = new RegExp(`\\b(${pattern})\\b`, 'gi')

  // 4. 对文章进行标注替换（先替换再拆分段落）
  const markedArticle = article.replace(wordRegex, (match) => {
    const lower = match.toLowerCase()
    const entry = formEntryMap.get(lower)
    if (!entry) return match
    // 保留原文的大小写风格（使用 original 的大小写作为标记）
    return entry.type === 'new' ? `**${match}**` : `<u>${match}</u>`
  })

  // 5. 按段落拆分
  const rawParagraphs = splitTextIntoParagraphs(markedArticle, splitMode)

  // 6. 提取标题（第一个段落的第一句话）
  const title = extractTitle(rawParagraphs)

  // 7. 提取每个单词（新词 + 复习词）的完形填空句子
  const clozeSentences = extractClozeSentences(rawParagraphs, [...newWords, ...reviewWords])
  const newWordsWithSentences = newWords.map((w) => ({
    id: w.id,
    word: w.word,
    sentences: clozeSentences[w.id] || [],
  }))
  const reviewWordsWithSentences = reviewWords.map((w) => ({
    id: w.id,
    word: w.word,
    sentences: clozeSentences[w.id] || [],
  }))

  return {
    title,
    markedParagraphs: rawParagraphs,
    wordMeta: { bookId, bookName, newWords: newWordsWithSentences, reviewWords: reviewWordsWithSentences },
  }
}

/**
 * 从段落列表中提取标题
 * - 取第一个段落
 * - 去掉标注标记
 * - 取第一句话（句号/问号/感叹号/换行前）
 */
function extractTitle(paragraphs: string[]): string {
  if (paragraphs.length === 0) return 'Untitled'
  const firstPara = paragraphs[0]
  // 去掉标注标记
  const clean = firstPara.replace(/<\/?u>|\*\*/g, '').trim()
  // 取第一句话
  const match = clean.match(/^[^。！？.!?\n]+/)
  if (match) return match[0].trim()
  // 回退：取前 80 个字
  return clean.slice(0, 80).trim() || 'Untitled'
}

/**
 * 从文章中提取每个单词（新词 + 复习词）所在的句子，供完形填空使用
 * - 按句边界（. ? !）切分段落为句子
 * - 找到包含该单词标记（`**word**` 新词 / `<u>word</u>` 复习词，大小写不敏感）的句子
 * - 将该词自身的标记（可能被 AI 的 `**` 嵌套包裹）替换为占位符 `____`
 * - 清除其他标注标记：`**...**` 去星号保留文字，`<u>` / `</u>` 标签去掉
 * - 结果去重，每个单词最多收集 3 条
 * @param paragraphs  已标注的段落列表
 * @param words       新词 + 复习词列表
 * @returns 单词 id → 句子列表
 */
export function extractClozeSentences(
  paragraphs: string[],
  words: { id: number; word: string }[],
): Record<number, string[]> {
  // 单词 id → 词形集合（小写），用于识别句子中该单词对应的标记
  const formMap = new Map<number, Set<string>>()
  for (const w of words) {
    const forms = new Set(generateWordForms(w.word).map((f) => f.toLowerCase()))
    formMap.set(w.id, forms)
  }

  const result: Record<number, string[]> = {}

  for (const w of words) {
    const forms = formMap.get(w.id)!
    const sentences: string[] = []

    for (const para of paragraphs) {
      // 按句边界切分
      const parts = para.match(/[^.!?]+[.!?]?/g) || []
      for (const rawSentence of parts) {
        if (sentences.length >= 3) break
        // 查找该单词的标记（**word** 或 <u>word</u>，标记内是原文词形，可能与原型不同）
        const starMarkers = rawSentence.match(/\*\*([^*]+)\*\*/gi) || []
        const uMarkers = rawSentence.match(/<u>([^<]+)<\/u>/gi) || []
        const ownMarker = [...starMarkers, ...uMarkers].find((m) => {
          const content = m.replace(/\*\*/g, '').replace(/<\/?u>/g, '').toLowerCase()
          return forms.has(content)
        })
        if (!ownMarker) continue

        // 该词标记整体替换为占位符 ____（若被 AI 的 ** 外层包裹，后续统一清理）
        let sentence = rawSentence.split(ownMarker).join('____')
        // 其他 **...** 标记去掉星号保留文字
        sentence = sentence.replace(/\*\*([^*]+)\*\*/g, '$1')
        // 去掉 <u> 与 </u> 标签
        sentence = sentence.replace(/<\/?u>/g, '')
        sentence = sentence.trim()

        // 去重
        if (sentence && !sentences.includes(sentence)) {
          sentences.push(sentence)
        }
      }
      if (sentences.length >= 3) break
    }

    result[w.id] = sentences
  }

  return result
}
