import type { FileEntry, DirEntry, ImportResult } from './electron'
export type { FileEntry, DirEntry, ImportResult }
import type { Book, Word, UserStudy, BookProgress, BookWithProgress, TodayWordsResult, StageDistribution } from '@/recitation/types'

export interface NotebookCell {
  id: string
  type: 'markdown'
  content: string
  output: string
  parentId: string | null
  indentLevel: number
  isCollapsed: boolean
  isInputCollapsed: boolean
  isOutputCollapsed: boolean
}

export interface NotebookData {
  version: string
  cells: NotebookCell[]
  wordMeta?: ArticleWordMeta
}

export interface ArticleWordMeta {
  bookId: number
  bookName: string
  newWords: { id: number; word: string }[]
  reviewWords: { id: number; word: string }[]
}

export interface NotebookFile {
  path: string | null
  name: string
  isModified: boolean
  cells: NotebookCell[]
  wordMeta?: ArticleWordMeta
}

export interface NotebookStore {
  openFiles: Map<string, NotebookFile>
  activeFilePath: string | null
  selectedIndices: Set<number>
  notebook: NotebookFile | null
  openFileCount: number
  _onFileOpened: ((path: string) => void) | null
  setOnFileOpened: (cb: ((path: string) => void) | null) => void
  openFile: (file: NotebookFile) => void
  closeFile: (key: string) => void
  switchToFile: (key: string) => void
  setNotebook: (notebook: NotebookFile) => void
  setCells: (cells: NotebookCell[]) => void
  setFilePath: (path: string | null) => void
  setModified: (modified: boolean) => void
  selectCell: (index: number) => void
  selectCellRange: (from: number, to: number) => void
  toggleCellSelection: (index: number) => void
  clearSelection: () => void
  updateCellContent: (index: number, content: string) => void
  updateCellOutput: (index: number, output: string) => void
}

export interface ThemeConfig {
  foreground: string
  background: string
  editorBackground: string
  editorForeground: string
  border: string
  sidebarBackground: string
  sidebarHeader: string
  sidebarBorder: string
  activityBarBackground: string
  activityBarForeground: string
  activityBarActiveBorder: string
  statusBarBackground: string
  statusBarForeground: string
  cellBackground: string
  cellSelectedBackground: string
  cellBorder: string
  cellOutputBackground: string
  cellOutputBorder: string
  cellGutter: string
  toolbarBackground: string
  toolbarHover: string
  primaryButton: string
  primaryButtonHover: string
  errorBackground: string
  errorBorder: string
  errorText: string
  scrollbar: string
  inputBackground: string
  inputBorder: string
  panelBackground: string
  panelBorder: string
  listItemHover: string
  listItemSelected: string

  // === 背诵模式 ===
  recitationBackground: string
  recitationSidebarBackground: string
  recitationSidebarBorder: string
  quizCardBackground: string
  quizCardBorder: string
  quizOptionBackground: string
  quizOptionHover: string
  quizOptionSelected: string
  quizOptionCorrect: string
  quizOptionWrong: string
  wordNewColor: string
  wordReviewBatch0: string
  wordReviewBatch1: string
  wordReviewBatch2: string
  wordReviewBatch3: string
  wordCorrectBackground: string
  wordWrongBackground: string
  bookProgressBarFill: string
  bookProgressBarTrack: string

  // === 背诵阶段颜色（6 阶段） ===
  stageUnstudied: string
  stageBeginner: string
  stageReview: string
  stageConsolidate: string
  stageProficient: string
  stageMastered: string
}

export interface ThemeStore {
  theme: 'light' | 'dark'
  colors: ThemeConfig
  setTheme: (theme: 'light' | 'dark') => void
  getColors: () => ThemeConfig
}

export interface TranslationSettings {
  enabled: boolean
  currentProvider: string
  ollama: { baseUrl: string; model: string }
  openai: { apiKeyEnv: string; baseUrl: string; model: string; timeout: number; proxy: string }
}

export interface CustomModel {
  name: string
  apiKeyEnv: string
  endpoint: string
  model: string
  timeout: number
  backend: string
  enabled: boolean
}

export interface EnvVar {
  name: string
  value: string
  description: string
}

export interface PromptTemplates {
  translation: string
  analysis: string
  scenery: string
}

export interface AppSettings {
  theme: string
  readingFontSize: number
  cellWidthRatio: number
  translation: TranslationSettings
  promptTemplates: PromptTemplates
  customModels: CustomModel[]
  recentFiles: string[]
  envVars: EnvVar[]
}

interface RecitationAPI {
  init(workspacePath: string): Promise<boolean>
  addBook(book: { name: string; path: string; count: number }): Promise<Book | null>
  getBookById(bookId: number): Promise<Book | null>
  getAllBooks(): Promise<Book[]>
  deleteBook(bookId: number): Promise<boolean>
  getBookProgress(bookId: number): Promise<BookProgress>
  getAllBooksWithProgress(): Promise<BookWithProgress[]>
  importBookFromFile(filePath: string): Promise<Book | null>
  getWordsByBook(bookId: number): Promise<Word[]>
  getUnstudiedWords(bookId: number, limit?: number): Promise<Word[]>
  getWordsForReview(bookId: number, limit?: number): Promise<Word[]>
  searchWords(searchText: string, bookId?: number): Promise<Word[]>
  startStudyWord(bookId: number, wordId: number): Promise<UserStudy | null>
  reviewWord(bookId: number, wordId: number, isCorrect: boolean): Promise<UserStudy | null>
  getConfig(): Promise<Record<string, unknown>>
  setConfig(key: string, value: unknown): Promise<boolean>
  getTodayWords(bookId: number, forceRefresh?: boolean): Promise<TodayWordsResult>
  refreshTodayWords(bookId: number): Promise<TodayWordsResult>
  markWordsAsTested(bookId: number, testedNewIds: number[], testedReviewIds: number[]): Promise<boolean>
  addWord(bookId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<Word | null>
  updateWord(wordId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<boolean>
  deleteWord(wordId: number): Promise<boolean>
  getStageDistribution(bookId: number): Promise<StageDistribution>
  getOverallStageDistribution(): Promise<StageDistribution>
  getWordsByStage(bookId: number, minStage: number, maxStage: number): Promise<Word[]>
}

declare global {
  interface Window {
    electronAPI?: {
      readFile: (filePath: string) => Promise<string>
      writeFile: (filePath: string, content: string) => Promise<boolean>
      fileExists: (filePath: string) => Promise<boolean>
      deleteFile: (filePath: string) => Promise<boolean>
      renameFile: (oldPath: string, newPath: string) => Promise<boolean>
      openFileDialog: () => Promise<string | null>
      saveFileDialog: () => Promise<string | null>
      openFolderDialog: () => Promise<string | null>
      openImportDialog: () => Promise<ImportResult | null>
      openBookDialog: () => Promise<string | null>
      readClipboard: () => Promise<string>
      readDirectory: (dirPath: string) => Promise<FileEntry[]>
      readDirectoryRecursive: (dirPath: string) => Promise<DirEntry[]>
      getSettings: () => Promise<Record<string, unknown>>
      setSettings: (settings: Record<string, unknown>) => Promise<boolean>
      onMenuAction: (callback: (action: string) => void) => void
      recitationAPI?: RecitationAPI
    }
  }
}
