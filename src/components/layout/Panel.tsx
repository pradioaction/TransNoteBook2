import { type ReactNode, useRef, useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useOutputStore } from '@/store/outputStore'
import type { TranslationStatus } from '@/services/types'
import { IconCheck, IconCross } from '@/components/icons'
import { useTranslation } from 'react-i18next'

interface PanelProps {
  children?: ReactNode
  translationStatus?: TranslationStatus
}

export function Panel({ children, translationStatus }: PanelProps) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const logs = useOutputStore((s) => s.logs)
  const clearLogs = useOutputStore((s) => s.clearLogs)
  const logEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const renderTranslationProgress = () => {
    if (!translationStatus || translationStatus.state === 'idle') return null

    const { state, totalCount, progress, error, cellStates, cellErrors, currentContent } = translationStatus
    const doneCount = Object.values(cellStates).filter(s => s === 'done').length
    const errorCount = Object.values(cellStates).filter(s => s === 'error').length

    return (
      <div style={{ marginBottom: 8, padding: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: colors.foreground }}>
          <span>
            {state === 'translating' ? t('panel.translating') : t('panel.translationError')}
          </span>
          <span>
            {doneCount + errorCount}/{totalCount} cells ({state === 'translating' ? `${progress}%` : ''})
          </span>
        </div>
        {state === 'translating' && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#4caf50', transition: 'width 0.3s', borderRadius: 2 }} />
            </div>
          </div>
        )}
        {currentContent && state === 'translating' && (
          <div style={{ fontSize: 11, color: '#999', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('panel.current')}{currentContent}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#999', display: 'flex', gap: 12 }}>
          <span style={{ color: '#4caf50' }}><IconCheck size={14} /> {t('panel.doneCount', { count: doneCount })}</span>
          {errorCount > 0 && <span style={{ color: '#e06c75' }}><IconCross size={14} /> {t('panel.errorCount', { count: errorCount })}</span>}
        </div>
        {error && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#e06c75' }}>{error}</div>
        )}
        {Object.entries(cellErrors).length > 0 && (
          <div style={{ marginTop: 4 }}>
            {Object.entries(cellErrors).map(([idx, err]) => (
              <div key={idx} style={{ fontSize: 11, color: '#e06c75', marginTop: 2 }}>{t('panel.cellError', { idx, err })}</div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const logColors: Record<string, string> = {
    info: colors.foreground,
    warn: '#d4a017',
    error: '#e06c75',
  }

  return (
    <div
      style={{
        height: 200,
        minHeight: 100,
        backgroundColor: colors.panelBackground,
        borderTop: `1px solid ${colors.panelBorder}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: '#999',
          borderBottom: `1px solid ${colors.panelBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{t('panel.title')}</span>
        {logs.length > 0 && (
          <button
            onClick={clearLogs}
            style={{
              background: 'none', border: 'none', color: '#999',
              cursor: 'pointer', fontSize: 11, padding: '0 4px',
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px', fontFamily: 'monospace', fontSize: 12 }}>
        {renderTranslationProgress()}

        {/* 运行时日志 */}
        {logs.length > 0 && (
          <div>
            {logs.map((log) => (
              <div key={log.id} style={{ color: logColors[log.level] || colors.foreground, padding: '1px 0', lineHeight: 1.6 }}>
                <span style={{ opacity: 0.5, marginRight: 8 }}>{log.timestamp}</span>
                {log.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}

        {/* 没有日志和翻译状态时显示 */}
        {logs.length === 0 && (!translationStatus || translationStatus.state === 'idle') && !children && (
          <div style={{ color: '#999', fontSize: 13, fontStyle: 'italic', fontFamily: 'sans-serif', padding: 4 }}>
            {t('panel.noOutput')}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
