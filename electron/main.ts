import { app, BrowserWindow, ipcMain, dialog, Menu, clipboard } from 'electron'
import path from 'path'
import fs from 'fs'
import { PathManager, DatabaseManager } from './recitation/database'
import { RecitationDAL } from './recitation/recitationDAL'
import { StudyService } from './recitation/studyService'
import { BookService } from './recitation/bookService'

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null

// ==================== 背诵模式服务 ====================
const _pathManager = new PathManager()
let _dbManager: DatabaseManager | null = null
let _recitationDAL: RecitationDAL | null = null
let _studyService: StudyService | null = null
let _bookService: BookService | null = null

function ensureRecitationServices(workspacePath: string): boolean {
  const resolvedPath = path.resolve(workspacePath)

  // 如果工作区变了，关闭旧 DB 并重新初始化
  if (_dbManager?.isInitialized()) {
    const currentWs = _pathManager.getWorkspace()
    if (currentWs && currentWs !== resolvedPath) {
      console.log(`[Recitation] Workspace changed: ${currentWs} → ${resolvedPath}`)
      _dbManager.close()
      _dbManager = null
      _recitationDAL = null
      _studyService = null
      _bookService = null
    }
  }

  _pathManager.setWorkspace(resolvedPath)

  if (!_dbManager) {
    _dbManager = new DatabaseManager(_pathManager)
  }

  if (!_dbManager.isInitialized()) {
    if (!_dbManager.initialize()) {
      console.error(`[Recitation] Database init failed for: ${resolvedPath}`)
      return false
    }
  }

  if (!_recitationDAL) {
    _recitationDAL = new RecitationDAL(_dbManager)
  }

  if (!_studyService) {
    _studyService = new StudyService(_recitationDAL, _pathManager)
  }

  if (!_bookService) {
    _bookService = new BookService(_recitationDAL, _pathManager)
  }

  return true
}

// ==================== 设置管理 ====================

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

  ipcMain.handle('open-book-dialog', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'JSON Book Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('read-clipboard', async () => {
    return clipboard.readText()
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

  // ==================== 背诵模式 IPC ====================

  ipcMain.handle('recitation:init', async (_event, workspacePath: string) => {
    try {
      const ok = ensureRecitationServices(workspacePath)
      return { success: ok, error: ok ? undefined : 'Database initialization failed (check terminal for details)' }
    } catch (err: any) {
      console.error('[Recitation] init threw:', err)
      return { success: false, error: String(err?.message ?? err) }
    }
  })

  ipcMain.handle('recitation:add-book', async (_event, book: { name: string; path: string; count: number }) => {
    if (!_recitationDAL) return null
    return _recitationDAL.addBook(book)
  })

  ipcMain.handle('recitation:get-book-by-id', async (_event, bookId: number) => {
    if (!_recitationDAL) return null
    return _recitationDAL.getBookById(bookId)
  })

  ipcMain.handle('recitation:get-all-books', async () => {
    if (!_recitationDAL) return []
    return _recitationDAL.getAllBooks()
  })

  ipcMain.handle('recitation:delete-book', async (_event, bookId: number) => {
    if (!_bookService) return false
    return _bookService.deleteBook(bookId)
  })

  ipcMain.handle('recitation:get-book-progress', async (_event, bookId: number) => {
    if (!_recitationDAL) return { total: 0, studied: 0, review_due: 0 }
    return _recitationDAL.getBookProgress(bookId)
  })

  ipcMain.handle('recitation:get-all-books-with-progress', async () => {
    if (!_bookService) return []
    return _bookService.getAllBooksWithProgress()
  })

  ipcMain.handle('recitation:import-book-from-file', async (_event, filePath: string) => {
    if (!_bookService) return null
    return _bookService.importBook(filePath)
  })

  ipcMain.handle('recitation:get-words-by-book', async (_event, bookId: number) => {
    if (!_recitationDAL) return []
    return _recitationDAL.getWordsByBookId(bookId)
  })

  ipcMain.handle('recitation:get-unstudied-words', async (_event, bookId: number, limit?: number) => {
    if (!_recitationDAL) return []
    return _recitationDAL.getUnstudiedWords(bookId, limit)
  })

  ipcMain.handle('recitation:get-words-for-review', async (_event, bookId: number, limit?: number) => {
    if (!_recitationDAL) return []
    return _recitationDAL.getWordsForReview(bookId, limit)
  })

  ipcMain.handle('recitation:search-words', async (_event, searchText: string, bookId?: number) => {
    if (!_recitationDAL) return []
    return _recitationDAL.searchWords(searchText, bookId)
  })

  ipcMain.handle('recitation:start-study-word', async (_event, bookId: number, wordId: number) => {
    if (!_studyService) return null
    return _studyService.startStudyWord(bookId, wordId)
  })

  ipcMain.handle('recitation:review-word', async (_event, bookId: number, wordId: number, isCorrect: boolean) => {
    if (!_studyService) return null
    return _studyService.reviewWord(bookId, wordId, isCorrect)
  })

  ipcMain.handle('recitation:get-config', async () => {
    if (!_studyService) return {}
    return _studyService.getConfig()
  })

  ipcMain.handle('recitation:set-config', async (_event, key: string, value: unknown) => {
    if (!_studyService) return false
    _studyService.setConfig(key, value)
    return true
  })

  ipcMain.handle('recitation:get-today-words', async (_event, bookId: number, forceRefresh?: boolean) => {
    if (!_studyService) return { newWords: [], reviewWords: [] }
    return _studyService.getTodayWords(bookId, forceRefresh)
  })

  ipcMain.handle('recitation:refresh-today-words', async (_event, bookId: number) => {
    if (!_studyService) return { newWords: [], reviewWords: [] }
    return _studyService.refreshTodayWords(bookId)
  })

  ipcMain.handle('recitation:mark-words-as-tested', async (_event, bookId: number, testedNewIds: number[], testedReviewIds: number[]) => {
    if (!_studyService) return false
    _studyService.markWordsAsTested(bookId, testedNewIds, testedReviewIds)
    return true
  })

  ipcMain.handle('recitation:add-word', async (_event, bookId: number, word: { word: string; phonetic: string; definition: string; example: string }) => {
    if (!_recitationDAL) return null
    return _recitationDAL.addWord({ ...word, book_id: bookId, raw_data: '' })
  })

  ipcMain.handle('recitation:update-word', async (_event, wordId: number, word: { word: string; phonetic: string; definition: string; example: string }) => {
    if (!_recitationDAL) return false
    return _recitationDAL.updateWord({ id: wordId, ...word, raw_data: '' })
  })

  ipcMain.handle('recitation:delete-word', async (_event, wordId: number) => {
    if (!_recitationDAL) return false
    return _recitationDAL.deleteWord(wordId)
  })

  ipcMain.handle('recitation:get-stage-distribution', async (_event, bookId: number) => {
    if (!_recitationDAL) return { unstudied: 0, stage0: 0, stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0, stage6: 0, stage7: 0, stage8: 0 }
    return _recitationDAL.getStageDistribution(bookId)
  })

  ipcMain.handle('recitation:get-overall-stage-distribution', async () => {
    if (!_recitationDAL) return { unstudied: 0, stage0: 0, stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0, stage6: 0, stage7: 0, stage8: 0 }
    return _recitationDAL.getOverallStageDistribution()
  })

  ipcMain.handle('recitation:get-words-by-stage', async (_event, bookId: number, minStage: number, maxStage: number) => {
    if (!_recitationDAL) return []
    return _recitationDAL.getWordsByStage(bookId, minStage, maxStage)
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
