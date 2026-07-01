import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { recitationState } from './state'
import { registerFileHandlers } from './handlers/fileHandlers'
import { registerDialogHandlers } from './handlers/dialogHandlers'
import { registerSettingsHandlers } from './handlers/settingsHandlers'
import { registerRecitationHandlers } from './handlers/recitationHandlers'
import { registerWorkspaceConfigHandlers } from './handlers/workspaceConfigHandlers'
import { registerTtsHandlers } from './handlers/ttsHandlers'

const isDev = !app.isPackaged

function createWindow() {
  recitationState.mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'TSBook2',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#1e1e1e',
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  const distIndex = path.join(__dirname, '../dist/index.html')

  if (isDev) {
    recitationState.mainWindow.loadURL(devServerUrl)
    recitationState.mainWindow.webContents.openDevTools()
  } else if (fs.existsSync(distIndex)) {
    recitationState.mainWindow.loadFile(distIndex)
  } else {
    recitationState.mainWindow.loadURL(devServerUrl)
    recitationState.mainWindow.webContents.openDevTools()
  }

  recitationState.mainWindow.once('ready-to-show', () => recitationState.mainWindow?.show())
  recitationState.mainWindow.on('closed', () => { recitationState.mainWindow = null })
}

function registerAllHandlers() {
  registerFileHandlers()
  registerDialogHandlers()
  registerSettingsHandlers()
  registerRecitationHandlers()
  registerWorkspaceConfigHandlers()
  registerTtsHandlers()
}

app.whenReady().then(() => {
  registerAllHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
