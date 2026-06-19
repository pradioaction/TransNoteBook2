import { useEffect, useCallback, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ThemeConfig } from '@/types/notebook'
import { useTheme } from '@/hooks/useTheme'
import { useRecitationStore } from '@/store/recitationStore'
import { useRecitationService } from '@/hooks/useRecitationService'
import { FloatingOptions } from './FloatingOptions'
import { IconCelebrate } from '@/components/icons'

export function QuizPanel() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const recitationService = useRecitationService()
  const quizState = useRecitationStore((s) => s.quizState)
  const answerQuestion = useRecitationStore((s) => s.answerQuestion)
  const nextQuestion = useRecitationStore((s) => s.nextQuestion)
  const prevQuestion = useRecitationStore((s) => s.prevQuestion)
  const toggleFloatingAnimation = useRecitationStore((s) => s.toggleFloatingAnimation)
  const floatingAnimationEnabled = useRecitationStore((s) => s.floatingAnimationEnabled)
  const completeQuiz = useRecitationStore((s) => s.completeQuiz)
  const setPhase = useRecitationStore((s) => s.setPhase)
  const setSidebarMode = useRecitationStore((s) => s.setSidebarMode)
  const isArticleQuiz = useRecitationStore((s) => s.articleQuizSource)
  const selectedBookId = useRecitationStore((s) => s.selectedBookId)
  const pendingSyncResults = useRecitationStore((s) => s.pendingSyncResults)
  const markWordsAsSynced = useRecitationStore((s) => s.markWordsAsSynced)
  const [damping, setDamping] = useState(0.9985)
  const [impulse, setImpulse] = useState(8)
  const configLoaded = useRef(false)

  // 从 studywordmode.json 加载阻尼和冲量
  useEffect(() => {
    if (configLoaded.current) return
    configLoaded.current = true
    recitationService.getConfig().then((cfg) => {
      if (typeof cfg.quiz_damping === 'number') setDamping(cfg.quiz_damping)
      if (typeof cfg.quiz_impulse === 'number') setImpulse(cfg.quiz_impulse)
    }).catch(() => {})
  }, [recitationService])

  // 后台批量同步：将已答完的单词保存到数据库和 JSON
  const syncPendingWords = useCallback(async () => {
    const state = useRecitationStore.getState()
    const pending = state.pendingSyncResults
    const wordIds = Object.keys(pending).map(Number)
    if (wordIds.length === 0 || !selectedBookId) return

    // 根据 sidebarData 区分新学/复习单词
    const newWordIdSet = new Set(state.sidebarData?.newWords.map(w => w.id) || [])
    const newIds: number[] = []
    const reviewIds: number[] = []
    for (const id of wordIds) {
      if (newWordIdSet.has(id)) newIds.push(id)
      else reviewIds.push(id)
    }

    try {
      for (const wordId of wordIds) {
        await recitationService.startStudyWord(selectedBookId, wordId)
        await recitationService.reviewWord(selectedBookId, wordId, pending[wordId])
      }
      await recitationService.markWordsAsTested(selectedBookId, newIds, reviewIds)
      markWordsAsSynced(wordIds)
      // 保存答题结果用于侧边栏颜色标记
      state.setQuizResults(selectedBookId!, pending)
    } catch (err) {
      console.error('[QuizPanel] Batch sync failed:', err)
    }
  }, [selectedBookId, recitationService, markWordsAsSynced])

  // 监听 pending 达到 10 个时自动同步
  useEffect(() => {
    const pendingCount = Object.keys(pendingSyncResults).length
    if (pendingCount >= 10) {
      syncPendingWords()
    }
  }, [pendingSyncResults, syncPendingWords])

  // 组件卸载时同步剩余
  useEffect(() => {
    return () => {
      const state = useRecitationStore.getState()
      if (Object.keys(state.pendingSyncResults || {}).length > 0) {
        // 异步同步，不阻塞卸载
        const doSync = async () => {
          const s = useRecitationStore.getState()
          const p = s.pendingSyncResults
          const ids = Object.keys(p).map(Number)
          if (ids.length === 0 || !s.selectedBookId) return
          // 根据 sidebarData 区分新学/复习单词
          const newWordIdSet = new Set(s.sidebarData?.newWords.map(w => w.id) || [])
          const newIds: number[] = []
          const reviewIds: number[] = []
          for (const id of ids) {
            if (newWordIdSet.has(id)) newIds.push(id)
            else reviewIds.push(id)
          }
          try {
            for (const wordId of ids) {
              await recitationService.startStudyWord(s.selectedBookId, wordId)
              await recitationService.reviewWord(s.selectedBookId, wordId, p[wordId])
            }
            await recitationService.markWordsAsTested(s.selectedBookId, newIds, reviewIds, p)
            s.markWordsAsSynced(ids)
          } catch (err) {
            console.error('[QuizPanel] Cleanup sync failed:', err)
          }
        }
        doSync()
      }
    }
  }, [recitationService])

  if (!quizState || quizState.questions.length === 0) {
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
        {t('quizPanel.noQuestions')}
      </div>
    )
  }

  const question = quizState.questions[quizState.currentIndex]
  const answeredRef = useRef<string | undefined>(undefined)
  answeredRef.current = question?.answered
  const total = quizState.questions.length
  const answeredCount = quizState.questions.filter((q) => q.answered !== undefined).length
  const isComplete = quizState.isComplete

  const handleSelect = useCallback(
    (optionId: string) => {
      // 用 ref 做同步守卫，防止闭包未更新导致重复答题
      if (answeredRef.current) return
      answerQuestion(quizState.currentIndex, optionId)
    },
    [answerQuestion, quizState?.currentIndex]
  )

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const state = useRecitationStore.getState()
      if (!state.quizState) return

      if (e.key === '1') handleSelect('A')
      else if (e.key === '2') handleSelect('B')
      else if (e.key === '3') handleSelect('C')
      else if (e.key === '4') handleSelect('D')
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (state.quizState.currentIndex > 0) prevQuestion()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Enter') {
        const cur = state.quizState.questions[state.quizState.currentIndex]
        if (cur && cur.answered !== undefined && state.quizState.currentIndex < state.quizState.questions.length - 1) {
          nextQuestion()
        }
      } else if (e.key === ' ') {
        e.preventDefault()
        toggleFloatingAnimation()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSelect, prevQuestion, nextQuestion, toggleFloatingAnimation])

  if (isComplete) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          backgroundColor: colors.recitationBackground,
          color: colors.foreground,
        }}
      >
        <div style={{ fontSize: 48 }}><IconCelebrate size={48} /></div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{t('quizPanel.complete')}</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          {t('quizPanel.summary', { total, answered: answeredCount })}
        </div>
        <button
          onClick={async () => {
            await syncPendingWords()
            completeQuiz()
          }}
          style={{
            padding: '10px 32px',
            fontSize: 16,
            border: 'none',
            borderRadius: 6,
            backgroundColor: colors.primaryButton,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {t('quizPanel.viewResult')}
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: colors.recitationBackground,
      }}
    >
      {/* 顶部信息栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          fontSize: 13,
          color: colors.foreground,
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
          gap: 12,
        }}
      >
        <span style={{ flexShrink: 0 }}>
          {t('quizPanel.title')}
          <span style={{ opacity: 0.6, marginLeft: 8 }}>
            {quizState.currentIndex + 1}/{total}
          </span>
        </span>

        {/* 居中调参滑轨 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, fontSize: 11, opacity: 0.8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {t('quizPanel.damping')}
            <input
              type="range"
              min={0.99}
              max={1}
              step={0.0005}
              value={damping}
              onChange={(e) => {
                const v = Number(e.target.value)
                setDamping(v)
                recitationService.setConfig('quiz_damping', v).catch(() => {})
              }}
              style={{ width: 80, verticalAlign: 'middle' }}
            />
            <span style={{ minWidth: 36 }}>{damping.toFixed(4)}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {t('quizPanel.impulse')}
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={impulse}
              onChange={(e) => {
                const v = Number(e.target.value)
                setImpulse(v)
                recitationService.setConfig('quiz_impulse', v).catch(() => {})
              }}
              style={{ width: 80, verticalAlign: 'middle' }}
            />
            <span style={{ minWidth: 24 }}>{impulse}</span>
          </label>
        </div>

        <span style={{ opacity: 0.6, flexShrink: 0 }}>
          {t('quizPanel.answered', { answered: answeredCount, total })}
        </span>
      </div>

      {/* 题目 + 选项物理碰撞区域 — 铺满剩余空间 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <FloatingOptions
          question={question}
          onSelect={handleSelect}
          selectedOptionId={question.answered}
          disabled={!!question.answered}
          questionKey={quizState.currentIndex}
          damping={damping}
          impulse={impulse}
        />
      </div>

      {/* 底部工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          padding: '10px 16px',
          borderTop: `1px solid ${colors.border}`,
          backgroundColor: colors.toolbarBackground,
          flexShrink: 0,
        }}
      >
        <ToolButton label={t('quizPanel.exit')} onClick={() => {
          if (isArticleQuiz) {
            useRecitationStore.setState({ articleQuizSource: false })
            useRecitationStore.getState().reset()
          } else {
            setSidebarMode('full');
            setPhase('book-manager')
          }
        }} colors={colors} />
        <ToolButton
          label={t('quizPanel.prev')}
          onClick={prevQuestion}
          disabled={quizState.currentIndex === 0}
          colors={colors}
        />
        <ToolButton
          label={t(floatingAnimationEnabled ? 'quizPanel.floating' : 'quizPanel.gather')}
          onClick={toggleFloatingAnimation}
          colors={colors}
        />
        <ToolButton
          label={t('quizPanel.next')}
          onClick={() => {
            const cur = quizState.questions[quizState.currentIndex]
            if (cur && cur.answered !== undefined) {
              nextQuestion()
            }
          }}
          disabled={quizState.currentIndex >= total - 1}
          colors={colors}
        />
      </div>

      {/* 快捷键提示 */}
      <div
        style={{
          padding: '4px 16px',
          fontSize: 11,
          color: colors.foreground,
          opacity: 0.4,
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        {t('quizPanel.shortcutHint')}
      </div>
    </div>
  )
}

function ToolButton({
  label,
  onClick,
  disabled,
  colors,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  colors: ThemeConfig
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 16px',
        fontSize: 13,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        backgroundColor: disabled ? colors.cellBackground : 'transparent',
        color: disabled ? colors.border : colors.foreground,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  )
}
