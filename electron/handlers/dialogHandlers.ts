import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import { recitationState } from '../state'

export function registerDialogHandlers() {
  ipcMain.handle('open-file-dialog', async () => {
    if (!recitationState.mainWindow) return null
    const result = await dialog.showOpenDialog(recitationState.mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Translation Notebook', extensions: ['transnb'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('save-file-dialog', async () => {
    if (!recitationState.mainWindow) return null
    const result = await dialog.showSaveDialog(recitationState.mainWindow, {
      filters: [
        { name: 'Translation Notebook', extensions: ['transnb'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      defaultPath: 'untitled.transnb',
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('open-folder-dialog', async () => {
    if (!recitationState.mainWindow) return null
    const result = await dialog.showOpenDialog(recitationState.mainWindow, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('open-import-dialog', async () => {
    if (!recitationState.mainWindow) return null
    const result = await dialog.showOpenDialog(recitationState.mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md', 'html', 'htm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (result.canceled) return null
    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return { filePath, content }
  })

  ipcMain.handle('open-book-dialog', async () => {
    if (!recitationState.mainWindow) return null
    const result = await dialog.showOpenDialog(recitationState.mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'JSON Book Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
