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
}

export function createRecitationService(): RecitationService {
  const api = () => window.electronAPI?.recitationAPI

  return {
    init: async (workspacePath: string) => {
      return (await api()?.init(workspacePath)) as boolean ?? false
    },

    getBooks: async () => {
      return (await api()?.getAllBooks()) as Book[] ?? []
    },

    getBookById: async (bookId: number) => {
      return (await api()?.getBookById(bookId)) as Book | null ?? null
    },

    importBook: async (filePath: string) => {
      return (await api()?.importBookFromFile(filePath)) as Book | null ?? null
    },

    deleteBook: async (bookId: number) => {
      return (await api()?.deleteBook(bookId)) as boolean ?? false
    },

    getBookProgress: async (bookId: number) => {
      return (await api()?.getBookProgress(bookId)) as BookProgress ?? { total: 0, studied: 0, review_due: 0 }
    },

    getAllBooksWithProgress: async () => {
      return (await api()?.getAllBooksWithProgress()) as BookWithProgress[] ?? []
    },

    getWordsByBook: async (bookId: number) => {
      return (await api()?.getWordsByBook(bookId)) as Word[] ?? []
    },

    getUnstudiedWords: async (bookId: number, limit?: number) => {
      return (await api()?.getUnstudiedWords(bookId, limit)) as Word[] ?? []
    },

    getWordsForReview: async (bookId: number, limit?: number) => {
      return (await api()?.getWordsForReview(bookId, limit)) as Word[] ?? []
    },

    searchWords: async (searchText: string, bookId?: number) => {
      return (await api()?.searchWords(searchText, bookId)) as Word[] ?? []
    },

    startStudyWord: async (bookId: number, wordId: number) => {
      return (await api()?.startStudyWord(bookId, wordId)) as UserStudy | null ?? null
    },

    reviewWord: async (bookId: number, wordId: number, isCorrect: boolean) => {
      return (await api()?.reviewWord(bookId, wordId, isCorrect)) as UserStudy | null ?? null
    },

    getConfig: async () => {
      return (await api()?.getConfig()) as Record<string, unknown> ?? {}
    },

    setConfig: async (key: string, value: unknown) => {
      return (await api()?.setConfig(key, value)) as boolean ?? false
    },

    getTodayWords: async (bookId: number, forceRefresh?: boolean) => {
      const result = await api()?.getTodayWords(bookId, forceRefresh)
      if (result && 'newWords' in result) {
        return result as unknown as TodayWordsResult
      }
      return { new_words: [], review_words: [] }
    },

    refreshTodayWords: async (bookId: number) => {
      const result = await api()?.refreshTodayWords(bookId)
      if (result && 'newWords' in result) {
        return result as unknown as TodayWordsResult
      }
      return { new_words: [], review_words: [] }
    },
  }
}
