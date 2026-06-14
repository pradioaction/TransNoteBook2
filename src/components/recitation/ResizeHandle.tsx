import { useTheme } from '@/hooks/useTheme'
import { useCallback, useRef, useEffect } from 'react'

interface ResizeHandleProps {
  onResize: (newWidth: number) => void
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
}

export function ResizeHandle({ onResize, defaultWidth = 300, minWidth = 200, maxWidth = 500 }: ResizeHandleProps) {
  const { colors } = useTheme()
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(defaultWidth)

  // 同步 defaultWidth 到 ref，确保拖动时用的是最新值
  startWidth.current = defaultWidth

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = defaultWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [defaultWidth])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return
    const delta = startX.current - e.clientX
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.current + delta))
    onResize(newWidth)
  }, [minWidth, maxWidth, onResize])

  const handleMouseUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: 4,
        cursor: 'col-resize',
        backgroundColor: colors.border,
        flexShrink: 0,
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.primaryButton }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = colors.border }}
    />
  )
}
