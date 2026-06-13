import { useState } from 'react'
import { useNotebookStore } from '@/store/notebookStore'
import { useTheme } from '@/hooks/useTheme'
import { useFileService } from '@/hooks/useFileService'
import { useCellService } from '@/hooks/useCellService'
import { useTranslationService } from '@/hooks/useTranslationService'
import { SettingsDialog } from '@/components/settings/SettingsDialog'

export function NotebookToolbar() {
  const store = useNotebookStore()
  const { selectedIndices } = store
  const notebookPath = useNotebookStore((s) => s.notebook?.path ?? null)
  const notebookName = useNotebookStore((s) => s.notebook?.name ?? null)
  const isModified = useNotebookStore((s) => s.notebook?.isModified ?? false)
  const { colors } = useTheme()
  const fileService = useFileService()
  const cellService = useCellService()
  const { translateAll, cancel, status } = useTranslationService()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const hasSelection = selectedIndices.size > 0

  const handleNew = () => {
    store.openFile({ path: null, name: `untitled-${Date.now()}.transnb`, isModified: false, cells: [] })
  }

  const btn: React.CSSProperties = {
    padding: '4px 10px', fontSize: 12,
    border: `1px solid ${colors.border}`, borderRadius: 3,
    backgroundColor: colors.toolbarBackground, color: colors.foreground,
    cursor: 'pointer', height: 26,
  }

  return (
    <>
      <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', backgroundColor: colors.sidebarBackground, borderBottom: `1px solid ${colors.border}`, flexShrink: 0, userSelect: 'none' }}>
        <button style={btn} onClick={handleNew}>New</button>
        <button style={btn} onClick={() => fileService.openFile()}>Open</button>
        <button style={btn} onClick={() => fileService.saveFile()}>Save</button>
        <button style={{ ...btn, padding: '4px 8px' }} onClick={() => fileService.saveFileAs()}>Save As</button>
        <button style={{ ...btn, padding: '4px 8px' }} onClick={() => fileService.importText()}>Import</button>
        <div style={{ width: 1, height: 20, backgroundColor: colors.border, margin: '0 4px' }} />
        <button style={btn} onClick={() => translateAll()} disabled={status.state === 'translating'}>
          {status.state === 'translating' ? `Translating ${status.progress}%` : 'Translate All'}
        </button>
        {status.state === 'translating' && (
          <button style={{ ...btn, color: '#e06c75' }} onClick={() => cancel()}>Cancel</button>
        )}
        {hasSelection && (
          <button style={{ ...btn, color: '#e06c75' }} onClick={() => cellService.deleteSelected()}>Delete</button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setSettingsOpen(true)} style={{ ...btn, padding: '4px 8px', fontSize: 14 }} title="Settings">⚙</button>
        <span style={{ fontSize: 11, color: '#999' }}>
          {notebookName || 'No file'}{isModified ? ' ●' : ''}
        </span>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
