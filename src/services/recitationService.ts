import type { Book, Word, UserStudy, BookProgress, BookWithProgress, TodayWordsResult, StageDistribution, BatchOperationResult } from '@/recitation/types'

import { type RecitationService } from './types'

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
      return (await api()?.getTodayWords(bookId, forceRefresh)) ?? { newWords: [], reviewWords: [], testedNewWordIds: [], testedReviewWordIds: [], quizResults: {} }
    },

    refreshTodayWords: async (bookId: number) => {
      return (await api()?.refreshTodayWords(bookId)) ?? { newWords: [], reviewWords: [], testedNewWordIds: [], testedReviewWordIds: [], quizResults: {} }
    },

    markWordsAsTested: async (bookId: number, testedNewIds: number[], testedReviewIds: number[], quizResults?: Record<number, boolean>) => {
      return (await api()?.markWordsAsTested(bookId, testedNewIds, testedReviewIds, quizResults)) ?? false
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

    getStageDistribution: async (bookId: number) => {
      return (await api()?.getStageDistribution(bookId)) ?? { unstudied: 0, stage0: 0, stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0, stage6: 0, stage7: 0, stage8: 0 }
    },

    getOverallStageDistribution: async () => {
      return (await api()?.getOverallStageDistribution()) ?? { unstudied: 0, stage0: 0, stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0, stage6: 0, stage7: 0, stage8: 0 }
    },

    getWordsByStage: async (bookId: number, minStage: number, maxStage: number) => {
      return (await api()?.getWordsByStage(bookId, minStage, maxStage)) ?? []
    },

    // === v1.4 新增 ===

    createBook: async (name: string, description?: string) => {
      return (await api()?.addBook({ name, path: '', count: 0, description })) ?? null
    },

    renameBook: async (bookId: number, newName: string) => {
      return (await api()?.renameBook(bookId, newName)) ?? false
    },

    exportBook: async (bookId: number) => {
      const path = await api()?.exportBookToDialog(bookId)
      return path !== null && path !== undefined
    },

    searchBooks: async (keyword: string) => {
      // Client-side filtering from already loaded books
      const all = await api()?.getAllBooks() ?? []
      if (!keyword.trim()) return all as Book[]
      const kw = keyword.toLowerCase()
      return all.filter(b => b.name.toLowerCase().includes(kw)) as Book[]
    },

    batchDeleteWords: async (bookId: number, wordIds: number[]) => {
      return (await api()?.batchDeleteWords(bookId, wordIds)) ?? { success: 0, failed: wordIds.length }
    },

    batchImportWords: async (bookId: number) => {
      // Stub: for future implementation
      return { success: 0, failed: 0 }
    },
  }
}
