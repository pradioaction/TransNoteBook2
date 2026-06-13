import { describe, it, expect, beforeEach } from 'vitest'
import { useNotebookStore } from '@/store/notebookStore'
import type { NotebookFile } from '@/types/notebook'

const testNotebook: NotebookFile = {
  path: '/test/test.transnb',
  name: 'test.transnb',
  isModified: false,
  cells: [
    {
      id: 'cell-1', type: 'markdown', content: 'Hello world', output: '你好世界',
      parentId: null, indentLevel: 0,
      isCollapsed: false, isInputCollapsed: false, isOutputCollapsed: false,
    },
    {
      id: 'cell-2', type: 'markdown', content: 'Second cell', output: '',
      parentId: null, indentLevel: 0,
      isCollapsed: false, isInputCollapsed: false, isOutputCollapsed: false,
    },
  ],
}

function resetStore() {
  const key = testNotebook.path!
  const map = new Map<string, NotebookFile>()
  map.set(key, { ...testNotebook })
  useNotebookStore.setState({
    openFiles: map,
    activeFilePath: key,
    notebook: { ...testNotebook },
    openFileCount: 1,
    selectedIndices: new Set<number>(),
  })
}

describe('NotebookStore', () => {
  beforeEach(resetStore)

  it('should initialize with cells', () => {
    const s = useNotebookStore.getState()
    expect(s.notebook!.cells).toHaveLength(2)
    expect(s.notebook!.name).toBe('test.transnb')
  })

  it('should select a cell', () => {
    useNotebookStore.getState().selectCell(0)
    const s = useNotebookStore.getState()
    expect(s.selectedIndices.has(0)).toBe(true)
    expect(s.selectedIndices.size).toBe(1)
  })

  it('should update cell content', () => {
    useNotebookStore.getState().updateCellContent(0, 'Updated content')
    const s = useNotebookStore.getState()
    expect(s.notebook!.cells[0].content).toBe('Updated content')
    expect(s.notebook!.isModified).toBe(true)
  })

  it('should support multi-file open', () => {
    const nb2: NotebookFile = {
      path: '/test/second.transnb', name: 'second.transnb', isModified: false,
      cells: [{ id: 'c3', type: 'markdown', content: 'File 2', output: '', parentId: null, indentLevel: 0, isCollapsed: false, isInputCollapsed: false, isOutputCollapsed: false }],
    }
    useNotebookStore.getState().openFile(nb2)
    const s = useNotebookStore.getState()
    expect(s.openFileCount).toBe(2)
    expect(s.notebook!.name).toBe('second.transnb')
  })

  it('should switch between open files', () => {
    const nb2: NotebookFile = {
      path: '/test/second.transnb', name: 'second.transnb', isModified: false,
      cells: [{ id: 'c3', type: 'markdown', content: 'File 2', output: '', parentId: null, indentLevel: 0, isCollapsed: false, isInputCollapsed: false, isOutputCollapsed: false }],
    }
    useNotebookStore.getState().openFile(nb2)
    useNotebookStore.getState().switchToFile('/test/test.transnb')
    const s = useNotebookStore.getState()
    expect(s.notebook!.name).toBe('test.transnb')
    expect(s.notebook!.cells).toHaveLength(2)
  })

  it('should close file and switch to remaining', () => {
    const nb2: NotebookFile = {
      path: '/test/second.transnb', name: 'second.transnb', isModified: false,
      cells: [{ id: 'c3', type: 'markdown', content: 'File 2', output: '', parentId: null, indentLevel: 0, isCollapsed: false, isInputCollapsed: false, isOutputCollapsed: false }],
    }
    useNotebookStore.getState().openFile(nb2)
    useNotebookStore.getState().closeFile('/test/second.transnb')
    const s = useNotebookStore.getState()
    expect(s.openFileCount).toBe(1)
    expect(s.notebook!.name).toBe('test.transnb')
  })
})
