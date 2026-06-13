import { contextBridge, ipcRenderer } from 'electron'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface DirEntry {
  name: string
  path: string
}

export interface ImportResult {
  filePath: string
  content: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  fileExists: (filePath: string) => ipcRenderer.invoke('file-exists', filePath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  renameFile: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('rename-file', oldPath, newPath),

  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: () => ipcRenderer.invoke('save-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  openImportDialog: () =>
    ipcRenderer.invoke('open-import-dialog') as Promise<ImportResult | null>,

  readDirectory: (dirPath: string) =>
    ipcRenderer.invoke('read-directory', dirPath) as Promise<FileEntry[]>,
  readDirectoryRecursive: (dirPath: string) =>
    ipcRenderer.invoke('read-directory-recursive', dirPath) as Promise<DirEntry[]>,

  getSettings: () => ipcRenderer.invoke('get-settings') as Promise<Record<string, unknown>>,
  setSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('set-settings', settings),

  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action))
  },
})
