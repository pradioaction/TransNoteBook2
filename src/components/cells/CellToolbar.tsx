import { useTheme } from '@/hooks/useTheme'

interface CellToolbarProps {
  onTranslate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onCollapse: () => void
  onCopy: () => void
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
  isCollapsed,
  isFirst,
  isLast,
  translationState,
}: CellToolbarProps) {
  const { colors } = useTheme()

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
        title={translationState === 'translating' ? 'Translating...' : 'Translate (Ctrl+Enter)'}
        style={{
          ...btnStyle,
          cursor: translationState === 'translating' ? 'wait' : 'pointer',
          color: stateColor,
        }}
        onClick={translationState === 'translating' ? undefined : onTranslate}
        onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
        onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
      >
        {translationState === 'translating' ? '⏳' : 
         translationState === 'done' ? '✓' : 
         translationState === 'error' ? '✗' : '▶'}
      </button>
      <button
        title="Copy cell (Ctrl+D)"
        style={btnStyle}
        onClick={onCopy}
        onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
        onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
      >
        ⧉
      </button>
      {!isFirst && (
        <button
          title="Move up"
          style={btnStyle}
          onClick={onMoveUp}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
        >
          ▲
        </button>
      )}
      {!isLast && (
        <button
          title="Move down"
          style={btnStyle}
          onClick={onMoveDown}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
        >
          ▼
        </button>
      )}
      <button
        title="Delete (Delete)"
        style={btnStyle}
        onClick={onDelete}
        onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
        onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
      >
        ✕
      </button>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <button
          title="Collapse/Expand cell (Ctrl+E)"
          style={{ ...btnStyle, fontSize: 12, marginTop: 'auto', marginBottom: 4 }}
          onClick={onCollapse}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.6')}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
      </div>
    </div>
  )
}
