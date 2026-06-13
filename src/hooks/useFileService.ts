import { useNotebookStore } from '@/store/notebookStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useSettingStore } from '@/store/settingStore'
import { parseNotebookFile, serializeNotebookFile, splitTextIntoParagraphs } from '@/utils/fileUtils'
import type { FileService } from '@/services/types'
import type { NotebookCell } from '@/types/notebook'

export function useFileService(): FileService {
  const notebookStore = useNotebookStore()
  const workspaceStore = useWorkspaceStore()
  const settingStore = useSettingStore()
  const api = window.electronAPI

  const openFile = async (filePath?: string) => {
    if (!api) return
    const fp = filePath || await api.openFileDialog()
    if (!fp) return
    const content = await api.readFile(fp)
    const data = parseNotebookFile(content)
    const name = fp.split(/[/\\]/).pop() || 'untitled.transnb'
    notebookStore.openFile({ path: fp, name, isModified: false, cells: data.cells })
    workspaceStore.addRecentFile(fp)
    settingStore.setLastOpenFilePath(fp)
    settingStore.addRecentFile(fp)
  }

  const saveFile = async (): Promise<boolean> => {
    if (!api) return false
    const nb = notebookStore.notebook
    if (!nb) return false
    if (nb.path) {
      await api.writeFile(nb.path, serializeNotebookFile(nb.cells))
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
    await api.writeFile(p, serializeNotebookFile(nb.cells))
    notebookStore.setFilePath(p)
    notebookStore.setModified(false)
    workspaceStore.addRecentFile(p)
    settingStore.setLastOpenFilePath(p)
    settingStore.addRecentFile(p)
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

  const createFile = async () => {
    if (!api) return
    const savePath = await api.saveFileDialog()
    if (!savePath) return
    const emptyJson = serializeNotebookFile([])
    await api.writeFile(savePath, emptyJson)
    const name = savePath.split(/[/\\]/).pop() || 'new.transnb'
    notebookStore.openFile({ path: savePath, name, isModified: false, cells: [] })
    workspaceStore.addRecentFile(savePath)
    settingStore.setLastOpenFilePath(savePath)
    settingStore.addRecentFile(savePath)
    workspaceStore.refreshFiles()
  }

  const deleteFile = async (filePath: string) => {
    if (!api) return
    await api.deleteFile(filePath)
    const key = filePath
    if (notebookStore.openFiles.has(key)) {
      notebookStore.closeFile(key)
    }
    workspaceStore.refreshFiles()
  }

  const renameFile = async (oldPath: string, newName: string) => {
    if (!api) return
    const dir = oldPath.substring(0, Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')))
    const newPath = dir + '/' + newName
    await api.renameFile(oldPath, newPath)
    workspaceStore.refreshFiles()
  }

  return { openFile, saveFile, saveFileAs, importText, createFile, deleteFile, renameFile }
}
