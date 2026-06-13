import { useWorkspaceStore } from '@/store/workspaceStore'
import { useTheme } from '@/hooks/useTheme'
import { FileExplorer } from '@/components/file/FileExplorer'

export function Sidebar() {
  const { sidebarVisible, sidebarActiveTab } = useWorkspaceStore()
  const { colors } = useTheme()

  if (!sidebarVisible) return null

  return (
    <div
      style={{
        width: 280,
        minWidth: 200,
        backgroundColor: colors.sidebarBackground,
        borderRight: `1px solid ${colors.sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {sidebarActiveTab === 'explorer' && <FileExplorer />}
      {sidebarActiveTab === 'search' && (
        <div style={{ padding: 16, color: colors.foreground }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#999', marginBottom: 12 }}>
            Search
          </div>
          <input
            placeholder="Search..."
            style={{
              width: '100%', padding: '6px 8px', fontSize: 13,
              backgroundColor: colors.inputBackground, color: colors.foreground,
              border: `1px solid ${colors.inputBorder}`, borderRadius: 3,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}
      {sidebarActiveTab === 'settings' && (
        <div style={{ padding: 16, color: colors.foreground }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#999', marginBottom: 12 }}>
            Settings
          </div>
          <div style={{ fontSize: 13, color: '#999' }}>
            Click ⚙ in the toolbar to open full settings dialog.
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: colors.foreground }}>
            <p>Shortcuts:</p>
            <ul style={{ paddingLeft: 16, marginTop: 8, lineHeight: 2 }}>
              <li><kbd>Ctrl+N</kbd> Insert cell below</li>
              <li><kbd>Ctrl+Shift+A</kbd> Insert cell above</li>
              <li><kbd>Ctrl+D</kbd> Copy cell</li>
              <li><kbd>Ctrl+E</kbd> Toggle collapse</li>
              <li><kbd>Ctrl+F</kbd> Toggle dependency</li>
              <li><kbd>Ctrl+M</kbd> Merge cells</li>
              <li><kbd>Delete</kbd> Delete cell</li>
              <li><kbd>Ctrl+Shift+Q</kbd> Collapse all input</li>
              <li><kbd>Ctrl+Shift+W</kbd> Collapse all output</li>
              <li><kbd>Shift+↑/↓</kbd> Multi-select</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
