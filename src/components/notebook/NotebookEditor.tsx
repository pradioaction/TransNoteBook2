import { useRef, useLayoutEffect, useState } from 'react'
import { useNotebookStore } from '@/store/notebookStore'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import { useCellService } from '@/hooks/useCellService'
import { CellContainer } from '@/components/cells/CellContainer'
import { useSettingStore } from '@/store/settingStore'

export function NotebookEditor() {
  const { notebook, selectedIndices, selectCell } = useNotebookStore()
  const cellService = useCellService()
  const { colors } = useTheme()
  const { t } = useTranslation()
  if (!notebook) return null
  const { cells } = notebook
  const { cellWidthRatio } = useSettingStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    setContainerWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  const maxWidth = containerWidth > 0 ? Math.max(400, containerWidth * cellWidthRatio / 100) : 900

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '16px 24px', backgroundColor: colors.background,
      }}
    >
      <div style={{ maxWidth, margin: '0 auto' }}>
        <div style={{
          fontSize: 22, fontWeight: 600, color: colors.foreground,
          marginBottom: 20, paddingBottom: 12,
          borderBottom: `1px solid ${colors.border}`,
          fontFamily: 'system-ui',
        }}>
          {notebook.name}
        </div>

        {cells.map((cell, index) => (
          <CellContainer
            key={cell.id}
            cell={cell}
            index={index}
            isSelected={selectedIndices.has(index)}
            totalCells={cells.length}
          />
        ))}

        <div
          onClick={() => {
            if (cells.length > 0) { selectCell(cells.length - 1); cellService.insertBelow() }
          }}
          style={{
            height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px dashed ${colors.border}`, borderRadius: 4,
            cursor: 'pointer', color: '#999', fontSize: 18,
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.cellOutputBackground)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          + Add Cell
        </div>
      </div>
    </div>
  )
}
