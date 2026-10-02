import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import { useRecitationStore } from '@/store/recitationStore'
import { useRecitationService } from '@/hooks/useRecitationService'
import { useTranslationService } from '@/hooks/useTranslationService'
import { useNotebookStore } from '@/store/notebookStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useOutputStore } from '@/store/outputStore'
import { BookCard } from './BookCard'
import { WordManagerDialog } from './WordManagerDialog'
import { CreateBookDialog } from './CreateBookDialog'
import { ImportBookDialog } from './ImportBookDialog'
import { processArticleText } from '@/utils/articleUtils'
import { serializeNotebookFile } from '@/utils/fileUtils'
import type { BookWithProgress, StageSummary, StageFilter } from '@/recitation/types'
import type { WordSidebarData, ReviewWordBatch, WordDisplay } from '@/recitation/wordSidebarTypes'
import type { QuizQuestion } from '@/recitation/quizTypes'
import type { NotebookCell } from '@/types/notebook'
import { mergeToSixStages } from '@/recitation/types'

const DAILY_NEW_LIMIT = 20
const DAILY_REVIEW_LIMIT = 50

function computeReviewBatches(
  reviewWords: { id: number; word: string; definition: string; phonetic?: string; stage: number }[],
  testedReviewSet?: Set<number>
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
        isSelected: testedReviewSet ? !testedReviewSet.has(w.id) : true, // 未检测默认勾选
      })),
    }))
}

// 根据选中的单词生成检测题目（每个单词 2 道题：word→meaning + meaning→word），并打乱顺序
function buildQuizQuestions(selectedWords: WordDisplay[]): QuizQuestion[] {
  // 构建正向/反向映射，用于填充 pairText
  const defToWord = new Map(selectedWords.map((w) => [w.definition, w.word]))
  const wordToDef = new Map(selectedWords.map((w) => [w.word, w.definition]))
  // 构建单词→完整数据映射，用于选项翻转卡片展示
  const wordDataMap = new Map(selectedWords.map((w) => [w.word, w]))

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
        options: defOptions.map((text, i) => {
          const optWord = defToWord.get(text) ?? text
          const wordData = wordDataMap.get(optWord)
          return {
            id: (['A', 'B', 'C', 'D'] as const)[i],
            text,
            pairText: optWord,
            word: optWord,
            phonetic: wordData?.phonetic,
            definition: wordData?.definition,
            example: wordData?.example,
            stage: wordData?.stage,
          }
        }),
        phonetic: w.phonetic,
        definition: w.definition,
        example: w.example,
        stage: w.stage,
      },
      {
        id: w.id * 2 + 1,
        type: 'meaning-to-word' as const,
        wordId: w.id,
        word: w.definition,
        correctAnswer: wordCorrect,
        options: wordOptions.map((text, i) => {
          const wordData = wordDataMap.get(text)
          return {
            id: (['A', 'B', 'C', 'D'] as const)[i],
            text,
            pairText: wordToDef.get(text) ?? text,
            word: text,
            phonetic: wordData?.phonetic,
            definition: wordData?.definition,
            example: wordData?.example,
            stage: wordData?.stage,
          }
        }),
        phonetic: w.phonetic,
        definition: w.definition,
        example: w.example,
        stage: w.stage,
      },
    ]
  })

  // 打乱题目顺序，避免同一单词的两道题连续出现
  return questions.flat().sort(() => Math.random() - 0.5)
}

// 生成拼写题：每个单词 1 题（音标+释义+遮蔽例句 → 拼写英文）
function buildSpellingQuestions(selectedWords: WordDisplay[]): QuizQuestion[] {
  return selectedWords.map((w) => ({
    id: w.id,
    type: 'spelling' as const,
    wordId: w.id,
    word: w.word,
    correctAnswer: w.word,
    options: [],
    phonetic: w.phonetic,
    definition: w.definition,
    example: w.example,
    stage: w.stage,
  }))
}

