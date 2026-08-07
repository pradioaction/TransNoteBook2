import { useEffect, useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'

export interface ContextMenuItem {
  id: string
  label: string
  disabled?: boolean
  onClick: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const { colors } = useTheme()
  const menuRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Ignore mousedown events within 150ms of opening
      // to avoid the right-click's own mousedown from closing it immediately
      if (Date.now() - handleClick._lastOpened < 150) return
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current()
      }
    }
    handleClick._lastOpened = Date.now()
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }

    // Use capture phase to bypass stopPropagation from ProseMirror/TipTap
    document.addEventListener('mousedown', handleClick, true)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClick, true)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 160)
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 8)

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 10000,
        minWidth: 150,
        padding: '4px 0',
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.12)',
        overflow: 'hidden',
      }}
    >
      {items.map((item, index) => (
        <div key={item.id}>
          {index > 0 && items[index - 1].id !== 'separator' && item.id === 'separator' ? (
            <div style={{ height: 1, backgroundColor: colors.border, margin: '4px 8px' }} />
          ) : (
            <div
              onClick={() => {
                if (!item.disabled) {
                  item.onClick()
                  onClose()
                }
              }}
              style={{
                padding: '6px 16px',
                fontSize: 13,
                lineHeight: '22px',
                color: item.disabled ? '#888' : colors.foreground,
                backgroundColor: 'transparent',
                cursor: item.disabled ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                userSelect: 'none',
                opacity: item.disabled ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  e.currentTarget.style.backgroundColor = colors.toolbarBackground
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {item.label}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
