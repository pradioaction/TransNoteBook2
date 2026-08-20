import { useState } from 'react'
import { useNotebookStore } from '@/store/notebookStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useTheme } from '@/hooks/useTheme'
import { useFileService } from '@/hooks/useFileService'
import { useCellService } from '@/hooks/useCellService'
import { useTranslationService } from '@/hooks/useTranslationService'
import { useRecitationService } from '@/hooks/useRecitationService'
import { useRecitationStore } from '@/store/recitationStore'
import { useReadingTimerStore } from '@/store/readingTimerStore'
import { ImportDialog } from '@/components/import/ImportDialog'
import type { QuizQuestion } from '@/recitation/quizTypes'
import type { WordSidebarData } from '@/recitation/wordSidebarTypes'
import { IconDot } from '@/components/icons'
import { ReadingTimer } from '@/components/reading/ReadingTimer'
import { useTranslation } from 'react-i18next'
import { extractClozeSentences } from '@/utils/articleUtils'

export function NotebookToolbar() {
  const { t } = useTranslation()
  const store = useNotebookStore()
  const { selectedIndices } = store
  const notebookPath = useNotebookStore((s) => s.notebook?.path ?? null)
  const notebookName = useNotebookStore((s) => s.notebook?.name ?? null)
  const isModified = useNotebookStore((s) => s.notebook?.isModified ?? false)
  const wordMeta = useNotebookStore((s) => s.notebook?.wordMeta ?? null)
  const workspacePath = useWorkspaceStore((s) => s.workspacePath)
  const { colors } = useTheme()
  const fileService = useFileService()
  const cellService = useCellService()
  const { translateAll, cancel, status } = useTranslationService()
  const recitationService = useRecitationService()
  const [importOpen, setImportOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const hasSavedQuizProgress = useRecitationStore((s) => s.hasSavedQuizProgress)
  const restoreQuizProgress = useRecitationStore((s) => s.restoreQuizProgress)
  const clearSavedQuizProgress = useRecitationStore((s) => s.clearSavedQuizProgress)

  const hasSelection = selectedIndices.size > 0

  const handleNew = () => {
    store.openFile({ path: null, name: `untitled-${Date.now()}.transnb`, isModified: false, cells: [] })
  }

  // 从文章 wordMeta 发起单词检测
  const handleStartArticleQuiz = async () => {
    // 检查是否有暂存的检测进度
    if (hasSavedQuizProgress('article')) {
      const resume = window.confirm(t('toolbar.resumeQuizConfirm'))
      if (resume) {
        restoreQuizProgress('article')
        return
      } else {
        clearSavedQuizProgress('article')
      }
    }

    if (!wordMeta || wordMeta.newWords.length + wordMeta.reviewWords.length === 0) {
      alert('当前文章没有关联的单词数据，请先生成文章。')
      return
    }

    if (!workspacePath) {
      alert('请先打开一个工作区。')
      return
    }

    setTesting(true)
    try {
      // 先在阅读模式下初始化背诵数据库（RecitationShell 未挂载，不会自动 init）
      await recitationService.init(workspacePath)

      // 获取今天已检测的单词 ID
      let todayTestedNewIds: number[] = []
      let todayTestedReviewIds: number[] = []
      try {
        const todayResult = await recitationService.getTodayWords(wordMeta.bookId)
        todayTestedNewIds = todayResult.testedNewWordIds || []
        todayTestedReviewIds = todayResult.testedReviewWordIds || []
      } catch {
        // 忽略 - 默认全部未检测
      }

      // 获取该词书的所有单词
      const allWords = await recitationService.getWordsByBook(wordMeta.bookId)

      // 从 wordMeta 中提取所有单词 ID
      const metaWordIds = new Set([
        ...wordMeta.newWords.map((w) => w.id),
        ...wordMeta.reviewWords.map((w) => w.id),
      ])

      // 匹配到完整单词数据（含定义）
      const selectedWords = allWords
        .filter((w) => w.id !== undefined && metaWordIds.has(w.id!))
        .map((w) => ({
          id: w.id!,
          word: w.word,
          definition: w.definition,
          phonetic: w.phonetic,
          example: w.example,
        }))

      if (selectedWords.length < 4) {
        alert('文章关联的单词不足 4 个，无法生成检测题目。')
        setTesting(false)
        return
      }

      // 构建正向/反向映射，用于填充 pairText
      const defToWord = new Map(selectedWords.map((w) => [w.definition, w.word]))
      const wordToDef = new Map(selectedWords.map((w) => [w.word, w.definition]))
      // 构建单词→完整数据映射，用于选项翻转卡片展示
      const wordDataMap = new Map<string, { phonetic?: string; definition?: string; example?: string }>(
        selectedWords.map((w: any) => [w.word, w])
      )

      // === 兜底：旧文章无 sentences 时，从当前文章内容实时提取 ===
      // wordMeta.sentences 是生成文章时的快照；旧 .transnb 没有该字段，
      // 检测时直接从 cells 文章文本提取，保证旧文件也能出完形填空（仅内存使用，不写回文件）
      const allMetaWords = [...wordMeta.newWords, ...wordMeta.reviewWords]
      const missingSentenceWords = allMetaWords.filter((w) => (w.sentences || []).length === 0)
      if (missingSentenceWords.length > 0) {
        const paragraphs = (useNotebookStore.getState().notebook?.cells ?? []).map((c) => c.content)
        if (paragraphs.length > 0) {
          const extracted = extractClozeSentences(paragraphs, missingSentenceWords)
          for (const w of missingSentenceWords) {
            const s = extracted[w.id]
            if (s && s.length) w.sentences = s
          }
        }
      }

      // 有句子的单词（将生成完形填空，释义题只保留 1 道，避免一个单词测 3 次）
      const clozeWordIds = new Set<number>()
      for (const w of allMetaWords) {
        if ((w.sentences || []).length > 0) clozeWordIds.add(w.id)
      }

      // 生成题目（每个单词：有句子 → 1 道释义题 + 1 道完形填空；无句子 → 2 道释义题）
      const questions: QuizQuestion[] = selectedWords.flatMap((w) => {
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

        while (wordDistractors.length < 3) wordDistractors.push('(备选单词)')
        while (defDistractors.length < 3) defDistractors.push('(备选释义)')

        const defOptions = [...defDistractors, w.definition].sort(() => Math.random() - 0.5)
        const defCorrect = String.fromCharCode(65 + defOptions.indexOf(w.definition))

        const wordOptions = [...wordDistractors, w.word].sort(() => Math.random() - 0.5)
        const wordCorrect = String.fromCharCode(65 + wordOptions.indexOf(w.word))

        const pair: QuizQuestion[] = [
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
              }
            }),
            phonetic: w.phonetic,
            definition: w.definition,
            example: w.example,
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
              }
            }),
            phonetic: w.phonetic,
            definition: w.definition,
            example: w.example,
          },
        ]
        // 有句子的单词只保留 1 道释义题（完形填空另行生成），避免重复测 3 次
        return clozeWordIds.has(w.id) ? [pair[Math.random() < 0.5 ? 0 : 1]] : pair
      })

      // 生成完形填空（cloze）题目（新词 + 复习词各 1 道，基于文章提取的句子）
      for (const w of [...wordMeta.newWords, ...wordMeta.reviewWords]) {
        const sentences = w.sentences || []
        if (sentences.length === 0) continue

        // 优先选择 ≤80 字符的短句，没有则取第一条
        const clozeSentence = sentences.sort((a, b) => a.length - b.length).find((s) => s.length <= 80) ?? sentences[0]

        // 3 个干扰项从 selectedWords 中随机抽取其他单词
        const clozeDistractors = selectedWords
          .filter((d: { id: number; word: string }) => d.id !== w.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((d: { word: string }) => d.word)
        while (clozeDistractors.length < 3) clozeDistractors.push('(备选单词)')

        const clozeOptions = [...clozeDistractors, w.word].sort(() => Math.random() - 0.5)
        const clozeCorrect = String.fromCharCode(65 + clozeOptions.indexOf(w.word))

        // wordMeta 元素无完整单词数据，从 selectedWords 中取
        const sourceWord = selectedWords.find(
          (sw: { id: number; word: string; definition?: string; phonetic?: string; example?: string }) => sw.id === w.id
        )

        questions.push({
          id: w.id * 2 + 100000,
          type: 'cloze' as const,
          wordId: w.id,
          word: w.word,
          clozeSentence,
          correctAnswer: clozeCorrect,
          options: clozeOptions.map((text, i) => {
            const wordData = wordDataMap.get(text)
            return {
              id: (['A', 'B', 'C', 'D'] as const)[i],
              text,
              pairText: wordData?.definition ?? wordToDef.get(text) ?? text,
              word: text,
              phonetic: wordData?.phonetic,
              definition: wordData?.definition,
              example: wordData?.example,
            }
          }),
          phonetic: sourceWord?.phonetic,
          definition: sourceWord?.definition,
          example: sourceWord?.example,
        })
      }

      // 打乱题目顺序，避免同一单词的两道题连续出现
      const shuffled = questions.sort(() => Math.random() - 0.5)

      // 停止阅读计时器（必须在布局切换前执行）
      useReadingTimerStore.getState().stopTimer(' (quiz started)')

      // 设置背诵 store：激活 + 标记为文章来源 + 选中词书 + 开始检测
      const recStore = useRecitationStore.getState()
      recStore.selectBook(wordMeta.bookId, wordMeta.bookName)
      recStore.activate()
      recStore.startQuiz(shuffled)
      // 标记为文章来源（review 面板据此返回阅读而非词书管理）
      useRecitationStore.setState({ articleQuizSource: true })
      // 填充右侧侧边栏数据，让 WordSidebar 显示文章中的单词
      const testedNewSet = new Set(todayTestedNewIds)
      const testedReviewSet = new Set(todayTestedReviewIds)
      const sidebarData: WordSidebarData = {
        newWords: wordMeta.newWords.map((w) => ({
          id: w.id,
          word: w.word,
          definition: selectedWords.find((sw) => sw.id === w.id)?.definition ?? '',
          isSelected: !testedNewSet.has(w.id), // 未检测默认勾选
        })),
        reviewWordBatches: wordMeta.reviewWords.map((w) => ({
          stage: 0,
          color: 'green' as const,
          words: [{
            id: w.id,
            word: w.word,
            definition: selectedWords.find((sw) => sw.id === w.id)?.definition ?? '',
            isSelected: !testedReviewSet.has(w.id),
          }],
        })),
        studiedCount: 0,
        pendingReviewCount: 0,
      }
      useRecitationStore.getState().setSidebarData(sidebarData)
    } catch (err) {
      console.error('[NotebookToolbar] 启动文章检测失败:', err)
      alert('启动检测失败，请检查工作区是否已初始化背诵数据库。')
    } finally {
      setTesting(false)
    }
  }

  const btn: React.CSSProperties = {
    padding: '4px 10px', fontSize: 12,
    border: `1px solid ${colors.border}`, borderRadius: 3,
    backgroundColor: colors.toolbarBackground, color: colors.foreground,
    cursor: 'pointer', height: 26,
  }

  return (
    <>
      <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', backgroundColor: colors.sidebarBackground, borderBottom: `1px solid ${colors.border}`, flexShrink: 0, userSelect: 'none' }}>
        <button style={btn} onClick={handleNew}>{t('toolbar.new')}</button>
        <button style={btn} onClick={() => fileService.openFile()}>{t('toolbar.open')}</button>
        <button style={btn} onClick={() => fileService.saveFile()}>{t('toolbar.save')}</button>
        <button style={{ ...btn, padding: '4px 8px' }} onClick={() => fileService.saveFileAs()}>{t('toolbar.saveAs')}</button>
        <button style={{ ...btn, padding: '4px 8px' }} onClick={() => setImportOpen(true)}>{t('toolbar.import')}</button>
        <div style={{ width: 1, height: 20, backgroundColor: colors.border, margin: '0 4px' }} />
        <button style={btn} onClick={() => translateAll()} disabled={status.state === 'translating'}>
          {status.state === 'translating' ? t('toolbar.translating', { progress: status.progress }) : t('toolbar.translateAll')}
        </button>
        {status.state === 'translating' && (
          <button style={{ ...btn, color: '#e06c75' }} onClick={() => cancel()}>{t('toolbar.cancel')}</button>
        )}
        {hasSelection && (
          <button style={{ ...btn, color: '#e06c75' }} onClick={() => cellService.deleteSelected()}>{t('toolbar.delete')}</button>
        )}
        <div style={{ width: 1, height: 20, backgroundColor: colors.border, margin: '0 4px' }} />
        <button
          style={{ ...btn, color: colors.primaryButton }}
          onClick={handleStartArticleQuiz}
          disabled={testing || !wordMeta}
        >
          {testing ? t('toolbar.testing') : t('toolbar.test')}
        </button>
        <div style={{ flex: 1 }} />
        <ReadingTimer />
        <span style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' }}>
          {notebookName || t('toolbar.noFile')}{isModified ? <> <IconDot size={10} /></> : ''}
        </span>
      </div>
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(result) => {
          setImportOpen(false)
          fileService.saveImportAsTransnb(result)
        }}
      />
    </>
  )
}
