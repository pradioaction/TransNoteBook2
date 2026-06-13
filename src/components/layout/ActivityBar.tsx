import { useWorkspaceStore } from '@/store/workspaceStore'
import { useTheme } from '@/hooks/useTheme'

const activityIcons: { id: string; icon: string; label: string }[] = [
  { id: 'explorer', icon: '📁', label: 'Explorer' },
  { id: 'search', icon: '🔍', label: 'Search' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
]

export function ActivityBar() {
  const { sidebarActiveTab, setSidebarTab } = useWorkspaceStore()
  const { colors } = useTheme()

  return (
    <div
      style={{
        width: 48,
        backgroundColor: colors.activityBarBackground,
        color: colors.activityBarForeground,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {activityIcons.map((item) => {
        const isActive = sidebarActiveTab === item.id
        return (
          <button
            key={item.id}
            title={item.label}
            onClick={() => setSidebarTab(item.id)}
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 22,
              position: 'relative',
              color: isActive ? colors.activityBarForeground : colors.activityBarForeground,
              opacity: isActive ? 1 : 0.5,
            }}
          >
            {item.icon}
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '25%',
                  height: '50%',
                  width: 2,
                  backgroundColor: colors.activityBarActiveBorder,
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
