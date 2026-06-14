import { useState } from 'react'
import type { ThemeConfig } from '@/types/notebook'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import { useRecitationStore } from '@/store/recitationStore'
import { WordListItem } from './WordListItem'
import type { ReviewBatchColor } from '@/recitation/wordSidebarTypes'

const STAGE_COLOR_MAP: Record<number, ReviewBatchColor> = {
  0: 'blue',
  1: 'blue',
  2: 'orange',
  3: 'orange',
  4: 'purple',
  5: 'purple',
  6: 'red',
  7: 'red',
  8: 'red',
}

export function WordSidebar() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const sidebarData = useRecitationStore((s) => s.sidebarData)
  const sidebarMode = useRecitationStore((s) => s.sidebarMode)
  const toggleWordSelection = useRecitationStore((s) => s.toggleWordSelection)
  const selectAllWords = useRecitationStore((s) => s.selectAllWords)
  const deselectAllWords = useRecitationStore((s) => s.deselectAllWords)
  const invertWordSelection = useRecitationStore((s) => s.invertWordSelection)

  if (!sidebarData) {
    return (
      <div
        style={{
          height: '100%',
          backgroundColor: colors.recitationSidebarBackground,
          borderLeft: `1px solid ${colors.recitationSidebarBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: colors.foreground,
          opacity: 0.5,
        }}
      >
        {t('wordSidebar.placeholder')}
      </div>
    )
  }

  const selectedNewCount = sidebarData.newWords.filter((w) => w.isSelected).length
  const selectedReviewCount = sidebarData.reviewWordBatches
    .flatMap((b) => b.words)
    .filter((w) => w.isSelected).length

  const handleSelectAll = () => {
    selectAllWords('new')
    selectAllWords('review')
  }
  const handleDeselectAll = () => {
    deselectAllWords('new')
    deselectAllWords('review')
  }
  const handleInvert = () => {
    invertWordSelection('new')
    invertWordSelection('review')
  }

  return (
    <div
      style={{
        height: '100%',
        backgroundColor: colors.recitationSidebarBackground,
        borderLeft: `1px solid ${colors.recitationSidebarBorder}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 标题 */}
      <div
        style={{
          padding: '10px 14px',
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          color: colors.foreground,
          opacity: 0.7,
          borderBottom: `1px solid ${colors.recitationSidebarBorder}`,
        }}
      >
        {t('wordSidebar.title')}
      </div>

      {/* 全局选择控制 */}
      {sidebarMode === 'full' && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '6px 14px',
            borderBottom: `1px solid ${colors.recitationSidebarBorder}`,
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 11, color: colors.foreground, opacity: 0.6, marginRight: 4 }}>
            {t('wordSidebar.selectAll')}:
          </span>
          <ToolbarButton label={t('wordSidebar.selectAll')} onClick={handleSelectAll} colors={colors} />
          <ToolbarButton label={t('wordSidebar.deselect')} onClick={handleDeselectAll} colors={colors} />
          <ToolbarButton label={t('wordSidebar.invert')} onClick={handleInvert} colors={colors} />
        </div>
      )}

      {/* 统计区 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 4,
          padding: '10px 14px',
          fontSize: 12,
          color: colors.foreground,
          borderBottom: `1px solid ${colors.recitationSidebarBorder}`,
        }}
      >
        <span>{t('wordSidebar.newCount', { count: sidebarData.newWords.length })}</span>
        <span>{t('wordSidebar.reviewCount', { count: sidebarData.reviewWordBatches.flatMap((b) => b.words).length })}</span>
        <span>{t('wordSidebar.studiedCount', { count: sidebarData.studiedCount })}</span>
        <span>{t('wordSidebar.pendingReviewCount', { count: sidebarData.pendingReviewCount })}</span>
        {sidebarMode === 'full' && (
          <span style={{ gridColumn: '1 / -1', fontSize: 11, opacity: 0.7 }}>
            {t('wordSidebar.selectedInfo', { newCount: selectedNewCount, reviewCount: selectedReviewCount })}
          </span>
        )}
      </div>

      {/* 单词列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px' }}>
        {/* 新学单词 */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 4,
              padding: '0 4px',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: colors.foreground,
                opacity: 0.6,
                textTransform: 'uppercase',
              }}
            >
              {t('wordSidebar.newWordsTitle', { count: sidebarData.newWords.length })}
            </span>
            {sidebarMode === 'full' && (
              <span style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                <ToolbarButton label={t('wordSidebar.selectAll')} onClick={() => selectAllWords('new')} colors={colors} />
                <ToolbarButton label={t('wordSidebar.deselect')} onClick={() => deselectAllWords('new')} colors={colors} />
                <ToolbarButton label={t('wordSidebar.invert')} onClick={() => invertWordSelection('new')} colors={colors} />
              </span>
            )}
          </div>
          {sidebarData.newWords.length === 0 ? (
            <div style={{ padding: '4px 8px', fontSize: 12, opacity: 0.4, color: colors.foreground }}>
              {t('wordSidebar.noNewWords')}
            </div>
          ) : (
            sidebarData.newWords.map((w) => (
              <WordListItem
                key={w.id}
                word={w}
                mode={sidebarMode}
                onToggle={toggleWordSelection}
                isNewWord
              />
            ))
          )}
        </div>

        {/* 复习单词批次 */}
        {sidebarData.reviewWordBatches.map((batch) => (
          <div key={batch.stage} style={{ marginBottom: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 4,
                padding: '0 4px',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.foreground,
                  opacity: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {t('wordSidebar.reviewStageTitle', { stage: batch.stage, count: batch.words.length })}
              </span>
              {sidebarMode === 'full' && (
                <span style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                  <ToolbarButton label={t('wordSidebar.selectAll')} onClick={() => selectAllWords('review')} colors={colors} />
                  <ToolbarButton label={t('wordSidebar.deselect')} onClick={() => deselectAllWords('review')} colors={colors} />
                  <ToolbarButton label={t('wordSidebar.invert')} onClick={() => invertWordSelection('review')} colors={colors} />
                </span>
              )}
            </div>
            {batch.words.map((w) => (
              <WordListItem
                key={w.id}
                word={w}
                mode={sidebarMode}
                batchColor={STAGE_COLOR_MAP[batch.stage] || 'green'}
                onToggle={toggleWordSelection}
                isNewWord={false}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  colors,
}: {
  label: string
  onClick: () => void
  colors: ThemeConfig
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 6px',
        fontSize: 11,
        border: `1px solid ${colors.border}`,
        borderRadius: 3,
        backgroundColor: 'transparent',
        color: colors.foreground,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
