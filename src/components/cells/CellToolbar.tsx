import { IconPlay, IconCheck, IconCross, IconArrowUp, IconArrowDown, IconTrash, IconChevronDown, IconChevronRight, IconStar } from '@/components/icons'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'

interface CellToolbarProps {
  onTranslate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onCollapse: () => void
  onCopy: () => void
  onBookmark: () => void
  isCollapsed: boolean
  isFirst: boolean
  isLast: boolean
  translationState?: 'pending' | 'translating' | 'done' | 'error'
}

export function CellToolbar({
  onTranslate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onCollapse,
  onCopy,
  onBookmark,
  isCollapsed,
  isFirst,
  isLast,
  translationState,
}: CellToolbarProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()

  const stateColor = translationState === 'done' ? '#4caf50' : 
                   translationState === 'error' ? '#e06c75' : 
                   colors.foreground

  const btnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    borderRadius: 4,
    color: colors.foreground,
    opacity: 0.6,
  }

  return (
    <div
      style={{
        width: 36,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 4,
        gap: 2,
        backgroundColor: colors.cellGutter,
        borderRight: `1px solid ${colors.border}`,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <button
        title={translationState === 'translating' ? t('cellToolbar.translating') : 'Translate (Ctrl+Enter)'}
        style={{
          ...btnStyle,
          cursor: translationState === 'translating' ? 'wait' : 'pointer',
          color: stateColor,
        }}
        onClick={translationState === 'translating' ? undefined : onTranslate}
        onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
        onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
      >
        {translationState === 'translating' ? <span style={{ opacity: 0.5 }}>...</span> : 
         translationState === 'done' ? <IconCheck size={12} /> : 
         translationState === 'error' ? <IconCross size={12} /> : 
         <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
           <IconPlay size={14} />
         </span>}
      </button>
      <button
        title={t('cellToolbar.copyCell')}
        style={btnStyle}
        onClick={onCopy}
        onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
        onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>      </button>
      <button
        title="添加到收藏夹"
        style={btnStyle}
        onClick={onBookmark}
        onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
        onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
      >
        <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
          <IconStar size={14} />
        </span>
      </button>
      {!isFirst && (
        <button
          title={t('cellToolbar.moveUp')}
          style={btnStyle}
          onClick={onMoveUp}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
        >
          <IconArrowUp size={14} />
        </button>
      )}
      {!isLast && (
        <button
          title={t('cellToolbar.moveDown')}
          style={btnStyle}
          onClick={onMoveDown}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
        >
          <IconArrowDown size={14} />
        </button>
      )}
      <button
        title="Delete (Delete)"
        style={btnStyle}
        onClick={onDelete}
        onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
        onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
      >
        <IconTrash size={14} />
      </button>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <button
          title={t('cellToolbar.collapseCell')}
          style={{ ...btnStyle, fontSize: 12, marginTop: 'auto', marginBottom: 4 }}
          onClick={onCollapse}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
        >
          {isCollapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
        </button>
      </div>
    </div>
  )
}

