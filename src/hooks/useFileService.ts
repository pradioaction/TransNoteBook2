import { useNotebookStore } from '@/store/notebookStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { parseNotebookFile, serializeNotebookFile, splitTextIntoParagraphs } from '@/utils/fileUtils'
import type { FileService, ImportTextOptions } from '@/services/types'
import type { NotebookCell } from '@/types/notebook'

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

export function useFileService(): FileService {
  const notebookStore = useNotebookStore()
  const workspaceStore = useWorkspaceStore()
  const api = window.electronAPI

  const openFile = async (filePath?: string) => {
    if (!api) return
    const fp = filePath || await api.openFileDialog()
    if (!fp) return
    const content = await api.readFile(fp)
    const data = parseNotebookFile(content)
    const normalizedPath = normalizePath(fp)
    const name = normalizedPath.split('/').pop() || 'untitled.transnb'
    notebookStore.openFile({ path: normalizedPath, name, isModified: false, cells: data.cells, wordMeta: data.wordMeta })
  }

  const saveFile = async (): Promise<boolean> => {
    if (!api) return false
    const nb = notebookStore.notebook
    if (!nb) return false
    if (nb.path) {
      await api.writeFile(nb.path, serializeNotebookFile(nb.cells, nb.wordMeta))
      notebookStore.setModified(false)
      workspaceStore.refreshFiles()
      return true
    }
    return await saveFileAs()
  }

  const saveFileAs = async (): Promise<boolean> => {
    if (!api) return false
    const p = await api.saveFileDialog()
    if (!p) return false
    const nb = notebookStore.notebook
    if (!nb) return false
    const normalizedPath = normalizePath(p)
    await api.writeFile(p, serializeNotebookFile(nb.cells, nb.wordMeta))
    notebookStore.setFilePath(normalizedPath)
    notebookStore.setModified(false)
    workspaceStore.refreshFiles()
    return true
  }

  const importText = async () => {
    if (!api) return
    const result = await api.openImportDialog()
    if (!result) return
    const paras = splitTextIntoParagraphs(result.content)
    const cells: NotebookCell[] = paras.map((t) => ({
      id: crypto.randomUUID(), type: 'markdown' as const,
      content: t, output: '', parentId: null, indentLevel: 0,
      isCollapsed: false, isInputCollapsed: false, isOutputCollapsed: false,
    }))
    const name = result.filePath.split(/[/\\]/).pop()?.replace(/\.(txt|md|html|htm)$/i, '') || 'imported'
    notebookStore.openFile({ path: null, name: `${name}.transnb`, isModified: true, cells })
  }

  const saveImportAsTransnb = async ({ text, filename, splitMode }: ImportTextOptions) => {
    if (!api) return
    const paras = splitTextIntoParagraphs(text, splitMode)
    const cells: NotebookCell[] = paras.map((t) => ({
      id: crypto.randomUUID(), type: 'markdown' as const,
      content: t, output: '', parentId: null, indentLevel: 0,
      isCollapsed: false, isInputCollapsed: false, isOutputCollapsed: false,
    }))

    // 解析相对路径，直接保存到工作区
    const ws = workspaceStore.workspacePath
    if (ws) {
      // 去掉开头的 ./ 或 .\，保留用户指定的子目录
      let cleanName = filename.trim()
      if (cleanName.startsWith('./') || cleanName.startsWith('.\\')) {
        cleanName = cleanName.slice(2)
      }
      if (!cleanName) cleanName = 'imported'
      // 确保有 .transnb 后缀
      if (!cleanName.endsWith('.transnb')) cleanName += '.transnb'
      // 标准化路径分隔符并拼接到工作区路径
      const normalized = cleanName.replace(/\\/g, '/')
      const savePath = ws.replace(/\\/g, '/') + '/' + normalized
      await api.writeFile(savePath, serializeNotebookFile(cells))
      const name = normalized.split('/').pop() || cleanName
      notebookStore.openFile({ path: savePath, name, isModified: false, cells })
      workspaceStore.refreshFiles()
    } else {
      // 没有工作区时回退到保存对话框
      const savePath = await api.saveFileDialog()
      if (!savePath) return
      await api.writeFile(savePath, serializeNotebookFile(cells))
      const name = savePath.split(/[/\\]/).pop() || `${filename}.transnb`
      notebookStore.openFile({ path: savePath, name, isModified: false, cells })
      workspaceStore.refreshFiles()
    }
  }

  const createFile = async () => {
    if (!api) return
    const savePath = await api.saveFileDialog()
    if (!savePath) return
    const normalizedPath = normalizePath(savePath)
    const emptyJson = serializeNotebookFile([])
    await api.writeFile(savePath, emptyJson)
    const name = normalizedPath.split('/').pop() || 'new.transnb'
    notebookStore.openFile({ path: normalizedPath, name, isModified: false, cells: [] })
    workspaceStore.refreshFiles()
  }

  const deleteFile = async (filePath: string) => {
    if (!api) return
    await api.deleteFile(filePath)
    const key = normalizePath(filePath)
    if (notebookStore.openFiles.has(key)) {
      notebookStore.closeFile(key)
    }
    workspaceStore.refreshFiles()
  }

  const renameFile = async (oldPath: string, newName: string) => {
    if (!api) return
    const normalizedOld = normalizePath(oldPath)
    const dir = normalizedOld.substring(0, normalizedOld.lastIndexOf('/'))
    const newPath = dir + '/' + newName
    await api.renameFile(oldPath, newPath)
    // 如果重命名的文件在 openFiles 中，更新其 key
    const normalizedNew = normalizePath(newPath)
    const oldKey = normalizedOld
    if (notebookStore.openFiles.has(oldKey)) {
      const file = notebookStore.openFiles.get(oldKey)!
      const updatedFile = { ...file, path: normalizedNew, name: newName }
      const newKey = normalizedNew
      const map = new Map(notebookStore.openFiles)
      map.delete(oldKey)
      map.set(newKey, updatedFile)
      useNotebookStore.setState({
        openFiles: map,
        activeFilePath: notebookStore.activeFilePath === oldKey ? newKey : notebookStore.activeFilePath,
        notebook: notebookStore.notebook?.path === normalizedOld ? updatedFile : notebookStore.notebook,
      })
    }
    workspaceStore.refreshFiles()
  }

  return { openFile, saveFile, saveFileAs, importText, saveImportAsTransnb, createFile, deleteFile, renameFile }
}
