import { useTheme } from '@/hooks/useTheme'

interface CellCollapseIndicatorProps {
  onCollapse: () => void
  isCollapsed: boolean
  label: string
}

export function CellCollapseIndicator({ onCollapse, isCollapsed, label }: CellCollapseIndicatorProps) {
  const { colors } = useTheme()

  return (
    <div
      onClick={onCollapse}
      onDoubleClick={onCollapse}
      title={`Double-click to ${isCollapsed ? 'expand' : 'collapse'} ${label}`}
      style={{
        height: 4,
        cursor: 'pointer',
        backgroundColor: isCollapsed ? colors.primaryButton : colors.border,
        transition: 'background-color 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        ;(e.target as HTMLDivElement).style.backgroundColor = colors.primaryButton
      }}
      onMouseLeave={(e) => {
        ;(e.target as HTMLDivElement).style.backgroundColor = isCollapsed
          ? colors.primaryButton
          : colors.border
      }}
    />
  )
}
