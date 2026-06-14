import { useTranslation } from 'react-i18next'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useTheme } from '@/hooks/useTheme'
import { FileExplorer } from '@/components/file/FileExplorer'
import { IconSettings } from '@/components/icons'

export function Sidebar() {
  const { t } = useTranslation()
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
            {t('sidebar.search')}
          </div>
          <input
            placeholder={t('sidebar.searchPlaceholder')}
            style={{
              width: '100%', padding: '6px 8px', fontSize: 13,
              backgroundColor: colors.inputBackground, color: colors.foreground,
              border: `1px solid ${colors.inputBorder}`, borderRadius: 3,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}
      {sidebarActiveTab === 'issues' && (
        <div style={{ padding: 16, color: colors.foreground }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#999', marginBottom: 12 }}>
            {t('sidebar.keyboardShortcuts')}
          </div>
          <div style={{ fontSize: 12, color: colors.foreground }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', lineHeight: 2.2 }}>
              <thead>
                <tr style={{ opacity: 0.6, fontSize: 11 }}>
                  <th style={{ textAlign: 'left', paddingRight: 8 }}>{t('sidebar.keys')}</th>
                  <th style={{ textAlign: 'left' }}>{t('sidebar.action')}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><kbd style={kbd}>Ctrl+N</kbd></td><td>{t('sidebar.insertCellBelow')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+A</kbd></td><td>{t('sidebar.insertCellAbove')}</td></tr>
                <tr><td><kbd style={kbd}>Delete</kbd></td><td>{t('sidebar.deleteCells')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+D</kbd></td><td>{t('sidebar.copyCell')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+M</kbd></td><td>{t('sidebar.mergeCells')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+F</kbd></td><td>{t('sidebar.toggleDependency')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+E</kbd></td><td>{t('sidebar.toggleCollapse')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Q</kbd></td><td>{t('sidebar.toggleInputCollapse')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+Q</kbd></td><td>{t('sidebar.toggleAllInputCollapse')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+W</kbd></td><td>{t('sidebar.toggleOutputCollapse')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+W</kbd></td><td>{t('sidebar.toggleAllOutputCollapse')}</td></tr>
                <tr style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td colSpan={2} style={{ padding: '4px 0', opacity: 0.6, fontSize: 11 }}>{t('sidebar.sectionTranslation')}</td>
                </tr>
                <tr><td><kbd style={kbd}>Ctrl+Enter</kbd></td><td>{t('sidebar.translateSelected')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+Enter</kbd></td><td>{t('sidebar.translateAll')}</td></tr>
                <tr style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td colSpan={2} style={{ padding: '4px 0', opacity: 0.6, fontSize: 11 }}>{t('sidebar.sectionFile')}</td>
                </tr>
                <tr><td><kbd style={kbd}>Ctrl+S</kbd></td><td>{t('sidebar.saveFile')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+S</kbd></td><td>{t('sidebar.saveFileAs')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+O</kbd></td><td>{t('sidebar.openFile')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+Shift+I</kbd></td><td>{t('sidebar.importText')}</td></tr>
                <tr style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td colSpan={2} style={{ padding: '4px 0', opacity: 0.6, fontSize: 11 }}>{t('sidebar.sectionNavigation')}</td>
                </tr>
                <tr><td><kbd style={kbd}>↑</kbd></td><td>{t('sidebar.movePrev')}</td></tr>
                <tr><td><kbd style={kbd}>↓</kbd></td><td>{t('sidebar.moveNext')}</td></tr>
                <tr><td><kbd style={kbd}>Shift+↑</kbd></td><td>{t('sidebar.selectPrev')}</td></tr>
                <tr><td><kbd style={kbd}>Shift+↓</kbd></td><td>{t('sidebar.selectNext')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+B</kbd></td><td>{t('sidebar.toggleSidebar')}</td></tr>
                <tr><td><kbd style={kbd}>Ctrl+J</kbd></td><td>{t('sidebar.togglePanel')}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {sidebarActiveTab === 'settings' && (
        <div style={{ padding: 16, color: colors.foreground }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#999', marginBottom: 12 }}>
            {t('sidebar.settingsTitle')}
          </div>
          <div style={{ fontSize: 13, color: '#999' }}>
            {t('sidebar.settingsHint', { icon: <IconSettings size={14} /> })}
          </div>
        </div>
      )}
    </div>
  )
}
