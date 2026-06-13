import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'path'
import fs from 'fs'

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

function getDefaultSettings() {
  return {
    theme: 'dark',
    readingFontSize: 14,
    translation: {
      enabled: false,
      currentProvider: 'system_Ollama',
      ollama: { baseUrl: 'http://localhost:11434', model: 'qwen2.5:0.5b' },
      openai: {
        apiKeyEnv: 'OPENAI_API_KEY',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        timeout: 60,
        proxy: '',
      },
    },
    promptTemplates: {
      translation: '请翻译{input}',
      analysis: '请解析{input}',
      scenery: '请完成一篇包含{input}的文章',
    },
    customModels: [] as Array<{
      name: string
      apiKeyEnv: string
      endpoint: string
      model: string
      timeout: number
      backend: string
      enabled: boolean
    }>,
    recentFiles: [] as string[],
    envVars: [] as Array<{ name: string; description: string }>,
  }
}

function loadSettings(): Record<string, unknown> {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    }
  } catch { /* ignore */ }
  return getDefaultSettings()
}

function saveSettings(settings: Record<string, unknown>) {
  try {
    const dir = path.dirname(SETTINGS_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
    return true
  } catch { return false }
}

function createWindow() {
  mainWindow = new BrowserWindow({
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
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools()
  } else if (fs.existsSync(distIndex)) {
    mainWindow.loadFile(distIndex)
  } else {
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools()
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

function registerIpcHandlers() {
  ipcMain.handle('read-file', async (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8')
  })

  ipcMain.handle('write-file', async (_event, filePath: string, content: string) => {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('file-exists', async (_event, filePath: string) => {
    return fs.existsSync(filePath)
  })

  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return true
  })

  ipcMain.handle('rename-file', async (_event, oldPath: string, newPath: string) => {
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath)
    return true
  })

  ipcMain.handle('open-file-dialog', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Translation Notebook', extensions: ['transnb'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('save-file-dialog', async () => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: 'Translation Notebook', extensions: ['transnb'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      defaultPath: 'untitled.transnb',
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('open-folder-dialog', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('open-import-dialog', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
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

  ipcMain.handle('read-directory', async (_event, dirPath: string) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      return entries
        .filter((e) => e.name.endsWith('.transnb') || e.isDirectory())
        .map((e) => ({
          name: e.name,
          path: path.join(dirPath, e.name),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
    } catch {
      return []
    }
  })

  ipcMain.handle('read-directory-recursive', async (_event, dirPath: string) => {
    const result: Array<{ name: string; path: string }> = []
    try {
      function walk(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const e of entries) {
          const fullPath = path.join(dir, e.name)
          if (e.isDirectory()) {
            walk(fullPath)
          } else if (e.name.endsWith('.transnb')) {
            result.push({ name: e.name, path: fullPath })
          }
        }
      }
      walk(dirPath)
    } catch { /* ignore */ }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  })

  ipcMain.handle('get-settings', async () => {
    return loadSettings()
  })

  ipcMain.handle('set-settings', async (_event, settings: Record<string, unknown>) => {
    saveSettings(settings)
    return true
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
