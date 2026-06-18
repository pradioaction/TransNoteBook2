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
  openBookDialog: () =>
    ipcRenderer.invoke('open-book-dialog') as Promise<string | null>,
  readClipboard: () =>
    ipcRenderer.invoke('read-clipboard') as Promise<string>,

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

  // ==================== 背诵模式 API ====================
  recitationAPI: {
    init: (workspacePath: string) => ipcRenderer.invoke('recitation:init', workspacePath),
    addBook: (book: { name: string; path: string; count: number }) =>
      ipcRenderer.invoke('recitation:add-book', book),
    getBookById: (bookId: number) => ipcRenderer.invoke('recitation:get-book-by-id', bookId),
    getAllBooks: () => ipcRenderer.invoke('recitation:get-all-books'),
    deleteBook: (bookId: number) => ipcRenderer.invoke('recitation:delete-book', bookId),
    getBookProgress: (bookId: number) => ipcRenderer.invoke('recitation:get-book-progress', bookId),
    getAllBooksWithProgress: () => ipcRenderer.invoke('recitation:get-all-books-with-progress'),
    importBookFromFile: (filePath: string) => ipcRenderer.invoke('recitation:import-book-from-file', filePath),
    getWordsByBook: (bookId: number) => ipcRenderer.invoke('recitation:get-words-by-book', bookId),
    getUnstudiedWords: (bookId: number, limit?: number) =>
      ipcRenderer.invoke('recitation:get-unstudied-words', bookId, limit),
    getWordsForReview: (bookId: number, limit?: number) =>
      ipcRenderer.invoke('recitation:get-words-for-review', bookId, limit),
    searchWords: (searchText: string, bookId?: number) =>
      ipcRenderer.invoke('recitation:search-words', searchText, bookId),
    startStudyWord: (bookId: number, wordId: number) =>
      ipcRenderer.invoke('recitation:start-study-word', bookId, wordId),
    reviewWord: (bookId: number, wordId: number, isCorrect: boolean) =>
      ipcRenderer.invoke('recitation:review-word', bookId, wordId, isCorrect),
    getConfig: () => ipcRenderer.invoke('recitation:get-config'),
    setConfig: (key: string, value: unknown) =>
      ipcRenderer.invoke('recitation:set-config', key, value),
    getTodayWords: (bookId: number, forceRefresh?: boolean) =>
      ipcRenderer.invoke('recitation:get-today-words', bookId, forceRefresh),
    refreshTodayWords: (bookId: number) =>
      ipcRenderer.invoke('recitation:refresh-today-words', bookId),
    markWordsAsTested: (bookId: number, testedNewIds: number[], testedReviewIds: number[]) =>
      ipcRenderer.invoke('recitation:mark-words-as-tested', bookId, testedNewIds, testedReviewIds),
    addWord: (bookId: number, word: { word: string; phonetic: string; definition: string; example: string }) =>
      ipcRenderer.invoke('recitation:add-word', bookId, word),
    updateWord: (wordId: number, word: { word: string; phonetic: string; definition: string; example: string }) =>
      ipcRenderer.invoke('recitation:update-word', wordId, word),
    deleteWord: (wordId: number) =>
      ipcRenderer.invoke('recitation:delete-word', wordId),
    getStageDistribution: (bookId: number) =>
      ipcRenderer.invoke('recitation:get-stage-distribution', bookId),
    getOverallStageDistribution: () =>
      ipcRenderer.invoke('recitation:get-overall-stage-distribution'),
    getWordsByStage: (bookId: number, minStage: number, maxStage: number) =>
      ipcRenderer.invoke('recitation:get-words-by-stage', bookId, minStage, maxStage),
  },
})
