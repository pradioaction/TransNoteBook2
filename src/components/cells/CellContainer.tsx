import { useCallback } from 'react'
import type { NotebookCell } from '@/types/notebook'
import { useNotebookStore } from '@/store/notebookStore'
import { useTheme } from '@/hooks/useTheme'
import { useCellService } from '@/hooks/useCellService'
import { useTranslationService } from '@/hooks/useTranslationService'
import { CellToolbar } from './CellToolbar'
import { CellEditor } from './CellEditor'
import { CellOutput } from './CellOutput'
import { CellCollapseIndicator } from './CellCollapseIndicator'
import { IconChevronRight } from '@/components/icons'

interface CellContainerProps {
  cell: NotebookCell
  index: number
  isSelected: boolean
  totalCells: number
}

export function CellContainer({ cell, index, isSelected, totalCells }: CellContainerProps) {
  const { colors } = useTheme()
  const store = useNotebookStore()
  const cellService = useCellService()
  const { translateCell, status } = useTranslationService()
  const cellState = status.cellStates[index]

  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) store.toggleCellSelection(index)
      else store.selectCell(index)
    },
    [index, store]
  )

  const indentPx = cell.indentLevel * 20

  return (
    <div
      onMouseDown={handleSelect}
      style={{
        display: 'flex', flexDirection: 'column',
        marginLeft: indentPx, marginBottom: 8,
        border: isSelected ? `2px solid ${colors.cellBorder}` : `1px solid ${colors.border}`,
        borderRadius: 4,
        backgroundColor: isSelected ? colors.cellSelectedBackground : colors.cellBackground,
        transition: 'border-color 0.15s, background-color 0.15s',
        overflow: 'hidden',
      }}
    >
      {cell.isCollapsed ? (
        <div
          style={{
            display: 'flex', alignItems: 'center', height: 36,
            padding: '0 12px', backgroundColor: colors.cellBackground,
            color: colors.foreground, fontSize: 13,
            cursor: 'pointer', gap: 8,
          }}
          onDoubleClick={() => cellService.toggleCollapse(index)}
        >
          <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><IconChevronRight size={12} /></span>
          <span style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cell.content ? cell.content.replace(/<[^>]*>/g, '').substring(0, 100) || '(empty)' : '(empty)'}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1 }}>
          <CellToolbar
            onTranslate={() => translateCell(index)}
            onMoveUp={() => { if (index > 0) cellService.moveCell(index, index - 1) }}
            onMoveDown={() => { if (index < totalCells - 1) cellService.moveCell(index, index + 1) }}
            onDelete={() => { store.selectCell(index); setTimeout(() => cellService.deleteSelected(), 0) }}
            onCollapse={() => cellService.toggleCollapse(index)}
            onCopy={() => cellService.copyCell(index)}
            isCollapsed={false}
            isFirst={index === 0}
            isLast={index === totalCells - 1}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: colors.cellBackground }}>
            <CellCollapseIndicator
              label="input"
              isCollapsed={cell.isInputCollapsed}
              onCollapse={() => cellService.toggleInputCollapse(index)}
            />
            {!cell.isInputCollapsed && (
              <CellEditor
                cell={cell}
                placeholder="Write source text (Markdown supported)..."
                onContentChange={(c) => store.updateCellContent(index, c)}
                onFocus={() => store.selectCell(index)}
                onSplit={(beforeHtml, afterHtml) => cellService.splitCell(index, beforeHtml, afterHtml)}
              />
            )}
            <CellCollapseIndicator
              label="output"
              isCollapsed={cell.isOutputCollapsed}
              onCollapse={() => cellService.toggleOutputCollapse(index)}
            />
            {!cell.isOutputCollapsed && (
              <CellOutput
                content={cell.output}
                onContentChange={(c) => store.updateCellOutput(index, c)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
