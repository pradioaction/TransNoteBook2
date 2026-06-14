import { useState } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useTheme } from '@/hooks/useTheme'
import { useRecitationStore } from '@/store/recitationStore'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { IconFolder, IconSearch, IconBook, IconIssues, IconSettings } from '@/components/icons'

const activityIcons: { id: string; icon: React.ReactNode; label: string }[] = [
  { id: 'explorer', icon: <span style={{ display: 'flex' }}><IconFolder size={18} /></span>, label: 'Explorer' },
  { id: 'search', icon: <span style={{ display: 'flex' }}><IconSearch size={18} /></span>, label: 'Search' },
  { id: 'recitation', icon: <span style={{ display: 'flex' }}><IconBook size={18} /></span>, label: 'Recitation' },
  { id: 'issues', icon: <span style={{ display: 'flex' }}><IconIssues size={18} /></span>, label: 'Issues' },
]

export function ActivityBar() {
  const { sidebarActiveTab, setSidebarTab } = useWorkspaceStore()
  const { colors } = useTheme()
  const recitationActive = useRecitationStore((s) => s.active)
  const activateRecitation = useRecitationStore((s) => s.activate)
  const deactivateRecitation = useRecitationStore((s) => s.deactivate)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const iconBtn: React.CSSProperties = {
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
    color: colors.activityBarForeground,
  }

  return (
    <>
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
          const isActive =
            (item.id === 'recitation' && recitationActive) ||
            (item.id !== 'recitation' && sidebarActiveTab === item.id)
          return (
            <button
              key={item.id}
              title={item.label}
              onClick={() => {
                if (item.id === 'recitation') {
                  setSidebarTab(item.id)
                  activateRecitation()
                } else {
                  if (recitationActive) deactivateRecitation()
                  setSidebarTab(item.id)
                }
              }}
              style={{
                ...iconBtn,
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

        {/* 弹性空间 */}
        <div style={{ flex: 1 }} />

        {/* 设置按钮 — 位于 ActivityBar 底部 */}
        <button
          title="Settings"
          onClick={() => setSettingsOpen(true)}
          style={{
            ...iconBtn,
            opacity: 0.5,
            fontSize: 20,
          }}
        >
          <span style={{ display: 'flex' }}><IconSettings size={18} /></span>
        </button>

        <div style={{ height: 4 }} />
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  )
}
