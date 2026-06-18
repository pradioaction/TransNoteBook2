import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useRecitationStore } from '@/store/recitationStore'
import { useRecitationService } from '@/hooks/useRecitationService'
import { useTheme } from '@/hooks/useTheme'
import { BookManagerPanel } from './BookManagerPanel'
import { QuizPanel } from './QuizPanel'
import { ReviewPanel } from './ReviewPanel'
import { WordSidebar } from './WordSidebar'
import { StatsPanel } from './StatsPanel'
import { ResizeHandle } from './ResizeHandle'
import { Panel } from '@/components/layout/Panel'

export function RecitationShell() {
  const { t } = useTranslation()
  const phase = useRecitationStore((s) => s.phase)
  const { colors } = useTheme()
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [statsPanelWidth, setStatsPanelWidth] = useState(280)
  const workspacePath = useWorkspaceStore((s) => s.workspacePath)
  const recitationService = useRecitationService()
  const [initState, setInitState] = useState<'loading' | 'ready' | 'no-workspace' | 'error'>('loading')
  const [initError, setInitError] = useState<string | null>(null)
  const lastWorkspace = useRef<string | null>(null)

  useEffect(() => {
    // 工作区变化时重新初始化
    if (lastWorkspace.current === workspacePath) return
    lastWorkspace.current = workspacePath

    if (!workspacePath) {
      setInitState('no-workspace')
      return
    }

    // 检查 electronAPI 是否可用
    if (!window.electronAPI?.recitationAPI) {
      console.error('[Recitation] electronAPI.recitationAPI is not available')
      setInitError('应用运行环境异常：electronAPI 不可用')
      setInitState('error')
      return
    }

    setInitError(null)
    setInitState('loading')
    recitationService
      .init(workspacePath)
      .then((ok) => {
        if (ok) {
          setInitState('ready')
        } else {
          setInitError(`数据库初始化失败，工作区: ${workspacePath}。请检查工作区目录权限或查看终端日志。`)
          setInitState('error')
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Recitation] init error:`, err)
        setInitError(msg)
        setInitState('error')
      })
  }, [workspacePath, recitationService])

  if (initState === 'loading') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--foreground, #d4d4d4)',
          fontSize: 14,
        }}
      >
        {t('recitationShell.initializing')}
      </div>
    )
  }

  if (initState === 'no-workspace') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--foreground, #d4d4d4)',
          fontSize: 14,
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <span>{t('recitationShell.noWorkspace')}</span>
        <span style={{ opacity: 0.6, fontSize: 12 }}>
          {t('recitationShell.noWorkspaceHint')}
        </span>
      </div>
    )
  }

  if (initState === 'error') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--error-text, #f48771)',
          fontSize: 14,
          flexDirection: 'column',
          gap: 8,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <span>{t('recitationShell.initError')}</span>
        {initError && (
          <span style={{ opacity: 0.7, fontSize: 12, maxWidth: 400, wordBreak: 'break-all' }}>
            {initError}
          </span>
        )}
      </div>
    )
  }

  const renderMainPanel = () => {
    switch (phase) {
      case 'book-manager':
        return <BookManagerPanel />
      case 'quiz':
        return <QuizPanel />
      case 'review':
        return <ReviewPanel />
      default:
        return <BookManagerPanel />
    }
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', backgroundColor: colors.recitationBackground }}>
      {/* 左侧统计面板（仅 book-manager 阶段） */}
      {phase === 'book-manager' && (
        <>
          <div style={{ width: statsPanelWidth, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <StatsPanel />
          </div>
          <ResizeHandle
            onResize={setStatsPanelWidth}
            defaultWidth={statsPanelWidth}
            minWidth={200}
            maxWidth={400}
          />
        </>
      )}

      {/* 中间主面板 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderMainPanel()}
        <Panel />
      </div>

      {/* 可拖动分隔条 */}
      <ResizeHandle
        onResize={setSidebarWidth}
        defaultWidth={sidebarWidth}
        minWidth={200}
        maxWidth={500}
      />

      {/* 右侧单词侧边栏 */}
      <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <WordSidebar />
      </div>
    </div>
  )
}
