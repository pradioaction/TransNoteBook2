import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useRecitationStore } from '@/store/recitationStore'
import { useRecitationService } from '@/hooks/useRecitationService'
import { useTranslationService } from '@/hooks/useTranslationService'
import { useNotebookStore } from '@/store/notebookStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useOutputStore } from '@/store/outputStore'
import { BookCard } from './BookCard'
import { WordManagerDialog } from './WordManagerDialog'
import { processArticleText } from '@/utils/articleUtils'
import { serializeNotebookFile } from '@/utils/fileUtils'
import type { BookWithProgress } from '@/recitation/types'
import type { WordSidebarData, ReviewWordBatch, WordDisplay } from '@/recitation/wordSidebarTypes'
import type { NotebookCell } from '@/types/notebook'

const DAILY_NEW_LIMIT = 20
const DAILY_REVIEW_LIMIT = 50

function computeReviewBatches(
  reviewWords: { id: number; word: string; definition: string; phonetic?: string; stage: number }[]
): ReviewWordBatch[] {
  // 按 stage 分组
  const grouped = new Map<number, typeof reviewWords>()
  for (const w of reviewWords) {
    const list = grouped.get(w.stage) || []
    list.push(w)
    grouped.set(w.stage, list)
  }

  const batchColors = ['green', 'blue', 'orange', 'purple', 'red'] as const

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([stage, words], idx) => ({
      stage,
      color: batchColors[Math.min(idx, batchColors.length - 1)],
      words: words.map((w) => ({
        id: w.id,
        word: w.word,
        definition: w.definition,
        phonetic: w.phonetic,
        stage: w.stage,
        isSelected: true, // 默认全选
      })),
    }))
}

