import type { WordDisplay, WordSidebarMode, ReviewBatchColor } from '@/recitation/wordSidebarTypes'
import { useTheme } from '@/hooks/useTheme'

interface WordListItemProps {
  word: WordDisplay
  mode: WordSidebarMode
  batchColor?: ReviewBatchColor
  onToggle?: (wordId: number, isNewWord: boolean, index: number, shiftKey: boolean, batchStage?: number) => void
  isNewWord: boolean
  index: number
  batchStage?: number
  quizResult?: boolean | null
}

const BATCH_BG_LIGHT: Record<ReviewBatchColor, string> = {
  green: '#e8f5e9',
  blue: '#e3f2fd',
  orange: '#fff3e0',
  purple: '#f3e5f5',
  red: '#ffebee',
}

const BATCH_BG_DARK: Record<ReviewBatchColor, string> = {
  green: '#1a5c1a',
  blue: '#1a3a5c',
  orange: '#5c3a1a',
  purple: '#3a1a5c',
  red: '#5c1a1a',
}

export function WordListItem({ word, mode, batchColor, onToggle, isNewWord, index, batchStage, quizResult }: WordListItemProps) {
  const { colors } = useTheme()
  const isDark = colors.background === '#1e1e1e'

  const getBackground = (): string => {
    if (mode === 'quiz') {
      if (word.isAnswered) return colors.cellBackground
      return 'transparent'
    }
    if (mode === 'review') {
      if (word.isCorrect) return colors.wordCorrectBackground
      if (word.isAnswered && !word.isCorrect) return colors.wordWrongBackground
    }
    if (mode === 'full' && !isNewWord && batchColor) {
      return isDark ? BATCH_BG_DARK[batchColor] : BATCH_BG_LIGHT[batchColor]
    }
    // Show quiz result background for words without batch color (新学单词)
    if (mode === 'full' && quizResult !== undefined && quizResult !== null) {
      if (quizResult) return isDark ? '#1a5c1a' : '#e8f5e9'       // 正确绿底
      return isDark ? '#5c1a1a' : '#ffebee'                        // 错误红底
    }
    return 'transparent'
  }

  const handleClick = (e: React.MouseEvent) => {
    if (mode === 'full' && onToggle) {
      onToggle(word.id, isNewWord, index, e.ctrlKey, batchStage)
    }
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 3,
        backgroundColor: getBackground(),
        cursor: mode === 'full' ? 'pointer' : 'default',
        opacity: mode === 'quiz' && word.isAnswered ? 0.4 : 1,
        fontSize: 13,
        color: colors.foreground,
        transition: 'background-color 0.2s, opacity 0.2s',
        borderLeft: quizResult === false ? `3px solid ${isDark ? '#ef5350' : '#e53935'}` : undefined,
        borderRight: quizResult === true ? `3px solid ${isDark ? '#66bb6a' : '#43a047'}` : undefined,
      }}
      title={mode === 'full' ? (word.phonetic || word.definition) : undefined}
    >
      {/* 选择框 */}
      {mode === 'full' && (
        <input
          type="checkbox"
          checked={word.isSelected}
          readOnly
          onClick={(e) => {
            e.stopPropagation()
            onToggle?.(word.id, isNewWord, index, e.ctrlKey, batchStage)
          }}
          style={{ margin: 0, cursor: 'pointer', flexShrink: 0 }}
        />
      )}

      {/* 单词文本 */}
      <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
        {word.word}
      </span>

      {/* 释义 */}
      {(mode === 'full' || mode === 'review') && word.definition && (
        <>
          <span style={{ color: colors.border, flexShrink: 0 }}>—</span>
          <span
            style={{
              color: colors.foreground,
              opacity: 0.7,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              fontSize: 12,
            }}
          >
            {word.definition}
          </span>
        </>
      )}
    </div>
  )
}
