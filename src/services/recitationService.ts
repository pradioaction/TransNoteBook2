import type { Book, Word, UserStudy, BookProgress, BookWithProgress, TodayWordsResult } from '@/recitation/types'

export interface RecitationService {
  init(workspacePath: string): Promise<boolean>
  getBooks(): Promise<Book[]>
  getBookById(bookId: number): Promise<Book | null>
  importBook(filePath: string): Promise<Book | null>
  deleteBook(bookId: number): Promise<boolean>
  getBookProgress(bookId: number): Promise<BookProgress>
  getAllBooksWithProgress(): Promise<BookWithProgress[]>
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
  addWord(bookId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<Word | null>
  updateWord(wordId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<boolean>
  deleteWord(wordId: number): Promise<boolean>
}

export function createRecitationService(): RecitationService {
  const api = () => window.electronAPI?.recitationAPI

  return {
    init: async (workspacePath: string) => {
      return (await api()?.init(workspacePath)) ?? false
    },

    getBooks: async () => {
      return (await api()?.getAllBooks()) ?? []
    },

    getBookById: async (bookId: number) => {
      return (await api()?.getBookById(bookId)) ?? null
    },

    importBook: async (filePath: string) => {
      return (await api()?.importBookFromFile(filePath)) ?? null
    },

    deleteBook: async (bookId: number) => {
      return (await api()?.deleteBook(bookId)) ?? false
    },

    getBookProgress: async (bookId: number) => {
      return (await api()?.getBookProgress(bookId)) ?? { total: 0, studied: 0, review_due: 0 }
    },

    getAllBooksWithProgress: async () => {
      return (await api()?.getAllBooksWithProgress()) ?? []
    },

    getWordsByBook: async (bookId: number) => {
      return (await api()?.getWordsByBook(bookId)) ?? []
    },

    getUnstudiedWords: async (bookId: number, limit?: number) => {
      return (await api()?.getUnstudiedWords(bookId, limit)) ?? []
    },

    getWordsForReview: async (bookId: number, limit?: number) => {
      return (await api()?.getWordsForReview(bookId, limit)) ?? []
    },

    searchWords: async (searchText: string, bookId?: number) => {
      return (await api()?.searchWords(searchText, bookId)) ?? []
    },

    startStudyWord: async (bookId: number, wordId: number) => {
      return (await api()?.startStudyWord(bookId, wordId)) ?? null
    },

    reviewWord: async (bookId: number, wordId: number, isCorrect: boolean) => {
      return (await api()?.reviewWord(bookId, wordId, isCorrect)) ?? null
    },

    getConfig: async () => {
      return (await api()?.getConfig()) ?? {}
    },

    setConfig: async (key: string, value: unknown) => {
      return (await api()?.setConfig(key, value)) ?? false
    },

    getTodayWords: async (bookId: number, forceRefresh?: boolean) => {
      return (await api()?.getTodayWords(bookId, forceRefresh)) ?? { newWords: [], reviewWords: [] }
    },

    refreshTodayWords: async (bookId: number) => {
      return (await api()?.refreshTodayWords(bookId)) ?? { newWords: [], reviewWords: [] }
    },

    addWord: async (bookId: number, word: { word: string; phonetic: string; definition: string; example: string }) => {
      return (await api()?.addWord(bookId, word)) ?? null
    },

    updateWord: async (wordId: number, word: { word: string; phonetic: string; definition: string; example: string }) => {
      return (await api()?.updateWord(wordId, word)) ?? false
    },

    deleteWord: async (wordId: number) => {
      return (await api()?.deleteWord(wordId)) ?? false
    },
  }
}
