import { useEffect, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useSettingStore } from '@/store/settingStore'
import { useNotebookStore } from '@/store/notebookStore'
import { useFileService } from '@/hooks/useFileService'
import { AppShell } from '@/components/layout/AppShell'

export default function App() {
  const { theme, setTheme, cssVars } = useTheme()
  const loadFromDisk = useSettingStore((s) => s.loadFromDisk)
  const lastOpenFilePath = useSettingStore((s) => s.lastOpenFilePath)
  const [initialized, setInitialized] = useState(false)
  const fileService = useFileService()
  const notebookPath = useNotebookStore((s) => s.notebook?.path ?? null)

  useEffect(() => {
    loadFromDisk().then(() => {
      setInitialized(true)
    })
  }, [loadFromDisk])

  useEffect(() => {
    if (initialized && lastOpenFilePath && !notebookPath) {
      fileService.openFile(lastOpenFilePath).catch(() => {
        // File not found or error - stay on welcome screen
      })
    }
  }, [initialized, lastOpenFilePath, notebookPath, fileService])

  return initialized ? (
    <div style={{ ...cssVars, height: '100%', width: '100%' }}>
      <AppShell />
    </div>
  ) : (
    <div style={{ height: '100%', width: '100%', backgroundColor: '#1e1e1e' }} />
  )
}
