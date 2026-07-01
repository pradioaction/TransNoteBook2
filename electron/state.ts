import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { PathManager, DatabaseManager } from './recitation/database'
import { RecitationDAL } from './recitation/recitationDAL'
import { StudyService } from './recitation/studyService'
import { BookService } from './recitation/bookService'
import { FileBasedConfig } from './workspace/configProvider'

// ==================== Recitation Services ====================

const _pathManager = new PathManager()
let _dbManager: DatabaseManager | null = null

export const recitationState = {
  mainWindow: null as BrowserWindow | null,
  recitationDAL: null as RecitationDAL | null,
  studyService: null as StudyService | null,
  bookService: null as BookService | null,
  workspacePath: null as string | null,
}

export function ensureRecitationServices(workspacePath: string): boolean {
  const resolvedPath = path.resolve(workspacePath)

  // 如果工作区变了，关闭旧 DB 并重新初始化
  if (_dbManager?.isInitialized()) {
    const currentWs = _pathManager.getWorkspace()
    if (currentWs && currentWs !== resolvedPath) {
      console.log(`[Recitation] Workspace changed: ${currentWs} → ${resolvedPath}`)
      _dbManager.close()
      _dbManager = null
      recitationState.recitationDAL = null
      recitationState.studyService = null
      recitationState.bookService = null
    }
  }

  _pathManager.setWorkspace(resolvedPath)

  const configProvider = new FileBasedConfig(path.join(resolvedPath, PathManager.DATA_DIR_NAME, 'studywordmode.json'))

  if (!_dbManager) {
    _dbManager = new DatabaseManager(_pathManager)
  }

  if (!_dbManager.isInitialized()) {
    if (!_dbManager.initialize()) {
      console.error(`[Recitation] Database init failed for: ${resolvedPath}`)
      return false
    }
  }

  if (!recitationState.recitationDAL) {
    recitationState.recitationDAL = new RecitationDAL(_dbManager)
  }

  if (!recitationState.studyService) {
    recitationState.studyService = new StudyService(recitationState.recitationDAL, configProvider)
  }

  if (!recitationState.bookService) {
    recitationState.bookService = new BookService(recitationState.recitationDAL, configProvider)
  }

  return true
}

// ==================== Settings Management ====================

export const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

export function getDefaultSettings() {
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
      review: '请对以下英文写作进行批改，包括语法检查、句式优化、用词建议和总体评分（满分10分）\n\n原文：\n{input}',
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
    ttsModelPath: path.join(__dirname, '../model/kokoro-int8-multi-lang-v1_0'),
    ttsSid: 0,
    ttsSidEn: 0,
    ttsSidZh: 45,
    ttsSpeed: 1.0,
  }
}

export function loadSettings(): Record<string, unknown> {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    }
  } catch { /* ignore */ }
  return getDefaultSettings()
}

export function saveSettings(settings: Record<string, unknown>) {
  try {
    const dir = path.dirname(SETTINGS_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
    return true
  } catch { return false }
}
