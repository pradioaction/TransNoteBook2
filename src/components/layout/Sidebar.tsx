import { useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useTheme } from '@/hooks/useTheme'
import { FileExplorer } from '@/components/file/FileExplorer'
import { IconSettings } from '@/components/icons'

export function Sidebar() {
  const { t } = useTranslation()
  const { sidebarVisible, sidebarActiveTab, sidebarWidth, setSidebarWidth } = useWorkspaceStore()
  const { colors } = useTheme()
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const kbd: React.CSSProperties = {
    padding: '1px 5px', fontSize: 11,
    borderRadius: 3, border: `1px solid ${colors.border}`,
    backgroundColor: colors.inputBackground,
    color: colors.foreground,
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const delta = e.clientX - startXRef.current
      const newWidth = Math.max(180, Math.min(600, startWidthRef.current + delta))
      setSidebarWidth(newWidth)
    }
    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [setSidebarWidth])

  if (!sidebarVisible) return null

  return (
    <div
      style={{
        width: sidebarWidth,
        minWidth: 180,
        maxWidth: 600,
        backgroundColor: colors.sidebarBackground,
        borderRight: `1px solid ${colors.sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
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
                <tr><td><kbd style={kbd}>Ctrl+P</kbd></td><td>{t('sidebar.splitCell')}</td></tr>
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
      {/* 拖拽缩放手柄 */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          zIndex: 10,
        }}
      />
    </div>
  )
}
