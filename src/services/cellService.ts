import { useNotebookStore } from '@/store/notebookStore'
import type { CellService } from './types'
import type { NotebookCell } from '@/types/notebook'

function createEmptyCell(): NotebookCell {
  return {
    id: crypto.randomUUID(),
    type: 'markdown',
    content: '',
    output: '',
    parentId: null,
    indentLevel: 0,
    isCollapsed: false,
    isInputCollapsed: false,
    isOutputCollapsed: false,
  }
}

export function createCellService(): CellService {
  const store = useNotebookStore()

  const insertBelow = () => {
    const nb = store.notebook
    if (!nb) return
    const indices = [...store.selectedIndices]
    const idx = indices.length > 0 ? Math.max(...indices) : 0
    const cells = [...nb.cells]
    cells.splice(idx + 1, 0, createEmptyCell())
    store.setCells(cells)
    store.selectCell(idx + 1)
  }

  const insertAbove = () => {
    const nb = store.notebook
    if (!nb) return
    const indices = [...store.selectedIndices]
    const idx = indices.length > 0 ? Math.min(...indices) : 0
    const cells = [...nb.cells]
    cells.splice(idx, 0, createEmptyCell())
    store.setCells(cells)
    store.selectCell(idx)
  }

  const deleteSelected = () => {
    const nb = store.notebook
    if (!nb) return
    if (store.selectedIndices.size === 0) return
    const sorted = [...store.selectedIndices].sort((a, b) => b - a)
    const cells = [...nb.cells]
    sorted.forEach(i => cells.splice(i, 1))
    if (cells.length === 0) cells.push(createEmptyCell())
    const newIdx = Math.min(sorted[sorted.length - 1], cells.length - 1)
    store.setCells(cells)
    store.selectCell(newIdx)
  }

  const copyCell = (index: number) => {
    const nb = store.notebook
    if (!nb) return
    const cells = [...nb.cells]
    const orig = cells[index]
    if (!orig) return
    cells.splice(index + 1, 0, {
      ...orig,
      id: crypto.randomUUID(),
      isCollapsed: false,
      isInputCollapsed: false,
      isOutputCollapsed: false,
    })
    store.setCells(cells)
    store.selectCell(index + 1)
  }

  const splitCell = (index: number, beforeText: string, afterText: string) => {
    const nb = store.notebook
    if (!nb) return
    const cells = [...nb.cells]
    const orig = cells[index]
    if (!orig || !beforeText.trim() || !afterText.trim()) return
    cells[index] = { ...orig, content: beforeText }
    cells.splice(index + 1, 0, {
      ...orig,
      id: crypto.randomUUID(),
      content: afterText,
      output: '',
      isCollapsed: false,
      isInputCollapsed: false,
      isOutputCollapsed: false,
    })
    store.setCells(cells)
    store.selectCell(index + 1)
  }

  const mergeSelected = () => {
    const nb = store.notebook
    if (!nb) return
    const sorted = [...store.selectedIndices].sort((a, b) => a - b)
    if (sorted.length < 2) return
    const cells = [...nb.cells]
    const first = cells[sorted[0]]
    const mergedC = sorted.map(i => cells[i].content).join('\n')
    const mergedO = sorted.map(i => cells[i].output).filter(Boolean).join('\n\n')
    cells[sorted[0]] = { ...first, content: mergedC, output: mergedO }
    for (let i = sorted.length - 1; i >= 1; i--) cells.splice(sorted[i], 1)
    store.setCells(cells)
    store.selectCell(sorted[0])
  }

  const moveCell = (fromIndex: number, toIndex: number) => {
    const nb = store.notebook
    if (!nb) return
    const cells = [...nb.cells]
    const [moved] = cells.splice(fromIndex, 1)
    cells.splice(toIndex, 0, moved)
    store.setCells(cells)
    store.selectCell(toIndex)
  }

  const toggleCollapse = (index: number) => {
    const nb = store.notebook
    if (!nb) return
    const cells = [...nb.cells]
    if (!cells[index]) return
    const v = !cells[index].isCollapsed
    cells[index] = { ...cells[index], isCollapsed: v }
    const pid = cells[index].id
    for (let i = 0; i < cells.length; i++) {
      if (i !== index && cells[i].parentId === pid) {
        cells[i] = { ...cells[i], isCollapsed: v }
      }
    }
    store.setCells(cells)
  }

  const toggleInputCollapse = (index: number) => {
    const nb = store.notebook
    if (!nb) return
    const cells = [...nb.cells]
    if (cells[index]) cells[index] = { ...cells[index], isInputCollapsed: !cells[index].isInputCollapsed }
    store.setCells(cells)
  }

  const toggleOutputCollapse = (index: number) => {
    const nb = store.notebook
    if (!nb) return
    const cells = [...nb.cells]
    if (cells[index]) cells[index] = { ...cells[index], isOutputCollapsed: !cells[index].isOutputCollapsed }
    store.setCells(cells)
  }

  const toggleInputCollapseAll = () => {
    const nb = store.notebook
    if (!nb) return
    const all = nb.cells.every(c => c.isInputCollapsed)
    const cells = nb.cells.map(c => ({ ...c, isInputCollapsed: !all }))
    store.setCells(cells)
  }

  const toggleOutputCollapseAll = () => {
    const nb = store.notebook
    if (!nb) return
    const all = nb.cells.every(c => c.isOutputCollapsed)
    const cells = nb.cells.map(c => ({ ...c, isOutputCollapsed: !all }))
    store.setCells(cells)
  }

  const toggleDependency = (index: number) => {
    const nb = store.notebook
    if (!nb) return
    const cell = nb.cells[index]
    if (!cell) return
    if (cell.parentId !== null) {
      removeDependency(index)
    } else if (index > 0) {
      setDependent(index, index - 1)
    }
  }

  const setDependent = (childIndex: number, parentIndex: number) => {
    const nb = store.notebook
    if (!nb) return
    const cells = [...nb.cells]
    const p = cells[parentIndex]
    const c = cells[childIndex]
    if (!p || !c || childIndex === parentIndex) return
    cells[childIndex] = { ...c, parentId: p.id, indentLevel: p.indentLevel + 1 }
    store.setCells(cells)
  }

  const removeDependency = (index: number) => {
    const nb = store.notebook
    if (!nb) return
    const cells = [...nb.cells]
    if (cells[index]) cells[index] = { ...cells[index], parentId: null, indentLevel: 0 }
    store.setCells(cells)
  }

  const updateContent = (index: number, content: string) => store.updateCellContent(index, content)
  const updateOutput = (index: number, output: string) => store.updateCellOutput(index, output)

  return {
    insertBelow, insertAbove, deleteSelected, copyCell, splitCell, mergeSelected, moveCell,
    toggleCollapse, toggleInputCollapse, toggleOutputCollapse,
    toggleInputCollapseAll, toggleOutputCollapseAll,
    toggleDependency, setDependent, removeDependency,
    updateContent, updateOutput,
  }
}
