import { type ReactNode } from 'react'
import { useTheme } from '@/hooks/useTheme'
import type { TranslationStatus } from '@/services/types'

interface PanelProps {
  children?: ReactNode
  translationStatus?: TranslationStatus
}

export function Panel({ children, translationStatus }: PanelProps) {
  const { colors } = useTheme()

  const renderTranslationProgress = () => {
    if (!translationStatus || translationStatus.state === 'idle') return null

    const { state, currentIndex, totalCount, progress, error, cellStates, cellErrors, currentContent } = translationStatus
    const doneCount = Object.values(cellStates).filter(s => s === 'done').length
    const errorCount = Object.values(cellStates).filter(s => s === 'error').length

    return (
      <div style={{ marginBottom: 8, padding: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: colors.foreground }}>
          <span>
            {state === 'translating' ? 'Translating...' : 'Translation Error'}
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
            Current: {currentContent}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#999', display: 'flex', gap: 12 }}>
          <span style={{ color: '#4caf50' }}>✓ {doneCount} done</span>
          {errorCount > 0 && <span style={{ color: '#e06c75' }}>✗ {errorCount} failed</span>}
        </div>
        {error && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#e06c75' }}>{error}</div>
        )}
        {Object.entries(cellErrors).length > 0 && (
          <div style={{ marginTop: 4 }}>
            {Object.entries(cellErrors).map(([idx, err]) => (
              <div key={idx} style={{ fontSize: 11, color: '#e06c75', marginTop: 2 }}>Cell {idx}: {err}</div>
            ))}
          </div>
        )}
      </div>
    )
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
        }}
      >
        Output / Problems
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {renderTranslationProgress()}
        {children || (
          <div style={{ color: '#999', fontSize: 13, fontStyle: 'italic' }}>No output</div>
        )}
      </div>
    </div>
  )
}
