import { useTranslation } from 'react-i18next'
import { useNotebookStore } from '@/store/notebookStore'
import { useTheme } from '@/hooks/useTheme'
import { IconDot } from '@/components/icons'

export function StatusBar() {
  const { t } = useTranslation()
  const { notebook, selectedIndices, openFileCount } = useNotebookStore()
  const { colors } = useTheme()
  const cellCount = notebook?.cells.length ?? 0
  const selectedCount = selectedIndices.size
  const selectedText = selectedCount > 0 ? t('statusBar.selected') : ''

  return (
    <div
      style={{
        height: 24, backgroundColor: colors.statusBarBackground,
        color: colors.statusBarForeground,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', fontSize: 12, userSelect: 'none', flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span>{notebook ? <>{notebook.name}{notebook.isModified ? <span style={{ display: 'inline-flex', alignItems: 'center' }}><IconDot size={10} /></span> : ''}</> : t('statusBar.noFile')}</span>
        {openFileCount > 1 && <span style={{ fontSize: 11, opacity: 0.7 }}>{t('statusBar.filesOpen', { count: openFileCount })}</span>}
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {selectedText && <span>{selectedText}</span>}
        <span>{t('statusBar.cells', { count: cellCount })}</span>
        <span>Markdown</span>
        <span>UTF-8</span>
      </div>
    </div>
  )
}
