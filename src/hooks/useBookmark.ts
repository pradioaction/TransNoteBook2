import { useOutputStore } from '@/store/outputStore'
import { useWorkspaceConfigStore } from '@/store/workspaceConfigStore'
import { useNotebookStore } from '@/store/notebookStore'
import { parseNotebookFile, serializeNotebookFile } from '@/utils/fileUtils'
import type { NotebookCell } from '@/types/notebook'

export function useBookmark() {
  const addLog = useOutputStore((s) => s.addLog)

  const addCurrentCellToBookmark = async () => {
    const store = useNotebookStore.getState()
    const selectedIndices = [...store.selectedIndices]
    if (selectedIndices.length === 0 || !store.notebook) {
      addLog('⚠️ 请先选中一个单元格', 'warn', '#d4a017')
      return
    }

    const cellIndex = Math.max(...selectedIndices)
    const cell = store.notebook.cells[cellIndex]
    if (!cell) {
      addLog('⚠️ 选中的单元格不存在', 'warn', '#d4a017')
      return
    }

    const configStore = useWorkspaceConfigStore.getState()
    if (!configStore.loaded) {
      await configStore.load()
    }
    const filePath = configStore.bookmarkFilePath

    if (!filePath) {
      addLog(
        '⚠️ 尚未设置收藏夹。在文件管理器中右键 .transnb 文件 → "设为收藏夹"',
        'warn',
        '#d4a017',
      )
      return
    }

    const api = window.electronAPI
    if (!api) {
      addLog('❌ electronAPI 不可用', 'error', '#e06c75')
      return
    }

    // 1. 读取目标文件
    let fileContent: string
    try {
      fileContent = await api.readFile(filePath)
    } catch {
      addLog('❌ 收藏夹文件不存在，请重新设置', 'error', '#e06c75')
      return
    }

    const data = parseNotebookFile(fileContent)

    // 2. 创建收藏 Cell（只带文本，丢弃层级）
    const bookmarkCell: NotebookCell = {
      id: crypto.randomUUID(),
      type: 'markdown',
      content: cell.content,
      output: cell.output,
      parentId: null,
      indentLevel: 0,
      isCollapsed: false,
      isInputCollapsed: false,
      isOutputCollapsed: false,
    }

    // 3. 追加到末尾
    data.cells.push(bookmarkCell)

    // 4. 写回磁盘
    try {
      await api.writeFile(filePath, serializeNotebookFile(data.cells))
    } catch {
      addLog('❌ 写入收藏夹文件失败', 'error', '#e06c75')
      return
    }

    // 5. 如果目标文件恰好打开，仅刷新 openFiles 中对应的条目，不触碰当前活动文件
    const normalizedPath = filePath.replace(/\\/g, '/')
    const currentState = useNotebookStore.getState()
    if (currentState.openFiles.has(normalizedPath)) {
      const nb = currentState.openFiles.get(normalizedPath)!
      const updatedFile = { ...nb, cells: [...nb.cells, bookmarkCell], isModified: true }
      const map = new Map(currentState.openFiles)
      map.set(normalizedPath, updatedFile)
      useNotebookStore.setState({ openFiles: map })
    }

    const fileName = filePath.split(/[/\\]/).pop() || 'unknown'
    addLog(
      `✅ 已收藏到 ${fileName}（第 ${data.cells.length} 个）`,
      'info',
      '#4caf50',
    )
  }

  return { addCurrentCellToBookmark }
}
