import { ActivityBar } from './ActivityBar'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { Panel } from './Panel'
import { NotebookToolbar } from '@/components/notebook/NotebookToolbar'
import { NotebookEditor } from '@/components/notebook/NotebookEditor'
import { WelcomePage } from '@/components/welcome/WelcomePage'
import { RecitationShell } from '@/components/recitation/RecitationShell'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useTranslationService } from '@/hooks/useTranslationService'
import { useNotebookStore } from '@/store/notebookStore'
import { useRecitationStore } from '@/store/recitationStore'
import { useState, useCallback } from 'react'

export function AppShell() {
  useKeyboard()
  const { status } = useTranslationService()
  const notebookPath = useNotebookStore((s) => s.notebook?.path ?? null)
  const notebookName = useNotebookStore((s) => s.notebook?.name ?? null)
  const isRecitationMode = useRecitationStore((s) => s.active)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)

  const showWelcome = !welcomeDismissed && (!notebookPath || (notebookName?.startsWith('untitled-') ?? false))

  const handleFileOpened = useCallback(() => {
    setWelcomeDismissed(true)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ActivityBar />
        {!isRecitationMode && <Sidebar />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {isRecitationMode ? (
            <RecitationShell />
          ) : (
            <>
              <NotebookToolbar />
              {showWelcome ? (
                <WelcomePage onFileOpened={handleFileOpened} />
              ) : (
                <NotebookEditor />
              )}
              <Panel translationStatus={status} />
            </>
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
