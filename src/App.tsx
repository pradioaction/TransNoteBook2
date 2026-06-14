import { useEffect, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useSettingStore } from '@/store/settingStore'
import { useThemeStore } from '@/store/themeStore'
import { useNotebookStore } from '@/store/notebookStore'
import { useFileService } from '@/hooks/useFileService'
import { AppShell } from '@/components/layout/AppShell'

export default function App() {
  const { theme, setTheme, cssVars } = useTheme()
  const loadFromDisk = useSettingStore((s) => s.loadFromDisk)
  const [initialized, setInitialized] = useState(false)
  const fileService = useFileService()

  useEffect(() => {
    const settingStore = useSettingStore.getState()
    settingStore.setOnThemeChange((theme) => {
      useThemeStore.getState().setTheme(theme)
    })
    const notebookStoreState = useNotebookStore.getState()
    notebookStoreState.setOnFileOpened((path) => {
      const settingStoreState = useSettingStore.getState()
      settingStoreState.setLastOpenFilePath(path)
      settingStoreState.addRecentFile(path)
    })
    loadFromDisk().then(async () => {
      const { lastOpenFilePath } = useSettingStore.getState()
      if (lastOpenFilePath) {
        try {
          await fileService.openFile(lastOpenFilePath)
        } catch {
          // File not found or error - stay on welcome screen
        }
      }
      setInitialized(true)
    })
  }, [loadFromDisk])

  return initialized ? (
    <div style={{ ...cssVars, height: '100%', width: '100%' }}>
      <AppShell />
    </div>
  ) : (
    <div style={{ height: '100%', width: '100%', backgroundColor: '#1e1e1e' }} />
  )
}
