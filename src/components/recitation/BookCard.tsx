import { useState, useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'
import type { BookWithProgress, StageSummary, StageFilter } from '@/recitation/types'
import { IconBook } from '@/components/icons'
import { useTranslation } from 'react-i18next'

interface BookCardProps {
  book: BookWithProgress
  isSelected: boolean
  onSelect: (bookId: number, bookName: string) => void
  onViewWords: (bookId: number, bookName: string) => void
  stageSummary?: StageSummary
  onDoubleClickSegment?: (bookId: number, bookName: string, stageFilter: StageFilter) => void
  onRename?: (bookId: number, newName: string) => void
}

const STAGE_LABELS: Array<{ key: keyof StageSummary; label: string }> = [
  { key: 'unstudied', label: '未学' },
  { key: 'beginner', label: '初学' },
  { key: 'review', label: '复习' },
  { key: 'consolidate', label: '巩固' },
  { key: 'proficient', label: '熟练' },
  { key: 'mastered', label: '掌握' },
]

const STAGE_FILTER_MAP: Record<string, StageFilter> = {
  unstudied: { min: -1, max: -1, label: '未学' },
  beginner: { min: 0, max: 1, label: '初学' },
  review: { min: 2, max: 3, label: '复习' },
  consolidate: { min: 4, max: 5, label: '巩固' },
  proficient: { min: 6, max: 7, label: '熟练' },
  mastered: { min: 8, max: 8, label: '掌握' },
}

function getStageColor(colors: Record<string, string>, key: string): string {
  const map: Record<string, string> = {
    unstudied: colors.stageUnstudied,
    beginner: colors.stageBeginner,
    review: colors.stageReview,
    consolidate: colors.stageConsolidate,
    proficient: colors.stageProficient,
    mastered: colors.stageMastered,
  }
  return map[key] || colors.bookProgressBarTrack
}

export function BookCard({
  book,
  isSelected,
  onSelect,
  onViewWords,
  stageSummary,
  onDoubleClickSegment,
  onRename,
}: BookCardProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const { book: bookInfo, total, studied, review_due, progress } = book
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(bookInfo.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSelect = () => {
    onSelect(bookInfo.id!, bookInfo.name)
  }

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRenameValue(bookInfo.name)
    setRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleConfirmRename = () => {
    setRenaming(false)
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== bookInfo.name && onRename && bookInfo.id) {
      onRename(bookInfo.id, trimmed)
    }
  }

  const handleCancelRename = () => {
    setRenaming(false)
    setRenameValue(bookInfo.name)
  }

  // 计算各段占比
  const segments = stageSummary
    ? STAGE_LABELS.map(({ key, label }) => {
        const value = stageSummary[key]
        const pct = total > 0 ? (value / total) * 100 : 0
        return { key, label, value, pct, color: getStageColor(colors as unknown as Record<string, string>, key) }
      }).filter((s) => s.pct > 0)
    : []

  const hasDistribution = segments.length > 0

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 18, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}><IconBook size={20} /></span>
          {renaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleConfirmRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename()
                if (e.key === 'Escape') handleCancelRename()
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontWeight: 600, fontSize: 14,
                padding: '2px 6px',
                backgroundColor: colors.inputBackground,
                color: colors.foreground,
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 3,
                outline: 'none',
                width: '100%',
                maxWidth: 300,
              }}
            />
          ) : (
            <span
              style={{ fontWeight: 600, fontSize: 14, color: colors.foreground, cursor: 'pointer' }}
              onDoubleClick={handleStartRename}
              title={t('bookCard.doubleClickRename')}
            >
              {bookInfo.name}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: colors.foreground, opacity: 0.7 }}>
          {Math.round(progress)}%
        </span>
      </div>

      {/* 分段进度条 */}
      <div
        style={{
          height: 12,
          borderRadius: 6,
          backgroundColor: hasDistribution ? 'transparent' : colors.bookProgressBarTrack,
          marginBottom: 8,
          display: 'flex',
          gap: 2,
          overflow: 'hidden',
        }}
      >
        {hasDistribution ? (
          segments.map((seg) => (
            <div
              key={seg.key}
              title={`${seg.label}: ${seg.value} (${seg.pct.toFixed(1)}%)`}
              onDoubleClick={(e) => {
                e.stopPropagation()
                const filter = STAGE_FILTER_MAP[seg.key]
                if (filter && onDoubleClickSegment && bookInfo.id) {
                  onDoubleClickSegment(bookInfo.id, bookInfo.name, filter)
                }
              }}
              style={{
                height: '100%',
                width: `${seg.pct}%`,
                backgroundColor: seg.color,
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'transform 0.15s, filter 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scaleY(1.4)'
                e.currentTarget.style.filter = 'brightness(1.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scaleY(1)'
                e.currentTarget.style.filter = 'brightness(1)'
              }}
            />
          ))
        ) : (
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, progress)}%`,
              borderRadius: 3,
              backgroundColor: colors.bookProgressBarFill,
              transition: 'width 0.3s',
            }}
          />
        )}
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
