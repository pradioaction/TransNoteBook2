import { useEffect, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useSettingStore } from '@/store/settingStore'
import { useTTSSettingStore } from '@/store/ttsSettingStore'
import { useThemeStore } from '@/store/themeStore'
import { useNotebookStore } from '@/store/notebookStore'
import { useRecitationStore } from '@/store/recitationStore'
import type { QuizProgressSnapshot } from '@/store/recitationStore'
import { useFileService } from '@/hooks/useFileService'
import { useRecitationService } from '@/hooks/useRecitationService'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { AppShell } from '@/components/layout/AppShell'

// 启动时从 studywordmode.json 加载暂存的检测进度（按槽位：'article' | `book_${bookId}`）
async function loadSavedQuizSlots() {
  try {
    const config = await window.electronAPI?.recitationAPI?.getConfig()
    if (!config) return
    const hydrate = useRecitationStore.getState().hydrateSavedQuizProgressSlot
    for (const [key, value] of Object.entries(config)) {
      try {
        if (key === 'saved_quiz_progress') {
          const saved = value as QuizProgressSnapshot | null
          if (saved && saved.questions?.length > 0) {
            hydrate('article', saved)
          }
        } else if (key.startsWith('saved_quiz_progress_book_')) {
          const bookId = key.slice('saved_quiz_progress_book_'.length)
          const saved = value as QuizProgressSnapshot | null
          if (saved && saved.questions?.length > 0) {
            hydrate(`book_${bookId}`, saved)
          }
        }
      } catch {
        // 忽略单个槽位加载失败
      }
    }
  } catch {
    // 忽略加载失败
  }
}

export default function App() {
  const { theme, setTheme, cssVars } = useTheme()
  const loadFromDisk = useSettingStore((s) => s.loadFromDisk)
  const loadTTSFromDisk = useTTSSettingStore((s) => s.loadFromDisk)
  const [initialized, setInitialized] = useState(false)
  const fileService = useFileService()
  const workspacePath = useWorkspaceStore((s) => s.workspacePath)
  const recitationService = useRecitationService()

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

  // 工作区就绪且背诵服务 init 成功后，再加载暂存的检测进度快照（服务就绪前 get-config 返回 {}）
  useEffect(() => {
    if (!workspacePath) return
    let cancelled = false
    recitationService
      .init(workspacePath)
      .then((ok: boolean) => {
        if (cancelled) return
        useRecitationStore.getState().clearSavedQuizProgressSlots()
        if (ok) loadSavedQuizSlots()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [workspacePath, recitationService])

  return initialized ? (
    <div style={{ ...cssVars, height: '100%', width: '100%' }}>
      <AppShell />
    </div>
  ) : (
    <div style={{ height: '100%', width: '100%', backgroundColor: '#1e1e1e' }} />
  )
}