export function BookManagerPanel() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const recitationService = useRecitationService()
  const translationService = useTranslationService()
  const selectedBookId = useRecitationStore((s) => s.selectedBookId)
  const selectedBookName = useRecitationStore((s) => s.selectedBookName)
  const selectBook = useRecitationStore((s) => s.selectBook)
  const setSidebarData = useRecitationStore((s) => s.setSidebarData)
  const startQuiz = useRecitationStore((s) => s.startQuiz)
  const setPhase = useRecitationStore((s) => s.setPhase)
  const setSidebarMode = useRecitationStore((s) => s.setSidebarMode)

  const [books, setBooks] = useState<BookWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  // 临时并发守卫：生成文章期间忽略后续点击（后续需正式化，见 doc/TODO.md）
  const generatingRef = useRef(false)
  const [dailyNew, setDailyNew] = useState(20)
  const [dailyReview, setDailyReview] = useState(50)
  const [dialogBookId, setDialogBookId] = useState<number | null>(null)
  const [dialogBookName, setDialogBookName] = useState('')
  const [dialogStageFilter, setDialogStageFilter] = useState<StageFilter | undefined>(undefined)
  const [stageSummaryMap, setStageSummaryMap] = useState<Record<number, StageSummary>>({})
  const [searchKeyword, setSearchKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  // 搜索过滤（客户端实时过滤，不依赖服务端）
  const filteredBooks = useMemo(() => {
    if (!searchKeyword.trim()) return books
    const kw = searchKeyword.toLowerCase()
    return books.filter(b => b.book.name.toLowerCase().includes(kw))
  }, [books, searchKeyword])

  // 搜索结果为空时显示的空状态类型
  const hasSearch = searchKeyword.trim().length > 0

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

      // 并行获取每本词书的阶段分布
      const distMap: Record<number, StageSummary> = {}
      await Promise.all(list.map(async (b) => {
        const bookId = b.book.id!
        try {
          const dist = await recitationService.getStageDistribution(bookId)
          distMap[bookId] = mergeToSixStages(dist)
        } catch {
          console.error(`获取词书 ${bookId} 阶段分布失败`)
        }
      }))
      setStageSummaryMap(distMap)

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

  // 恢复上次选中的词书（优先从 config 读 current_book_id）
  useEffect(() => {
    if (books.length > 0 && !selectedBookId) {
      const restoreSelection = async () => {
        try {
          const config = await recitationService.getConfig()
          const savedBookId = config.current_book_id
          if (savedBookId && books.some(b => b.book.id === savedBookId)) {
            const book = books.find(b => b.book.id === savedBookId)!
            handleSelectBook(book.book.id!, book.book.name)
            return
          }
        } catch {
          // ignore
        }
        // Fall back to first book
        const first = books[0]
        handleSelectBook(first.book.id!, first.book.name)
      }
      restoreSelection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length > 0])

  // 当从检测回顾返回时，重新加载当前选中词书的侧边栏数据
  useEffect(() => {
    if (selectedBookId && selectedBookName) {
      handleSelectBook(selectedBookId, selectedBookName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 构建指定词书的侧边栏数据（仅构建，不改变选中状态 / 不写入 store）
  const buildSidebarDataForBook = useCallback(
    async (bookId: number, forceRefresh = false): Promise<WordSidebarData> => {
      const [todayResult, progress] = await Promise.all([
        recitationService.getTodayWords(bookId, forceRefresh),
        recitationService.getBookProgress(bookId),
      ])

      // Build tested ID sets
      const testedNewSet = new Set(todayResult.testedNewWordIds || [])
      const testedReviewSet = new Set(todayResult.testedReviewWordIds || [])

      const newWords: WordDisplay[] = (todayResult.newWords || []).map((w: any) => ({
        id: w.id ?? 0,
        word: w.word ?? '',
        definition: w.definition ?? '',
        phonetic: w.phonetic ?? '',
        example: w.example ?? '',
        isSelected: !testedNewSet.has(w.id), // 未检测的默认勾选
      }))

      const reviewBatches = computeReviewBatches(
        (todayResult.reviewWords || []).map((w: any) => ({
          id: w.id ?? 0,
          word: w.word ?? '',
          definition: w.definition ?? '',
          phonetic: w.phonetic ?? '',
          example: w.example ?? '',
          stage: w.stage ?? 0,
        })),
        testedReviewSet  // Pass tested set
      )

      return {
        newWords,
        reviewWordBatches: reviewBatches,
        studiedCount: progress.studied,
        pendingReviewCount: progress.review_due,
        quizResults: todayResult.quizResults || {},
      }
    },
    [recitationService]
  )

  // 激活词书：切换选中 + 拉取并推送侧边栏数据（供选择与卡片内操作共用）
  const activateBook = useCallback(
    async (bookId: number, bookName: string, forceRefresh = false): Promise<WordSidebarData | null> => {
      selectBook(bookId, bookName)
      try {
        const sd = await buildSidebarDataForBook(bookId, forceRefresh)
        setSidebarData(sd)
        // 同步 current_book_id 到 studywordmode.json
        recitationService.setConfig('current_book_id', bookId).catch(() => {})
        return sd
      } catch {
        console.error('获取单词数据失败')
        return null
      }
    },
    [recitationService, selectBook, setSidebarData, buildSidebarDataForBook]
  )

  // 选择词书 → 推送数据到 WordSidebar
  const handleSelectBook = useCallback(
    async (bookId: number, bookName: string) => {
      await activateBook(bookId, bookName)
    },
    [activateBook]
  )

  // 开始检测
  const handleStartQuiz = useCallback(
    async (bookId: number, bookName: string) => {
      // 先切换到目标词书，并拿到其今日单词数据
      const sd = await activateBook(bookId, bookName)

      const state = useRecitationStore.getState()
      const slots = state.savedQuizProgress
      const currentSlotKey = `book_${bookId}`

      // 当前词书有暂存检测进度 → 询问是否继续上次的检测
      if (slots[currentSlotKey]) {
        const resume = window.confirm(t('bookManager.resumeQuizConfirm'))
        if (resume) {
          state.restoreQuizProgress(currentSlotKey)
          return
        }
        state.clearSavedQuizProgress(currentSlotKey)
      } else {
        // 其他词书有暂存 → 询问是否切换词书并继续
        const otherKey = Object.keys(slots).find(
          (k) => k.startsWith('book_') && k !== currentSlotKey && slots[k]
        )
        if (otherKey) {
          const otherSnapshot = slots[otherKey]
          const otherBookName = otherSnapshot?.selectedBookName || ''
          const switchBook = window.confirm(t('bookManager.switchBookResumeConfirm', { bookName: otherBookName }))
          if (switchBook) {
            if (otherSnapshot?.selectedBookId != null) {
              state.selectBook(otherSnapshot.selectedBookId, otherSnapshot.selectedBookName || '')
            }
            state.restoreQuizProgress(otherKey)
            return
          }
          state.clearSavedQuizProgress(otherKey)
        }
      }

      if (!sd) return

      // 使用该词书自身未检测的单词（默认勾选）
      const selectedWords = [
        ...sd.newWords.filter((w) => w.isSelected),
        ...sd.reviewWordBatches.flatMap((b) => b.words.filter((w) => w.isSelected)),
      ]

      if (selectedWords.length < 4) {
        // 少于 4 个无法生成足够干扰项，提示用户
        alert(t('bookManager.alertFewWords'))
        return
      }

      // 生成并打乱题目
      const shuffled = buildQuizQuestions(selectedWords)
      startQuiz(shuffled)
    },
    [startQuiz, t, activateBook]
  )

  // 拼写学习：范围取右侧侧边栏的勾选单词（默认全选）
  const handleStartLearning = useCallback(
    async (bookId: number, bookName: string) => {
      const state = useRecitationStore.getState()
      let sd: WordSidebarData | null
      if (state.selectedBookId === bookId && state.sidebarData) {
        // 已是当前选中书：沿用侧边栏现有的勾选状态
        sd = state.sidebarData
      } else {
        // 切换到目标词书（默认全选）
        sd = await activateBook(bookId, bookName)
      }
      if (!sd) return

      const selectedWords = [
        ...sd.newWords.filter((w) => w.isSelected),
        ...sd.reviewWordBatches.flatMap((b) => b.words.filter((w) => w.isSelected)),
      ]
      if (selectedWords.length === 0) {
        alert(t('bookManager.alertNoWords'))
        return
      }

      startQuiz(buildSpellingQuestions(selectedWords))
      // 学习阶段侧边栏显示"单词 + 释义"（review 模式无勾选框，且会显示释义）
      setSidebarMode('review')
    },
    [activateBook, startQuiz, setSidebarMode, t]
  )

  // 生成文章
  const handleGenerateArticle = useCallback(
    async (bookId: number, bookName: string) => {
      // 临时并发守卫：前一次生成未完成时，忽略后续点击（仅第一个生效）
      if (generatingRef.current) {
        console.debug('已有文章正在生成，忽略本次请求')
        return
      }
      generatingRef.current = true

      const addLog = useOutputStore.getState().addLog
      addLog('开始生成文章...', 'info')

      const sd = await activateBook(bookId, bookName)
      if (!sd) {
        addLog('错误：没有单词数据', 'error')
        generatingRef.current = false
        return
      }
      const api = window.electronAPI
      if (!api) {
        addLog('错误：electronAPI 不可用', 'error')
        generatingRef.current = false
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
        generatingRef.current = false
      }
    },
    [translationService, activateBook]
  )

  // 刷新指定词书的今日单词：切换到该书并强制刷新（forceRefresh=true）
  const handleRefreshToday = useCallback(
    async (bookId: number, bookName: string) => {
      await activateBook(bookId, bookName, true)
    },
    [activateBook]
  )

  // 删除词书
  const handleDelete = useCallback(
    async (bookId: number) => {
      if (!window.confirm(t('bookManager.confirmDelete', { bookName: selectedBookName || '' }))) return
      try {
        await recitationService.deleteBook(bookId)
        await loadBooks()
        useRecitationStore.getState().clearSavedQuizProgress(`book_${bookId}`)
      } catch {
        console.error('删除词书失败')
      }
    },
    [recitationService, loadBooks, selectedBookName, t]
  )

  // 双击进度段 → 打开 WordManagerDialog 并过滤阶段
  const handleDoubleClickSegment = useCallback(
    (bookId: number, bookName: string, stageFilter: StageFilter) => {
      setDialogBookId(bookId)
      setDialogBookName(bookName)
      setDialogStageFilter(stageFilter)
    },
    []
  )

  // 关闭对话框时清除 stageFilter
  const handleCloseDialog = useCallback(() => {
    setDialogBookId(null)
    setDialogBookName('')
    setDialogStageFilter(undefined)
  }, [])

  // 导入词书
  const handleImport = useCallback(() => {
    setImportDialogOpen(true)
  }, [])

  // 新建词书
  const handleCreate = useCallback(async (name: string, description: string) => {
    try {
      const book = await recitationService.createBook(name, description || undefined)
      if (book) {
        await loadBooks()
        // 自动选中新建的词书
        handleSelectBook(book.id!, book.name)
      }
      setCreateOpen(false)
    } catch {
      console.error('新建词书失败')
    }
  }, [recitationService, loadBooks, handleSelectBook])

  // 导出词书
  const handleExport = useCallback(async (bookId: number) => {
    try {
      await recitationService.exportBook(bookId)
    } catch {
      console.error('导出词书失败')
    }
  }, [recitationService])

  // 重命名词书
  const handleRename = useCallback(async (bookId: number, newName: string) => {
    try {
      await recitationService.renameBook(bookId, newName)
      await loadBooks()
    } catch {
      console.error('重命名词书失败')
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
        {t('bookManager.title')}
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
          {t('bookManager.import')}
        </button>
        <button
          onClick={() => setCreateOpen(true)}
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
          {t('bookManager.newBook')}
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
          {t('bookManager.refresh')}
        </button>
        {selectedBookId && (
          <button
            onClick={() => handleExport(selectedBookId)}
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
            {t('bookManager.export')}
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
            {t('bookManager.delete')}
          </button>
        )}
        {generating && (
          <span style={{ fontSize: 12, color: colors.foreground, opacity: 0.7 }}>
            {t('bookManager.generating')}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: colors.foreground, display: 'flex', alignItems: 'center', gap: 4 }}>
          {t('bookManager.dailyNew')}:
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
          {t('bookManager.review')}:
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

      {/* 搜索框 */}
      <div style={{
        padding: '4px 16px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 12, color: colors.foreground, opacity: 0.6, flexShrink: 0 }}>
          🔍
        </span>
        <input
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder={t('bookManager.searchPlaceholder')}
          style={{
            flex: 1, padding: '4px 8px', fontSize: 12,
            backgroundColor: colors.inputBackground, color: colors.foreground,
            border: `1px solid ${colors.inputBorder}`, borderRadius: 3,
            outline: 'none',
          }}
        />
        {searchKeyword && (
          <button
            onClick={() => setSearchKeyword('')}
            style={{
              background: 'none', border: 'none', color: colors.foreground,
              cursor: 'pointer', fontSize: 12, opacity: 0.5,
              padding: '2px 4px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* 词书列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: colors.foreground, opacity: 0.5 }}>
            {t('bookManager.loading')}
          </div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: colors.errorText }}>
            {error}
          </div>
        ) : hasSearch && filteredBooks.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: colors.foreground,
              opacity: 0.5,
              fontSize: 14,
            }}
          >
            {t('bookManager.noSearchResults')}
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
            {t('bookManager.noBooks')}
          </div>
        ) : (
          filteredBooks.map((b) => (
            <BookCard
              key={b.book.id}
              book={b}
              isSelected={selectedBookId === b.book.id}
              onSelect={handleSelectBook}
              onViewWords={(bookId, bookName) => { setDialogBookId(bookId); setDialogBookName(bookName); setDialogStageFilter(undefined) }}
              stageSummary={stageSummaryMap[b.book.id!]}
              onDoubleClickSegment={handleDoubleClickSegment}
              onRename={handleRename}
              onStartQuiz={handleStartQuiz}
              onStartLearning={handleStartLearning}
              onGenerateArticle={handleGenerateArticle}
              onRefreshToday={handleRefreshToday}
              isGenerating={generating}
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
        {t('bookManager.bookCount', { count: books.length })}
      </div>

      {/* WordManagerDialog 弹窗 */}
      {dialogBookId !== null && (
        <WordManagerDialog
          bookId={dialogBookId}
          bookName={dialogBookName}
          onClose={handleCloseDialog}
          stageFilter={dialogStageFilter}
        />
      )}

      {/* CreateBookDialog 弹窗 */}
      <CreateBookDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      {/* ImportBookDialog 弹窗 */}
      <ImportBookDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImportComplete={loadBooks}
      />
    </div>
  )
}
