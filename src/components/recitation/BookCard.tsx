import { useTheme } from '@/hooks/useTheme'
import type { BookWithProgress } from '@/recitation/types'
import { IconBook } from '@/components/icons'
import { useTranslation } from 'react-i18next'

interface BookCardProps {
  book: BookWithProgress
  isSelected: boolean
  onSelect: (bookId: number, bookName: string) => void
  onViewWords: (bookId: number, bookName: string) => void
}

export function BookCard({
  book,
  isSelected,
  onSelect,
  onViewWords,
}: BookCardProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const { book: bookInfo, total, studied, review_due, progress } = book

  const handleSelect = () => {
    onSelect(bookInfo.id!, bookInfo.name)
  }

  return (
    <div
      onClick={handleSelect}
      style={{
        padding: '12px 16px',
        marginBottom: 8,
        borderRadius: 6,
        backgroundColor: isSelected ? colors.cellSelectedBackground : colors.quizCardBackground,
        border: `1px solid ${isSelected ? colors.primaryButton : colors.quizCardBorder}`,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      {/* 标题行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, display: 'inline-flex', alignItems: 'center' }}><IconBook size={20} /></span>
          <span style={{ fontWeight: 600, fontSize: 14, color: colors.foreground }}>
            {bookInfo.name}
          </span>
        </div>
        <span style={{ fontSize: 12, color: colors.foreground, opacity: 0.7 }}>
          {Math.round(progress)}%
        </span>
      </div>

      {/* 进度条 */}
      <div
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.bookProgressBarTrack,
          marginBottom: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 2,
            backgroundColor: colors.bookProgressBarFill,
            width: `${Math.min(100, progress)}%`,
            transition: 'width 0.3s',
          }}
        />
      </div>

      {/* 统计行 */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: colors.foreground, opacity: 0.7, marginBottom: 10 }}>
        <span>{t('bookCard.studied', { studied, total })}</span>
        <span>{t('bookCard.pendingReview', { count: review_due })}</span>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onViewWords(bookInfo.id!, bookInfo.name) }}
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
          {t('bookCard.viewWords')}
        </button>
      </div>
    </div>
  )
}
