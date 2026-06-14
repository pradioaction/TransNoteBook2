import { useWorkspaceStore } from '@/store/workspaceStore'
import { useTheme } from '@/hooks/useTheme'
import { FileExplorer } from '@/components/file/FileExplorer'
import { IconSettings } from '@/components/icons'

export function Sidebar() {
  const { sidebarVisible, sidebarActiveTab } = useWorkspaceStore()
  const { colors } = useTheme()

  const kbd: React.CSSProperties = {
    padding: '1px 5px', fontSize: 11,
    borderRadius: 3, border: `1px solid ${colors.border}`,
    backgroundColor: colors.inputBackground,
    color: colors.foreground,
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  }

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
            Click <IconSettings size={14} /> in the toolbar to open full settings dialog.
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: colors.foreground }}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Keyboard Shortcuts</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', lineHeight: 2.2 }}>
              <thead>
                <tr style={{ opacity: 0.6, fontSize: 11 }}>
                  <th style={{ textAlign: 'left', paddingRight: 8 }}>Keys</th>
                  <th style={{ textAlign: 'left' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><kbd style={kbd}>Ctrl+N</kbd></td><td>Insert cell below</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+A</kbd></td><td>Insert cell above</td></tr>
                <tr><td><kbd style={kbd}>Delete</kbd></td><td>Delete selected cells</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+D</kbd></td><td>Copy cell</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+M</kbd></td><td>Merge selected cells</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+F</kbd></td><td>Toggle cell dependency</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+E</kbd></td><td>Toggle cell collapse</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Q</kbd></td><td>Toggle input collapse</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+Q</kbd></td><td>Toggle all input collapse</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+W</kbd></td><td>Toggle output collapse</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+W</kbd></td><td>Toggle all output collapse</td></tr>
                <tr style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td colSpan={2} style={{ padding: '4px 0', opacity: 0.6, fontSize: 11 }}>Translation</td>
                </tr>
                <tr><td><kbd style={kbd}>Ctrl+Enter</kbd></td><td>Translate selected cell</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+Enter</kbd></td><td>Translate all cells</td></tr>
                <tr style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td colSpan={2} style={{ padding: '4px 0', opacity: 0.6, fontSize: 11 }}>File</td>
                </tr>
                <tr><td><kbd style={kbd}>Ctrl+S</kbd></td><td>Save file</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+S</kbd></td><td>Save file as</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+O</kbd></td><td>Open file</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+I</kbd></td><td>Import text</td></tr>
                <tr style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td colSpan={2} style={{ padding: '4px 0', opacity: 0.6, fontSize: 11 }}>Navigation</td>
                </tr>
                <tr><td><kbd style={kbd}>↑</kbd></td><td>Move to previous cell</td></tr>
                <tr><td><kbd style={kbd}>↓</kbd></td><td>Move to next cell</td></tr>
                <tr><td><kbd style={kbd}>Shift+↑</kbd></td><td>Select previous cell</td></tr>
                <tr><td><kbd style={kbd}>Shift+↓</kbd></td><td>Select next cell</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+B</kbd></td><td>Toggle sidebar</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+J</kbd></td><td>Toggle bottom panel</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
