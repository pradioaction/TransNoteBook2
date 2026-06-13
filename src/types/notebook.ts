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
}

export interface NotebookFile {
  path: string | null
  name: string
  isModified: boolean
  cells: NotebookCell[]
}

export interface NotebookStore {
  openFiles: Map<string, NotebookFile>
  activeFilePath: string | null
  selectedIndices: Set<number>
  notebook: NotebookFile | null
  openFileCount: number
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

export interface WorkspaceStore {
  workspacePath: string | null
  workspaceFiles: FileEntry[]
  recentFiles: string[]
  sidebarActiveTab: string
  sidebarVisible: boolean
  panelVisible: boolean
  setWorkspace: (path: string | null) => void
  scanWorkspaceFiles: () => Promise<void>
  addRecentFile: (path: string) => void
  setSidebarTab: (tabId: string) => void
  toggleSidebar: () => void
  togglePanel: () => void
  refreshFiles: () => Promise<void>
}

interface RecitationAPI {
  init(workspacePath: string): Promise<boolean>
  addBook(book: { name: string; path: string; count: number }): Promise<unknown>
  getBookById(bookId: number): Promise<unknown>
  getAllBooks(): Promise<unknown[]>
  deleteBook(bookId: number): Promise<boolean>
  getBookProgress(bookId: number): Promise<{ total: number; studied: number; review_due: number }>
  getAllBooksWithProgress(): Promise<unknown[]>
  importBookFromFile(filePath: string): Promise<unknown>
  getWordsByBook(bookId: number): Promise<unknown[]>
  getUnstudiedWords(bookId: number, limit?: number): Promise<unknown[]>
  getWordsForReview(bookId: number, limit?: number): Promise<unknown[]>
  searchWords(searchText: string, bookId?: number): Promise<unknown[]>
  startStudyWord(bookId: number, wordId: number): Promise<unknown>
  reviewWord(bookId: number, wordId: number, isCorrect: boolean): Promise<unknown>
  getConfig(): Promise<Record<string, unknown>>
  setConfig(key: string, value: unknown): Promise<boolean>
  getTodayWords(bookId: number, forceRefresh?: boolean): Promise<{ newWords: unknown[]; reviewWords: unknown[] }>
  refreshTodayWords(bookId: number): Promise<{ newWords: unknown[]; reviewWords: unknown[] }>
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
      readDirectory: (dirPath: string) => Promise<FileEntry[]>
      readDirectoryRecursive: (dirPath: string) => Promise<DirEntry[]>
      getSettings: () => Promise<Record<string, unknown>>
      setSettings: (settings: Record<string, unknown>) => Promise<boolean>
      onMenuAction: (callback: (action: string) => void) => void
      recitationAPI?: RecitationAPI
    }
  }
}