export function BookManagerPanel() {
  const { colors } = useTheme()
  const recitationService = useRecitationService()
  const translationService = useTranslationService()
  const selectedBookId = useRecitationStore((s) => s.selectedBookId)
  const selectedBookName = useRecitationStore((s) => s.selectedBookName)
  const selectBook = useRecitationStore((s) => s.selectBook)
  const setSidebarData = useRecitationStore((s) => s.setSidebarData)
  const startQuiz = useRecitationStore((s) => s.startQuiz)
  const setPhase = useRecitationStore((s) => s.setPhase)

  const [books, setBooks] = useState<BookWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [dailyNew, setDailyNew] = useState(20)
  const [dailyReview, setDailyReview] = useState(50)
  const [dialogBookId, setDialogBookId] = useState<number | null>(null)
  const [dialogBookName, setDialogBookName] = useState('')

  // 加载词书列表 + studywordmode.json 配置
  const loadBooks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, config] = await Promise.all([
        recitationService.getAllBooksWithProgress(),
        recitationService.getConfig(),
      ])
      setBooks(list)

      if (typeof config.daily_new_words === 'number') setDailyNew(config.daily_new_words)
      if (typeof config.daily_review_words === 'number') setDailyReview(config.daily_review_words)
    } catch {
      setError('加载词书失败')
    } finally {
      setLoading(false)
    }
  }, [recitationService])

  // 加载词书列表
  useEffect(() => {
    loadBooks()
  }, [loadBooks])

  // 自动选中第一本词书
  useEffect(() => {
    if (books.length > 0 && !selectedBookId) {
      const first = books[0]
      handleSelectBook(first.book.id!, first.book.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length > 0])

  // 当从检测回顾返回时，重新加载当前选中词书的侧边栏数据
  useEffect(() => {
    if (books.length > 0 && selectedBookId && selectedBookName) {
      handleSelectBook(selectedBookId, selectedBookName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 选择词书 → 推送数据到 WordSidebar
  const handleSelectBook = useCallback(
    async (bookId: number, bookName: string) => {
      selectBook(bookId, bookName)

      try {
        const [todayResult, progress] = await Promise.all([
          recitationService.getTodayWords(bookId),
          recitationService.getBookProgress(bookId),
        ])

        const newWords: WordDisplay[] = (todayResult.newWords || []).map((w: any) => ({
          id: w.id ?? 0,
          word: w.word ?? '',
          definition: w.definition ?? '',
          phonetic: w.phonetic ?? '',
          isSelected: true, // 默认全选
        }))

        const reviewBatches = computeReviewBatches(
          (todayResult.reviewWords || []).map((w: any) => ({
            id: w.id ?? 0,
            word: w.word ?? '',
            definition: w.definition ?? '',
            phonetic: w.phonetic ?? '',
            stage: w.stage ?? 0,
          }))
        )

        const sidebarData: WordSidebarData = {
          newWords,
          reviewWordBatches: reviewBatches,
          studiedCount: progress.studied,
          pendingReviewCount: progress.review_due,
        }

        setSidebarData(sidebarData)

        // 同步 current_book_id 到 studywordmode.json
        recitationService.setConfig('current_book_id', bookId).catch(() => {})
      } catch {
        console.error('获取单词数据失败')
      }
    },
    [recitationService, selectBook, setSidebarData]
  )

  // 开始检测
  const handleStartQuiz = useCallback(
    async (bookId: number) => {
      const state = useRecitationStore.getState()
      const sd = state.sidebarData
      if (!sd) return

      // 只使用用户在右侧侧边栏中选中的单词
      const selectedWords = [
        ...sd.newWords.filter((w) => w.isSelected),
        ...sd.reviewWordBatches.flatMap((b) => b.words.filter((w) => w.isSelected)),
      ]

      if (selectedWords.length < 4) {
        // 少于 4 个无法生成足够干扰项，提示用户
        alert('请至少选择 4 个单词进行检测（可在右侧侧边栏勾选）')
        return
      }

      // 生成题目: 每个单词 2 道题 (word→meaning + meaning→word)
      const questions = selectedWords.flatMap((w) => {
        const wordDistractors = selectedWords
          .filter((d) => d.id !== w.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((d) => d.word)
        const defDistractors = selectedWords
          .filter((d) => d.id !== w.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((d) => d.definition)

        // 补全干扰项
        while (wordDistractors.length < 3) wordDistractors.push('(备选单词)')
        while (defDistractors.length < 3) defDistractors.push('(备选释义)')

        // word→meaning: 展示单词，选项为释义
        const defOptions = [...defDistractors, w.definition].sort(() => Math.random() - 0.5)
        const defCorrect = String.fromCharCode(65 + defOptions.indexOf(w.definition))

        // meaning→word: 展示释义，选项为单词
        const wordOptions = [...wordDistractors, w.word].sort(() => Math.random() - 0.5)
        const wordCorrect = String.fromCharCode(65 + wordOptions.indexOf(w.word))

        return [
          {
            id: w.id * 2,
            type: 'word-to-meaning' as const,
            wordId: w.id,
            word: w.word,
            correctAnswer: defCorrect,
            options: defOptions.map((text, i) => ({
              id: (['A', 'B', 'C', 'D'] as const)[i],
              text,
            })),
          },
          {
            id: w.id * 2 + 1,
            type: 'meaning-to-word' as const,
            wordId: w.id,
            word: w.definition,
            correctAnswer: wordCorrect,
            options: wordOptions.map((text, i) => ({
              id: (['A', 'B', 'C', 'D'] as const)[i],
              text,
            })),
          },
        ]
      })

      // 打乱题目顺序，避免同一单词的两道题连续出现
      const shuffled = questions.flat().sort(() => Math.random() - 0.5)
      startQuiz(shuffled)
    },
    [startQuiz]
  )

  // 生成文章
  const handleGenerateArticle = useCallback(
    async (bookId: number) => {
      const addLog = useOutputStore.getState().addLog
      addLog('开始生成文章...', 'info')

      const state = useRecitationStore.getState()
      const sd = state.sidebarData
      if (!sd) {
        addLog('错误：没有单词数据', 'error')
        return
      }
      const api = window.electronAPI
      if (!api) {
        addLog('错误：electronAPI 不可用', 'error')
        return
      }

      // 读取被选中的单词（保留 id 和类型）
      let selectedNewWords = sd.newWords.filter((w) => w.isSelected).map((w) => ({ id: w.id, word: w.word }))
      let selectedReviewWords = sd.reviewWordBatches
        .flatMap((b) => b.words.filter((w) => w.isSelected))
        .map((w) => ({ id: w.id, word: w.word }))

      // 如果未选择任何单词，默认使用全部
      if (selectedNewWords.length === 0 && selectedReviewWords.length === 0) {
        selectedNewWords = sd.newWords.map((w) => ({ id: w.id, word: w.word }))
        selectedReviewWords = sd.reviewWordBatches.flatMap((b) => b.words).map((w) => ({ id: w.id, word: w.word }))
      }

      const allWordStrings = [
        ...selectedNewWords.map((w) => w.word),
        ...selectedReviewWords.map((w) => w.word),
      ]
      addLog(`已选择 ${selectedNewWords.length} 个新词 + ${selectedReviewWords.length} 个复习词`, 'info')

      setGenerating(true)
      try {
        addLog('正在请求 AI 生成文章...', 'info')
        const article = await translationService.generateSceneText(allWordStrings)
        addLog(`AI 返回文章 (${article.length} 字符)`, 'info')

        // 处理文章：标注单词、提取标题、拆分段落
        const bookName = state.selectedBookName || 'unknown'
        const { title, markedParagraphs, wordMeta } = processArticleText(
          article,
          selectedNewWords,
          selectedReviewWords,
          bookId,
          bookName,
        )
        addLog(`标题: ${title}`, 'info')
        addLog(`拆分为 ${markedParagraphs.length} 个段落`, 'info')
        addLog(`新词标记: **加粗**, 复习词标记: <u>下划线</u>`, 'info')

        // 创建 cells
        const cells: NotebookCell[] = markedParagraphs.map((content) => ({
          id: crypto.randomUUID(),
          type: 'markdown' as const,
          content,
          output: '',
          parentId: null,
          indentLevel: 0,
          isCollapsed: false,
          isInputCollapsed: false,
          isOutputCollapsed: false,
        }))

        // 文件名：词书名-文章标题
        const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 30)
        const safeBookName = bookName.replace(/[\\/:*?"<>|]/g, '_')
        const fileName = `${safeBookName}-${safeTitle}.transnb`

        // 按日期子目录保存: workspace/YYYYMMDD/文件名
        const now = new Date()
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
        const subDir = dateStr

        const ws = useWorkspaceStore.getState().workspacePath
        if (ws) {
          const savePath = ws.replace(/\\/g, '/') + '/' + subDir + '/' + fileName
          addLog(`保存到: ${savePath}`, 'info')
          await api.writeFile(savePath, serializeNotebookFile(cells, wordMeta))
          useNotebookStore.getState().openFile({ path: savePath, name: fileName, isModified: false, cells, wordMeta })
          useWorkspaceStore.getState().refreshFiles()
          addLog('文章生成完成！', 'info')
        } else {
          addLog('未设置工作区，弹出保存对话框...', 'warn')
          const savePath = await api.saveFileDialog()
          if (!savePath) {
            addLog('用户取消保存', 'warn')
            return
          }
          await api.writeFile(savePath, serializeNotebookFile(cells, wordMeta))
          const name = savePath.split(/[/\\]/).pop() || fileName
          useNotebookStore.getState().openFile({ path: savePath, name, isModified: false, cells, wordMeta })
          addLog('文章生成完成！', 'info')
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        addLog(`生成文章失败: ${msg}`, 'error')
        console.error('生成文章失败', e)
      } finally {
        setGenerating(false)
      }
    },
    [translationService]
  )

  // 删除词书
  const handleDelete = useCallback(
    async (bookId: number) => {
      try {
        await recitationService.deleteBook(bookId)
        await loadBooks()
      } catch {
        console.error('删除词书失败')
      }
    },
    [recitationService, loadBooks]
  )

  // 导入词书
  const handleImport = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    const filePath = await api.openBookDialog()
    if (!filePath) return
    try {
      await recitationService.importBook(filePath)
      await loadBooks()
    } catch {
      console.error('导入词书失败')
    }
  }, [recitationService, loadBooks])

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: colors.recitationBackground,
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          padding: '12px 16px',
          fontSize: 16,
          fontWeight: 600,
          color: colors.foreground,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        词书管理
      </div>

      {/* 工具栏 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 16px',
          borderBottom: `1px solid ${colors.border}`,
          alignItems: 'center',
        }}
      >
        <button
          onClick={handleImport}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            border: 'none',
            borderRadius: 4,
            backgroundColor: colors.primaryButton,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          导入词书
        </button>
        <button
          onClick={loadBooks}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            backgroundColor: 'transparent',
            color: colors.foreground,
            cursor: 'pointer',
          }}
        >
          刷新
        </button>
        {selectedBookId && (
          <button
            onClick={async () => {
              try {
                const [todayResult, progress] = await Promise.all([
                  recitationService.refreshTodayWords(selectedBookId),
                  recitationService.getBookProgress(selectedBookId),
                ])
                const newWords: WordDisplay[] = (todayResult.newWords || []).map((w: any) => ({
                  id: w.id ?? 0, word: w.word ?? '', definition: w.definition ?? '',
                  phonetic: w.phonetic ?? '', isSelected: true,
                }))
                const reviewBatches = computeReviewBatches(
                  (todayResult.reviewWords || []).map((w: any) => ({
                    id: w.id ?? 0, word: w.word ?? '', definition: w.definition ?? '',
                    phonetic: w.phonetic ?? '', stage: w.stage ?? 0,
                  }))
                )
                setSidebarData({ newWords, reviewWordBatches: reviewBatches, studiedCount: progress.studied, pendingReviewCount: progress.review_due })
              } catch { console.error('刷新今日单词失败') }
            }}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              border: `1px solid ${colors.border}`,
              borderRadius: 4,
              backgroundColor: 'transparent',
              color: colors.foreground,
              cursor: 'pointer',
            }}
          >
            刷新今日单词
          </button>
        )}
        {selectedBookId && (
          <button
            onClick={() => handleStartQuiz(selectedBookId)}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              border: 'none',
              borderRadius: 4,
              backgroundColor: colors.primaryButton,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            开始检测
          </button>
        )}
        {selectedBookId && (
          <button
            onClick={() => handleGenerateArticle(selectedBookId)}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              border: `1px solid ${colors.border}`,
              borderRadius: 4,
              backgroundColor: 'transparent',
              color: colors.foreground,
              cursor: 'pointer',
            }}
          >
            生成文章
          </button>
        )}
        {selectedBookId && (
          <button
            onClick={() => handleDelete(selectedBookId)}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              border: 'none',
              borderRadius: 4,
              backgroundColor: 'transparent',
              color: colors.errorText,
              cursor: 'pointer',
            }}
          >
            删除词书
          </button>
        )}
        {generating && (
          <span style={{ fontSize: 12, color: colors.foreground, opacity: 0.7 }}>
            正在生成文章...
          </span>
        )}
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: colors.foreground, display: 'flex', alignItems: 'center', gap: 4 }}>
          每日新学:
          <input
            type="number"
            min={5}
            max={100}
            value={dailyNew}
            onChange={(e) => {
              const v = Math.max(5, Math.min(100, Number(e.target.value) || 20))
              setDailyNew(v)
              recitationService.setConfig('daily_new_words', v).catch(() => {})
            }}
            style={{
              width: 46,
              padding: '2px 4px',
              fontSize: 12,
              backgroundColor: colors.inputBackground,
              color: colors.foreground,
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: 3,
              outline: 'none',
              textAlign: 'center',
            }}
          />
        </label>
        <label style={{ fontSize: 12, color: colors.foreground, display: 'flex', alignItems: 'center', gap: 4 }}>
          复习:
          <input
            type="number"
            min={10}
            max={200}
            value={dailyReview}
            onChange={(e) => {
              const v = Math.max(10, Math.min(200, Number(e.target.value) || 50))
              setDailyReview(v)
              recitationService.setConfig('daily_review_words', v).catch(() => {})
            }}
            style={{
              width: 46,
              padding: '2px 4px',
              fontSize: 12,
              backgroundColor: colors.inputBackground,
              color: colors.foreground,
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: 3,
              outline: 'none',
              textAlign: 'center',
            }}
          />
        </label>
      </div>

      {/* 词书列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: colors.foreground, opacity: 0.5 }}>
            加载中...
          </div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: colors.errorText }}>
            {error}
          </div>
        ) : books.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: colors.foreground,
              opacity: 0.5,
              fontSize: 14,
            }}
          >
            暂无词书，请点击"导入词书"添加
          </div>
        ) : (
          books.map((b) => (
            <BookCard
              key={b.book.id}
              book={b}
              isSelected={selectedBookId === b.book.id}
              onSelect={handleSelectBook}
              onViewWords={(bookId, bookName) => { setDialogBookId(bookId); setDialogBookName(bookName) }}
            />
          ))
        )}
      </div>

      {/* 状态栏 */}
      <div
        style={{
          padding: '6px 16px',
          fontSize: 11,
          color: colors.foreground,
          opacity: 0.5,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        共 {books.length} 本词书
      </div>

      {/* WordManagerDialog 弹窗 */}
      {dialogBookId !== null && (
        <WordManagerDialog
          bookId={dialogBookId}
          bookName={dialogBookName}
          onClose={() => { setDialogBookId(null); setDialogBookName('') }}
        />
      )}
    </div>
  )
}
