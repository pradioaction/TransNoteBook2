import type { NotebookCell, NotebookFile, FileEntry, TranslationSettings, PromptTemplates, CustomModel } from '@/types/notebook'
import type { SplitMode } from '@/utils/fileUtils'

export interface ImportTextOptions {
  text: string
  filename: string
  splitMode: SplitMode
}

export interface FileService {
  openFile(filePath?: string): Promise<void>
  saveFile(): Promise<boolean>
  saveFileAs(): Promise<boolean>
  importText(): Promise<void>
  saveImportAsTransnb(options: ImportTextOptions): Promise<void>
  createFile(name?: string): Promise<void>
  deleteFile(filePath: string): Promise<void>
  renameFile(oldPath: string, newName: string): Promise<void>
}

export interface CellService {
  insertBelow(): void
  insertAbove(): void
  deleteSelected(): void
  copyCell(index: number): void
  splitCell(index: number, beforeText: string, afterText: string): void
  mergeSelected(): void
  moveCell(from: number, to: number): void
  toggleCollapse(index: number): void
  toggleInputCollapse(index: number): void
  toggleOutputCollapse(index: number): void
  toggleInputCollapseAll(): void
  toggleOutputCollapseAll(): void
  toggleDependency(index: number): void
  setDependent(childIndex: number, parentIndex: number): void
  removeDependency(index: number): void
  updateContent(index: number, content: string): void
  updateOutput(index: number, output: string): void
}

export interface TranslationStatus {
  state: 'idle' | 'translating' | 'error'
  currentIndex: number
  totalCount: number
  progress: number
  error: string | null
  cellStates: Record<number, 'pending' | 'translating' | 'done' | 'error'>
  cellErrors: Record<number, string>
  currentContent?: string
}

import type { ProviderInfo } from '@/translation/types'
export type { ProviderInfo }

export interface TranslationService {
  listProviders(): ProviderInfo[]
  setCurrentProvider(providerId: string): void
  translateCell(index: number): Promise<void>
  translateAll(): Promise<void>
  translateCells(indices: number[]): Promise<void>
  testConnection(providerId: string): Promise<{ success: boolean; error?: string }>
  getStatus(): TranslationStatus
  cancel(): void
  /** 预留接口：供背诵模块生成场景文章 */
  generateSceneText(words: string[], promptTemplate?: string): Promise<string>
}

export interface TranslationServiceDeps {
  getSettingState: () => {
    translation: TranslationSettings
    promptTemplates: PromptTemplates
    customModels: CustomModel[]
  }
  getNotebook: () => NotebookFile | null
  updateCellOutput: (index: number, output: string) => void
  setModified: (v: boolean) => void
}

export interface RecitationService {
  init(workspacePath: string): Promise<boolean>
  getBooks(): Promise<import('@/recitation/types').Book[]>
  getBookById(bookId: number): Promise<import('@/recitation/types').Book | null>
  importBook(filePath: string): Promise<import('@/recitation/types').Book | null>
  deleteBook(bookId: number): Promise<boolean>
  getBookProgress(bookId: number): Promise<import('@/recitation/types').BookProgress>
  getAllBooksWithProgress(): Promise<import('@/recitation/types').BookWithProgress[]>
  getWordsByBook(bookId: number): Promise<import('@/recitation/types').Word[]>
  getUnstudiedWords(bookId: number, limit?: number): Promise<import('@/recitation/types').Word[]>
  getWordsForReview(bookId: number, limit?: number): Promise<import('@/recitation/types').Word[]>
  searchWords(searchText: string, bookId?: number): Promise<import('@/recitation/types').Word[]>
  startStudyWord(bookId: number, wordId: number): Promise<import('@/recitation/types').UserStudy | null>
  reviewWord(bookId: number, wordId: number, isCorrect: boolean): Promise<import('@/recitation/types').UserStudy | null>
  getConfig(): Promise<Record<string, unknown>>
  setConfig(key: string, value: unknown): Promise<boolean>
  getTodayWords(bookId: number, forceRefresh?: boolean): Promise<import('@/recitation/types').TodayWordsResult>
  refreshTodayWords(bookId: number): Promise<import('@/recitation/types').TodayWordsResult>

  // === v1.4 新增 ===
  createBook(name: string, description?: string): Promise<import('@/recitation/types').Book | null>
  renameBook(bookId: number, newName: string): Promise<boolean>
  exportBook(bookId: number): Promise<boolean>
  searchBooks(keyword: string): Promise<import('@/recitation/types').Book[]>
  batchDeleteWords(bookId: number, wordIds: number[]): Promise<import('@/recitation/types').BatchOperationResult>
  batchImportWords(bookId: number): Promise<import('@/recitation/types').BatchOperationResult>
}
