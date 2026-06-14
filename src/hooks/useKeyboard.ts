import { useEffect, useCallback } from 'react'
import { useNotebookStore } from '@/store/notebookStore'
import { useCellService } from './useCellService'
import { useFileService } from './useFileService'
import { useTranslationService } from './useTranslationService'
import { useWorkspaceStore } from '@/store/workspaceStore'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  action: () => void
  description: string
}

export function useKeyboard() {
  const store = useNotebookStore()
  const cellService = useCellService()
  const fileService = useFileService()
  const { translateCell, translateAll } = useTranslationService()
  const workspaceStore = useWorkspaceStore()
  const selectedIndices = store.selectedIndices
  const getFirstSelected = () => {
    const sorted = [...selectedIndices].sort((a, b) => a - b)
    return sorted.length > 0 ? sorted[0] : 0
  }

  const shortcuts: KeyboardShortcut[] = [
    // === 单元格操作 ===
    {
      key: 'n',
      ctrl: true,
      description: 'Insert cell below',
      action: () => cellService.insertBelow(),
    },
    {
      key: 'a',
      ctrl: true,
      shift: true,
      description: 'Insert cell above',
      action: () => cellService.insertAbove(),
    },
    {
      key: 'Delete',
      description: 'Delete selected cells',
      action: () => cellService.deleteSelected(),
    },
    {
      key: 'd',
      ctrl: true,
      description: 'Copy cell',
      action: () => cellService.copyCell(getFirstSelected()),
    },
    {
      key: 'm',
      ctrl: true,
      description: 'Merge selected cells',
      action: () => {
        if (selectedIndices.size >= 2) cellService.mergeSelected()
      },
    },
    {
      key: 'f',
      ctrl: true,
      description: 'Toggle cell dependency',
      action: () => cellService.toggleDependency(getFirstSelected()),
    },
    {
      key: 'e',
      ctrl: true,
      description: 'Toggle cell collapse',
      action: () => cellService.toggleCollapse(getFirstSelected()),
    },
    {
      key: 'q',
      ctrl: true,
      description: 'Toggle input collapse',
      action: () => cellService.toggleInputCollapse(getFirstSelected()),
    },
    {
      key: 'q',
      ctrl: true,
      shift: true,
      description: 'Toggle all input collapse',
      action: () => cellService.toggleInputCollapseAll(),
    },
    {
      key: 'w',
      ctrl: true,
      description: 'Toggle output collapse',
      action: () => cellService.toggleOutputCollapse(getFirstSelected()),
    },
    {
      key: 'w',
      ctrl: true,
      shift: true,
      description: 'Toggle all output collapse',
      action: () => cellService.toggleOutputCollapseAll(),
    },
    // === 翻译操作 ===
    {
      key: 'Enter',
      ctrl: true,
      description: 'Translate selected cell',
      action: () => translateCell(getFirstSelected()),
    },
    {
      key: 'Enter',
      ctrl: true,
      shift: true,
      description: 'Translate all cells',
      action: () => translateAll(),
    },
    // === 文件操作 ===
    {
      key: 's',
      ctrl: true,
      description: 'Save file',
      action: () => fileService.saveFile(),
    },
    {
      key: 's',
      ctrl: true,
      shift: true,
      description: 'Save file as',
      action: () => fileService.saveFileAs(),
    },
    {
      key: 'o',
      ctrl: true,
      description: 'Open file',
      action: () => fileService.openFile(),
    },
    {
      key: 'i',
      ctrl: true,
      shift: true,
      description: 'Import text',
      action: () => fileService.importText(),
    },
    // === 导航 ===
    {
      key: 'ArrowUp',
      description: 'Move to previous cell',
      action: () => {
        const idx = getFirstSelected()
        if (idx > 0) store.selectCell(idx - 1)
      },
    },
    {
      key: 'ArrowDown',
      description: 'Move to next cell',
      action: () => {
        const idx = getFirstSelected()
        const cellsLength = store.notebook?.cells.length ?? 0
        if (idx < cellsLength - 1) store.selectCell(idx + 1)
      },
    },
    {
      key: 'ArrowUp',
      shift: true,
      description: 'Select previous cell',
      action: () => {
        const idx = getFirstSelected()
        if (idx > 0) store.selectCellRange(idx, idx - 1)
      },
    },
    {
      key: 'ArrowDown',
      shift: true,
      description: 'Select next cell',
      action: () => {
        const idx = getFirstSelected()
        const cellsLength = store.notebook?.cells.length ?? 0
        if (idx < cellsLength - 1) store.selectCellRange(idx, idx + 1)
      },
    },
    // === 显示切换 ===
    {
      key: 'b',
      ctrl: true,
      description: 'Toggle sidebar',
      action: () => workspaceStore.toggleSidebar(),
    },
    {
      key: 'j',
      ctrl: true,
      description: 'Toggle bottom panel',
      action: () => workspaceStore.togglePanel(),
    },
  ]

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isEditing = target.closest('.tiptap') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      if (isEditing) return

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { shortcuts }
}
