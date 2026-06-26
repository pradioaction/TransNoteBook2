import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { ThemeConfig } from '@/types/notebook'
import { useTheme } from '@/hooks/useTheme'
import { useRecitationStore } from '@/store/recitationStore'
import { useRecitationService } from '@/hooks/useRecitationService'
import { useNotebookStore } from '@/store/notebookStore'
import { useOutputStore } from '@/store/outputStore'
import type { BookWithProgress } from '@/recitation/types'
import { IconClose } from '@/components/icons'

export function ReviewPanel() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const quizState = useRecitationStore((s) => s.quizState)
  const setPhase = useRecitationStore((s) => s.setPhase)
  const setSidebarMode = useRecitationStore((s) => s.setSidebarMode)
  const setSidebarData = useRecitationStore((s) => s.setSidebarData)
  const reset = useRecitationStore((s) => s.reset)
  const selectBook = useRecitationStore((s) => s.selectBook)
  const selectedBookId = useRecitationStore((s) => s.selectedBookId)
  const selectedBookName = useRecitationStore((s) => s.selectedBookName)
  const isArticleQuiz = useRecitationStore((s) => s.articleQuizSource)

  const [selectedWrongIds, setSelectedWrongIds] = useState<Set<number>>(new Set())
  const recitationService = useRecitationService()

  // 收藏到词书对话框状态
  const [bookPickerOpen, setBookPickerOpen] = useState(false)
  const [availableBooks, setAvailableBooks] = useState<BookWithProgress[]>([])
  const [selectedTargetBookId, setSelectedTargetBookId] = useState<number | null>(null)
  const [bookLoading, setBookLoading] = useState(false)
  const [addResult, setAddResult] = useState<string | null>(null)

  // 当前词书的完整单词数据映射（按 wordId 索引），打开对话框时懒加载
  const [cachedWordMap, setCachedWordMap] = useState<Map<number, { word: string; phonetic: string; definition: string; example: string }>>(new Map())

  // 打开收藏对话框：加载词书列表 + 当前词书完整单词
  const openBookPicker = useCallback(async () => {
    if (!selectedBookId) return
    setBookLoading(true)
    try {
      const [books, words] = await Promise.all([
        recitationService.getAllBooksWithProgress(),
        recitationService.getWordsByBook(selectedBookId),
      ])
      setAvailableBooks(books)
      // 构建 wordId -> full word data 映射
      const map = new Map<number, { word: string; phonetic: string; definition: string; example: string }>()
      for (const w of words) {
        if (w.id != null) {
          map.set(w.id, { word: w.word, phonetic: w.phonetic, definition: w.definition, example: w.example })
        }
      }
      setCachedWordMap(map)
      setSelectedTargetBookId(null)
      setAddResult(null)
      setBookPickerOpen(true)
    } catch {
      console.error('加载词书列表失败')
    } finally {
      setBookLoading(false)
    }
  }, [selectedBookId, recitationService])

  // 将检测结果保存到数据库
  const saveQuizResults = useCallback(async () => {
    if (!selectedBookId || !quizState) return
    try {
      const wordResults = new Map<number, boolean>()
      // 遍历所有问题，按 wordId 归并结果：只要有一道题答错，该单词就算错
      for (const q of quizState.questions) {
        const result = quizState.results.get(q.id)
        if (result === undefined) continue
        if (!wordResults.has(q.wordId)) {
          wordResults.set(q.wordId, result)
        } else if (!result) {
          // 如果已有结果但新结果是 false，则覆盖为 false（有一题错即错）
          wordResults.set(q.wordId, false)
        }
      }

      // 先调用 startStudyWord 确保所有单词都有学习记录
      for (const wordId of wordResults.keys()) {
        await recitationService.startStudyWord(selectedBookId, wordId)
      }

      // 再调用 reviewWord 更新每词的学习结果
      for (const [wordId, isCorrect] of wordResults) {
        await recitationService.reviewWord(selectedBookId, wordId, isCorrect)
      }

      // 标记答对的单词为"已测"，更新缓存中的 tested 数组
      const correctWordIds = [...wordResults.entries()]
        .filter(([, isCorrect]) => isCorrect)
        .map(([wordId]) => wordId)
      if (correctWordIds.length > 0) {
        const sd = useRecitationStore.getState().sidebarData
        if (sd) {
          const newWordIdSet = new Set(sd.newWords.map((w) => w.id))
          const reviewWordIdSet = new Set(sd.reviewWordBatches.flatMap((b) => b.words.map((w) => w.id)))
          const testedNewIds = correctWordIds.filter((id) => newWordIdSet.has(id))
          const testedReviewIds = correctWordIds.filter((id) => reviewWordIdSet.has(id))
          // 构建 quizResults map: wordId -> isCorrect
          const quizResults: Record<number, boolean> = {}
          for (const [wordId, isCorrect] of wordResults) {
            quizResults[wordId] = isCorrect
          }
          await recitationService.markWordsAsTested(selectedBookId, testedNewIds, testedReviewIds, quizResults)
        }
      }

      // 输出检测日志
      const total = quizState.questions.length
      const correctCount = [...quizState.results.values()].filter(Boolean).length
      const wrongCount = total - correctCount
      const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0
      const elapsed = Math.round((Date.now() - quizState.startTime) / 1000)
      const mm = Math.floor(elapsed / 60)
      const ss = elapsed % 60
      const bookName = useRecitationStore.getState().selectedBookName || '未知词书'
      useOutputStore.getState().addLog(
        `【检测完成】词书: ${bookName} | 总题数: ${total} | 正确: ${correctCount} | 错误: ${wrongCount} | 正确率: ${accuracy}% | 用时: ${mm}分${ss}秒`
      )
    } catch (err) {
      console.error('[ReviewPanel] 保存检测结果失败:', err)
    }
  }, [selectedBookId, quizState, recitationService])

  if (!quizState) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.foreground,
        }}
      >
        暂无检测数据
      </div>
    )
  }

  const total = quizState.questions.length
  // results 已改为以 question.id 为键，每个问题独立存储
  const correctCount = [...quizState.results.values()].filter(Boolean).length
  const wrongCount = total - correctCount
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0
  const elapsed = Math.round((Date.now() - quizState.startTime) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  // 获取答错的 wordId 列表（去重）
  const wrongWordIds = [
    ...new Set(
      quizState.questions
        .filter((q) => {
          const result = quizState.results.get(q.id)
          return result === false
        })
        .map((q) => q.wordId)
    ),
  ]

  // 获取每个错词的单词文本
  const wrongQuestions = quizState.questions.filter((q) => {
    const result = quizState.results.get(q.id)
    return result === false
  })
  const wrongWordSet = new Map<number, { word: string; definition: string }>()
  for (const q of wrongQuestions) {
    if (!wrongWordSet.has(q.wordId)) {
      wrongWordSet.set(q.wordId, { word: q.word, definition: '' })
    } else {
      // 如果第二道题是 meaning-to-word, definition 就是 q.word
      const existing = wrongWordSet.get(q.wordId)!
      if (q.type === 'meaning-to-word') {
        existing.definition = q.word
      }
    }
  }

  // 处理 meaning-to-word 和 word-to-meaning 配对
  for (const q of quizState.questions) {
    const entry = wrongWordSet.get(q.wordId)
    if (entry && q.type === 'word-to-meaning' && !entry.definition) {
      // 如果之前只存了 meaning-to-word 的 word，这里定义是 options 中的正确项
      const correctOption = q.options.find((o) => o.id === q.correctAnswer)
      if (correctOption) entry.definition = correctOption.text
    }
  }

  const handleToggleWrong = (wordId: number) => {
    setSelectedWrongIds((prev) => {
      const next = new Set(prev)
      if (next.has(wordId)) next.delete(wordId)
      else next.add(wordId)
      return next
    })
  }

  const handleSelectAllWrong = () => {
    setSelectedWrongIds(new Set(wrongWordIds))
  }

  const handleAddToFavorite = () => {
    openBookPicker()
  }

  // 确认将选中错词添加到目标词书
  const handleAddToBookConfirm = useCallback(async () => {
    if (!selectedBookId || !selectedTargetBookId) return
    setBookLoading(true)
    setAddResult(null)
    try {
      const wordIds = Array.from(selectedWrongIds)
      let added = 0
      let skipped = 0
      for (const wordId of wordIds) {
        const wordData = cachedWordMap.get(wordId)
        if (!wordData) { skipped++; continue }
        // 检查目标词书是否已有该单词
        const existing = await recitationService.searchWords(wordData.word, selectedTargetBookId)
        if (existing.length > 0) { skipped++; continue }
        await recitationService.addWord(selectedTargetBookId, wordData)
        added++
      }
      setAddResult(`${t('reviewPanel.addToBookResult', { added, skipped })}`)
      if (added > 0) {
        // 刷新目标词书的进度
        setAvailableBooks(prev => prev.map(b =>
          b.book.id === selectedTargetBookId
            ? { ...b, total: b.total + added }
            : b
        ))
      }
    } catch (err) {
      console.error('添加到词书失败', err)
      setAddResult(t('reviewPanel.addToBookError'))
    } finally {
      setBookLoading(false)
    }
  }, [selectedBookId, selectedTargetBookId, selectedWrongIds, cachedWordMap, recitationService, t])

  const handleBack = async () => {
    await saveQuizResults()
    if (isArticleQuiz) {
      // 文章来源：返回阅读界面
      // saveQuizResults 已通过 markWordsAsTested 更新缓存，无需再 full refresh
      useRecitationStore.setState({ articleQuizSource: false })
      reset()
      return
    }
    setSidebarMode('full')
    if (selectedBookId && selectedBookName) {
      setPhase('book-manager')
      // 清除检测期间产生的答题状态标记，让 BookManagerPanel 重新加载侧边栏数据
      setSidebarData({
        newWords: [],
        reviewWordBatches: [],
        studiedCount: 0,
        pendingReviewCount: 0,
      })
    } else {
      reset()
    }
  }

  const handleRestartQuiz = async () => {
    await saveQuizResults()
    if (isArticleQuiz) {
      // 文章来源：返回阅读界面，让用户重新点击 Test
      useRecitationStore.setState({ articleQuizSource: false })
      reset()
      return
    }
    // 非文章来源：回到词书管理界面，保留选中词书
    setSidebarMode('full')
    if (selectedBookId && selectedBookName) {
      setPhase('book-manager')
      // 清除检测期间的答题状态，让 BookManagerPanel 重新加载侧边栏数据
      setSidebarData({
        newWords: [],
        reviewWordBatches: [],
        studiedCount: 0,
        pendingReviewCount: 0,
      })
    } else {
      reset()
    }
  }

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
      {/* 标题 */}
      <div
        style={{
          padding: '12px 16px',
          fontSize: 16,
          fontWeight: 600,
          color: colors.foreground,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {t('reviewPanel.title')}
      </div>

      {/* 总结区域 */}
      <div style={{ padding: '16px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard label="用时" value={`${minutes}分${seconds}秒`} colors={colors} />
        <StatCard label="总题数" value={`${total}`} colors={colors} />
        <StatCard label="正确" value={`${correctCount}`} colors={colors} color={colors.wordCorrectBackground === '#e8f5e9' ? '#2e7d32' : '#81c784'} />
        <StatCard label="错误" value={`${wrongCount}`} colors={colors} color={colors.wordWrongBackground === '#ffebee' ? '#c62828' : '#e57373'} />
        <StatCard label="正确率" value={`${accuracy}%`} colors={colors} />
      </div>

      {/* 答错单词操作区 */}
      {wrongCount > 0 && (
        <div
          style={{
            padding: '8px 16px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <button
            onClick={handleSelectAllWrong}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: `1px solid ${colors.border}`,
              borderRadius: 4,
              backgroundColor: 'transparent',
              color: colors.foreground,
              cursor: 'pointer',
            }}
          >
            全选错词
          </button>
          <button
            onClick={handleAddToFavorite}
            disabled={selectedWrongIds.size === 0}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: 'none',
              borderRadius: 4,
              backgroundColor: selectedWrongIds.size > 0 ? colors.primaryButton : colors.border,
              color: selectedWrongIds.size > 0 ? '#fff' : colors.foreground,
              cursor: selectedWrongIds.size > 0 ? 'pointer' : 'not-allowed',
              opacity: selectedWrongIds.size > 0 ? 1 : 0.5,
            }}
          >
            加入收藏夹 ({selectedWrongIds.size})
          </button>
        </div>
      )}

      {/* 答错单词列表 */}
      {wrongCount > 0 && (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.errorText,
              marginBottom: 8,
            }}
          >
            {t('reviewPanel.wrongWords', { count: wrongWordSet.size })}
          </div>
          {[...wrongWordSet.entries()].map(([wordId, { word, definition }]) => (
            <div
              key={wordId}
              onClick={() => handleToggleWrong(wordId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 4,
                backgroundColor: selectedWrongIds.has(wordId) ? colors.cellSelectedBackground : 'transparent',
                cursor: 'pointer',
                marginBottom: 2,
                fontSize: 13,
                color: colors.foreground,
              }}
            >
              <input
                type="checkbox"
                checked={selectedWrongIds.has(wordId)}
                onChange={() => handleToggleWrong(wordId)}
                onClick={(e) => e.stopPropagation()}
                style={{ margin: 0, cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 500 }}>{word}</span>
              {definition && (
                <>
                  <span style={{ opacity: 0.4 }}>→</span>
                  <span style={{ opacity: 0.7 }}>{definition}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 底部按钮 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          padding: '12px 16px',
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <button
          onClick={handleBack}
          style={{
            padding: '8px 24px',
            fontSize: 14,
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            backgroundColor: 'transparent',
            color: colors.foreground,
            cursor: 'pointer',
          }}
        >
          {isArticleQuiz ? t('reviewPanel.backToReading') : t('reviewPanel.backToBookManager')}
        </button>
        <button
          onClick={handleRestartQuiz}
          style={{
            padding: '8px 24px',
            fontSize: 14,
            border: 'none',
            borderRadius: 4,
            backgroundColor: colors.primaryButton,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {t('reviewPanel.restartQuiz')}
        </button>
      </div>

      {/* 选择目标词书对话框 */}
      {bookPickerOpen && (
        <div
          onClick={() => { if (!bookLoading) setBookPickerOpen(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              backgroundColor: colors.editorBackground,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: 24,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: colors.foreground }}>
                {t('reviewPanel.selectTargetBook')}
              </span>
              <button
                onClick={() => setBookPickerOpen(false)}
                style={{
                  background: 'none', border: 'none', color: colors.foreground,
                  cursor: 'pointer', fontSize: 16, padding: '0 4px', display: 'inline-flex', alignItems: 'center',
                }}
              >
                <IconClose size={14} />
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, color: colors.foreground, marginBottom: 6, fontWeight: 500 }}>
                {t('reviewPanel.currentWrongWords')}: {selectedWrongIds.size}
              </label>
            </div>

            {/* 词书列表 */}
            <div style={{ maxHeight: 240, overflow: 'auto', marginBottom: 16 }}>
              {availableBooks.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: colors.foreground, opacity: 0.5, fontSize: 13 }}>
                  {t('reviewPanel.noBooks')}
                </div>
              ) : (
                availableBooks.map((b) => (
                  <div
                    key={b.book.id}
                    onClick={() => setSelectedTargetBookId(b.book.id!)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 4,
                      cursor: 'pointer', marginBottom: 2,
                      backgroundColor: selectedTargetBookId === b.book.id ? colors.cellSelectedBackground : 'transparent',
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={(e) => { if (selectedTargetBookId !== b.book.id) e.currentTarget.style.backgroundColor = colors.listItemHover }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selectedTargetBookId === b.book.id ? colors.cellSelectedBackground : 'transparent' }}
                  >
                    <input
                      type="radio"
                      checked={selectedTargetBookId === b.book.id}
                      onChange={() => setSelectedTargetBookId(b.book.id!)}
                      style={{ margin: 0, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, color: colors.foreground, fontWeight: 500 }}>
                      {b.book.name}
                    </span>
                    <span style={{ fontSize: 11, color: colors.foreground, opacity: 0.5, marginLeft: 'auto' }}>
                      {b.book.count} {t('reviewPanel.wordUnit')}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* 操作结果反馈 */}
            {addResult && (
              <div style={{
                padding: '8px 12px', marginBottom: 12, borderRadius: 4, fontSize: 13,
                backgroundColor: addResult.includes('失败') ? colors.wordWrongBackground : colors.wordCorrectBackground,
                color: addResult.includes('失败') ? colors.errorText : colors.foreground,
              }}>
                {addResult}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setBookPickerOpen(false)}
                disabled={bookLoading}
                style={{
                  padding: '6px 16px', fontSize: 13,
                  border: `1px solid ${colors.border}`, borderRadius: 4,
                  backgroundColor: 'transparent', color: colors.foreground,
                  cursor: 'pointer',
                }}
              >
                {t('reviewPanel.cancel')}
              </button>
              <button
                onClick={handleAddToBookConfirm}
                disabled={!selectedTargetBookId || bookLoading}
                style={{
                  padding: '6px 16px', fontSize: 13,
                  border: 'none', borderRadius: 4,
                  backgroundColor: colors.primaryButton, color: '#fff',
                  cursor: selectedTargetBookId ? 'pointer' : 'not-allowed',
                  opacity: selectedTargetBookId ? 1 : 0.5,
                }}
              >
                {bookLoading
                  ? t('reviewPanel.adding')
                  : t('reviewPanel.confirmAdd', { count: selectedWrongIds.size })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  colors,
}: {
  label: string
  value: string
  color?: string
  colors: ThemeConfig
}) {
  return (
    <div
      style={{
        padding: '10px 16px',
        backgroundColor: colors.quizCardBackground,
        border: `1px solid ${colors.quizCardBorder}`,
        borderRadius: 6,
        minWidth: 100,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 11, color: colors.foreground, opacity: 0.6, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || colors.foreground }}>
        {value}
      </div>
    </div>
  )
}
