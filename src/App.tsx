import { useEffect, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useSettingStore } from '@/store/settingStore'
import { useTTSSettingStore } from '@/store/ttsSettingStore'
import { useThemeStore } from '@/store/themeStore'
import { useNotebookStore } from '@/store/notebookStore'
import { useRecitationStore } from '@/store/recitationStore'
import type { QuizProgressSnapshot } from '@/store/recitationStore'
import { useFileService } from '@/hooks/useFileService'
import { AppShell } from '@/components/layout/AppShell'

export default function App() {
  const { theme, setTheme, cssVars } = useTheme()
  const loadFromDisk = useSettingStore((s) => s.loadFromDisk)
  const loadTTSFromDisk = useTTSSettingStore((s) => s.loadFromDisk)
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
    Promise.all([loadFromDisk(), loadTTSFromDisk()]).then(async () => {
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

  // 启动时从 studywordmode.json 加载暂存的检测进度
  useEffect(() => {
    window.electronAPI?.recitationAPI?.getConfig().then((config) => {
      const saved = config?.saved_quiz_progress as QuizProgressSnapshot | undefined
      if (saved && saved.questions?.length > 0) {
        useRecitationStore.getState().hydrateSavedQuizProgress(saved)
      }
    }).catch(() => {})
  }, [])

  return initialized ? (
    <div style={{ ...cssVars, height: '100%', width: '100%' }}>
      <AppShell />
    </div>
  ) : (
    <div style={{ height: '100%', width: '100%', backgroundColor: '#1e1e1e' }} />
  )
}
