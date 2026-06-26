import { useState, useEffect, useRef } from 'react'
import { useNotebookStore } from '@/store/notebookStore'
import { useRecitationStore } from '@/store/recitationStore'
import { useOutputStore } from '@/store/outputStore'
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
  const recitationActive = useRecitationStore((s) => s.active)
  const { colors } = useTheme()

  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const elapsedRef = useRef(0)
  const pathRef = useRef(notebookPath)

  // 每秒递增
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setElapsed((s) => {
        elapsedRef.current = s + 1
        return s + 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  // 停止计时并输出日志
  const stopTimer = (reason: string) => {
    setRunning(false)
    const s = elapsedRef.current
    setElapsed(0)
    elapsedRef.current = 0
    const name = pathRef.current?.split(/[/\\]/).pop() || 'untitled'
    const timeStr = formatTime(s)
    useOutputStore.getState().addLog(`Reading: ${timeStr} on ${name}${reason}`)
    pathRef.current = notebookPath
  }

  // 文件切换 → 自动停止
  useEffect(() => {
    if (running && pathRef.current !== null && notebookPath !== pathRef.current) {
      stopTimer(' (file switched)')
    }
    pathRef.current = notebookPath
  })

  // 背诵检测/测验激活 → 自动停止
  useEffect(() => {
    if (running && recitationActive) {
      stopTimer(' (quiz started)')
    }
  }, [recitationActive])

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
            setRunning(true)
            pathRef.current = notebookPath
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
