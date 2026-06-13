import { create } from 'zustand'
import type { NotebookCell, NotebookFile, NotebookStore } from '@/types/notebook'

let _nextUntitled = 1

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

function createEmptyNotebookFile(): NotebookFile {
  const idx = _nextUntitled++
  return {
    path: null,
    name: `untitled-${idx}.transnb`,
    isModified: false,
    cells: [createEmptyCell()],
  }
}

function fileKey(file: NotebookFile): string {
  return file.path || `__temp__${file.name}`
}

export const useNotebookStore = create<NotebookStore>((set, get) => ({
  openFiles: new Map<string, NotebookFile>(),
  activeFilePath: null,
  selectedIndices: new Set<number>(),
  notebook: null,
  openFileCount: 0,

  openFile: (file) => {
    const key = fileKey(file)
    const map = new Map(get().openFiles)
    map.set(key, { ...file })
    set({
      openFiles: map,
      activeFilePath: key,
      selectedIndices: new Set(),
      notebook: { ...file },
      openFileCount: map.size,
    })
  },

  closeFile: (key) => {
    const map = new Map(get().openFiles)
    if (!map.has(key)) return
    map.delete(key)
    if (map.size === 0) {
      set({ openFiles: map, activeFilePath: null, selectedIndices: new Set(), notebook: null, openFileCount: 0 })
      return
    }
    const keys = [...map.keys()]
    const activeKey = get().activeFilePath === key ? keys[0] : get().activeFilePath
    const sel = new Set<number>()
    const nb = { ...map.get(activeKey!)! }
    set({
      openFiles: map,
      activeFilePath: activeKey,
      selectedIndices: sel,
      notebook: nb,
      openFileCount: map.size,
    })
  },

  switchToFile: (key) => {
    const map = get().openFiles
    if (!map.has(key)) return
    const sel = new Set<number>()
    const nb = { ...map.get(key)! }
    set({
      activeFilePath: key,
      selectedIndices: sel,
      notebook: nb,
      openFileCount: map.size,
    })
  },

  setNotebook: (nb) => {
    const key = fileKey(nb)
    const map = new Map(get().openFiles)
    map.set(key, { ...nb })
    const sel = new Set<number>()
    set({
      openFiles: map,
      activeFilePath: key,
      selectedIndices: sel,
      notebook: { ...nb },
      openFileCount: map.size,
    })
  },

  setCells: (cells) =>
    set((s) => {
      const nb = s.notebook ? { ...s.notebook, cells, isModified: true } : createEmptyNotebookFile()
      const key = s.activeFilePath ?? fileKey(nb)
      const map = new Map(s.openFiles)
      map.set(key, nb)
      return { openFiles: map, activeFilePath: key, notebook: nb, openFileCount: map.size }
    }),

  setFilePath: (path) =>
    set((s) => {
      if (!s.notebook) return s
      const oldKey = s.activeFilePath ?? fileKey(s.notebook)
      const nb = {
        ...s.notebook,
        path,
        name: path ? path.split(/[/\\]/).pop() || s.notebook.name : s.notebook.name,
      }
      const newKey = fileKey(nb)
      const map = new Map(s.openFiles)
      map.delete(oldKey)
      map.set(newKey, nb)
      return { openFiles: map, activeFilePath: newKey, notebook: nb }
    }),

  setModified: (modified) =>
    set((s) => {
      if (!s.notebook) return s
      const nb = { ...s.notebook, isModified: modified }
      const key = s.activeFilePath ?? fileKey(nb)
      const map = new Map(s.openFiles)
      map.set(key, nb)
      return { openFiles: map, notebook: nb }
    }),

  selectCell: (index) => {
    const sel = new Set<number>()
    sel.add(index)
    set({ selectedIndices: sel })
  },

  selectCellRange: (from, to) => {
    const start = Math.min(from, to)
    const end = Math.max(from, to)
    const sel = new Set<number>()
    for (let i = start; i <= end; i++) sel.add(i)
    set({ selectedIndices: sel })
  },

  toggleCellSelection: (index) => {
    set((s) => {
      const sel = new Set(s.selectedIndices)
      sel.has(index) ? sel.delete(index) : sel.add(index)
      return { selectedIndices: sel }
    })
  },

  clearSelection: () => set({ selectedIndices: new Set() }),

  updateCellContent: (index, content) => {
    set((s) => {
      if (!s.notebook) return s
      const cells = [...s.notebook.cells]
      if (cells[index]) cells[index] = { ...cells[index], content }
      const nb = { ...s.notebook, cells, isModified: true }
      return { notebook: nb }
    })
  },

  updateCellOutput: (index, output) => {
    set((s) => {
      if (!s.notebook) return s
      const cells = [...s.notebook.cells]
      if (cells[index]) cells[index] = { ...cells[index], output }
      const nb = { ...s.notebook, cells, isModified: true }
      return { notebook: nb }
    })
  },

  createEmptyNotebook: () => {
    const nb = createEmptyNotebookFile()
    const key = fileKey(nb)
    const map = new Map(get().openFiles)
    map.set(key, nb)
    set({
      openFiles: map,
      activeFilePath: key,
      selectedIndices: new Set(),
      notebook: nb,
      openFileCount: map.size,
    })
  },
}))
