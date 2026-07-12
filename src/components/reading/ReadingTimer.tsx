import { useEffect, useRef } from 'react'
import { useNotebookStore } from '@/store/notebookStore'
import { useOutputStore } from '@/store/outputStore'
import { useReadingTimerStore } from '@/store/readingTimerStore'
import { useTheme } from '@/hooks/useTheme'

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ReadingTimer() {
  const notebookPath = useNotebookStore((s) => s.notebook?.path ?? null)
  const notebookName = useNotebookStore((s) => s.notebook?.name ?? null)
  const { colors } = useTheme()

  const running = useReadingTimerStore((s) => s.running)
  const elapsed = useReadingTimerStore((s) => s.elapsed)
  const startTimer = useReadingTimerStore((s) => s.startTimer)
  const stopTimer = useReadingTimerStore((s) => s.stopTimer)
  const tick = useReadingTimerStore((s) => s.tick)

  const pathRef = useRef(notebookPath)

  // 每秒递增
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => tick(), 1000)
    return () => clearInterval(id)
  }, [running, tick])

  // 文件切换 → 自动停止
  useEffect(() => {
    if (running && pathRef.current !== null && notebookPath !== pathRef.current) {
      stopTimer(' (file switched)')
    }
    pathRef.current = notebookPath
  })

  // 组件卸载时兜底：如果计时器仍在运行则输出日志
  useEffect(() => {
    return () => {
      const state = useReadingTimerStore.getState()
      if (!state.running || state.elapsed === 0) return
      const name = state.notebookPath?.split(/[/\\]/).pop() || 'untitled'
      const timeStr = formatTime(state.elapsed)
      useOutputStore.getState().addLog(`Reading: ${timeStr} on ${name}`)
    }
  }, [])

  // 无 notebook 时隐藏计时器
  if (!notebookPath && !notebookName) return null

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    color: running ? colors.primaryButton : '#999',
    padding: '0 2px',
    display: 'inline-flex',
    alignItems: 'center',
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 8, userSelect: 'none' }}>
      <button
        onClick={() => {
          if (running) {
            stopTimer('')
          } else {
            startTimer(notebookPath ?? '')
          }
        }}
        style={btnStyle}
        title={running ? 'Pause' : 'Start'}
      >
        {running ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="1" width="3" height="10" rx="1" fill="currentColor" />
            <rect x="7" y="1" width="3" height="10" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3.5 1.5v9l7-4.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <span style={{ fontSize: 11, color: '#999', minWidth: 35, fontVariantNumeric: 'tabular-nums' }}>
        {formatTime(elapsed)}
      </span>
    </span>
  )
}
