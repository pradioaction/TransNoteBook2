import { ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { recitationState, ensureRecitationServices } from '../state'

export function registerRecitationHandlers() {
  const $ = recitationState

  ipcMain.handle('recitation:init', async (_event, workspacePath: string) => {
    try {
      const ok = ensureRecitationServices(workspacePath)
      if (ok) {
        $.workspacePath = path.resolve(workspacePath)
      }
      return { success: ok, error: ok ? undefined : 'Database initialization failed (check terminal for details)' }
    } catch (err: any) {
      console.error('[Recitation] init threw:', err)
      return { success: false, error: String(err?.message ?? err) }
    }
  })

  ipcMain.handle('recitation:add-book', async (_event, book: { name: string; path: string; count: number }) => {
    if (!$.recitationDAL) return null
    return $.recitationDAL.addBook(book)
  })

  ipcMain.handle('recitation:get-book-by-id', async (_event, bookId: number) => {
    if (!$.recitationDAL) return null
    return $.recitationDAL.getBookById(bookId)
  })

  ipcMain.handle('recitation:get-all-books', async () => {
    if (!$.recitationDAL) return []
    return $.recitationDAL.getAllBooks()
  })

  ipcMain.handle('recitation:delete-book', async (_event, bookId: number) => {
    if (!$.bookService) return false
    return $.bookService.deleteBook(bookId)
  })

  ipcMain.handle('recitation:get-book-progress', async (_event, bookId: number) => {
    if (!$.recitationDAL) return { total: 0, studied: 0, review_due: 0 }
    return $.recitationDAL.getBookProgress(bookId)
  })

  ipcMain.handle('recitation:get-all-books-with-progress', async () => {
    if (!$.bookService) return []
    return $.bookService.getAllBooksWithProgress()
  })

  ipcMain.handle('recitation:import-book-from-file', async (_event, filePath: string) => {
    if (!$.bookService) return null
    return $.bookService.importBook(filePath)
  })

  ipcMain.handle('recitation:get-words-by-book', async (_event, bookId: number) => {
    if (!$.recitationDAL) return []
    return $.recitationDAL.getWordsByBookId(bookId)
  })

  ipcMain.handle('recitation:get-unstudied-words', async (_event, bookId: number, limit?: number) => {
    if (!$.recitationDAL) return []
    return $.recitationDAL.getUnstudiedWords(bookId, limit)
  })

  ipcMain.handle('recitation:get-words-for-review', async (_event, bookId: number, limit?: number) => {
    if (!$.recitationDAL) return []
    return $.recitationDAL.getWordsForReview(bookId, limit)
  })

  ipcMain.handle('recitation:search-words', async (_event, searchText: string, bookId?: number) => {
    if (!$.recitationDAL) return []
    return $.recitationDAL.searchWords(searchText, bookId)
  })

  ipcMain.handle('recitation:start-study-word', async (_event, bookId: number, wordId: number) => {
    if (!$.studyService) return null
    return $.studyService.startStudyWord(bookId, wordId)
  })

  ipcMain.handle('recitation:review-word', async (_event, bookId: number, wordId: number, isCorrect: boolean) => {
    if (!$.studyService) return null
    return $.studyService.reviewWord(bookId, wordId, isCorrect)
  })

  ipcMain.handle('recitation:get-config', async () => {
    if (!$.studyService) return {}
    return $.studyService.getConfig()
  })

  ipcMain.handle('recitation:set-config', async (_event, key: string, value: unknown) => {
    if (!$.studyService) return false
    $.studyService.setConfig(key, value)
    return true
  })

  ipcMain.handle('recitation:get-today-words', async (_event, bookId: number, forceRefresh?: boolean) => {
    if (!$.studyService) return { newWords: [], reviewWords: [] }
    return $.studyService.getTodayWords(bookId, forceRefresh)
  })

  ipcMain.handle('recitation:refresh-today-words', async (_event, bookId: number) => {
    if (!$.studyService) return { newWords: [], reviewWords: [] }
    return $.studyService.refreshTodayWords(bookId)
  })

  ipcMain.handle('recitation:mark-words-as-tested', async (_event, bookId: number, testedNewIds: number[], testedReviewIds: number[], quizResults?: Record<number, boolean>) => {
    if (!$.studyService) return false
    $.studyService.markWordsAsTested(bookId, testedNewIds, testedReviewIds, quizResults)
    return true
  })

  ipcMain.handle('recitation:add-word', async (_event, bookId: number, word: { word: string; phonetic: string; definition: string; example: string }) => {
    if (!$.recitationDAL) return null
    return $.recitationDAL.addWord({ ...word, book_id: bookId, raw_data: '' })
  })

  ipcMain.handle('recitation:update-word', async (_event, wordId: number, word: { word: string; phonetic: string; definition: string; example: string }) => {
    if (!$.recitationDAL) return false
    return $.recitationDAL.updateWord({ id: wordId, ...word, raw_data: '' })
  })

  ipcMain.handle('recitation:delete-word', async (_event, wordId: number) => {
    if (!$.recitationDAL) return false
    return $.recitationDAL.deleteWord(wordId)
  })

  ipcMain.handle('recitation:get-stage-distribution', async (_event, bookId: number) => {
    if (!$.recitationDAL) return { unstudied: 0, stage0: 0, stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0, stage6: 0, stage7: 0, stage8: 0 }
    return $.recitationDAL.getStageDistribution(bookId)
  })

  ipcMain.handle('recitation:get-overall-stage-distribution', async () => {
    if (!$.recitationDAL) return { unstudied: 0, stage0: 0, stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0, stage6: 0, stage7: 0, stage8: 0 }
    return $.recitationDAL.getOverallStageDistribution()
  })

  ipcMain.handle('recitation:get-words-by-stage', async (_event, bookId: number, minStage: number, maxStage: number) => {
    if (!$.recitationDAL) return []
    return $.recitationDAL.getWordsByStage(bookId, minStage, maxStage)
  })

  // === v1.4 新增 ===

  ipcMain.handle('recitation:rename-book', async (_event, bookId: number, newName: string) => {
    if (!$.recitationDAL) return false
    return $.recitationDAL.renameBook(bookId, newName)
  })

  ipcMain.handle('recitation:export-book', async (_event, bookId: number, exportPath: string) => {
    if (!$.recitationDAL || !$.bookService) return false
    try {
      const words = $.recitationDAL.getWordsByBookId(bookId)
      const book = $.recitationDAL.getBookById(bookId)
      if (!book) return false
      const data = JSON.stringify({
        name: book.name,
        export_time: new Date().toISOString(),
        word_count: book.count,
        words: words.map((w: any) => ({
          word: w.word, phonetic: w.phonetic,
          definition: w.definition, example: w.example,
        })),
      }, null, 2)
      fs.writeFileSync(exportPath, data, 'utf-8')
      return true
    } catch (err) {
      console.error(`[Recitation] export-book failed: ${err}`)
      return false
    }
  })

  ipcMain.handle('recitation:export-book-to-dialog', async (_event, bookId: number) => {
    if (!$.recitationDAL) return null
    const book = $.recitationDAL.getBookById(bookId)
    if (!book) return null
    const result = await dialog.showSaveDialog($.mainWindow!, {
      defaultPath: `${book.name}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return null
    try {
      const words = $.recitationDAL.getWordsByBookId(bookId)
      const data = JSON.stringify({
        name: book.name,
        export_time: new Date().toISOString(),
        word_count: book.count,
        words: words.map((w: any) => ({
          word: w.word, phonetic: w.phonetic,
          definition: w.definition, example: w.example,
        })),
      }, null, 2)
      fs.writeFileSync(result.filePath, data, 'utf-8')
      return result.filePath
    } catch (err) {
      console.error(`[Recitation] export-book-to-dialog failed: ${err}`)
      return null
    }
  })

  ipcMain.handle('recitation:batch-delete-words', async (_event, bookId: number, wordIds: number[]) => {
    if (!$.recitationDAL) return { success: 0, failed: wordIds.length }
    try {
      const book = $.recitationDAL.getBookById(bookId)
      if (!book) return { success: 0, failed: wordIds.length, errors: ['Book not found'] }
      const deleted = $.recitationDAL.batchDeleteWords(wordIds)
      $.recitationDAL.refreshBookCount(bookId)
      return { success: deleted, failed: wordIds.length - deleted }
    } catch (err: any) {
      return { success: 0, failed: wordIds.length, errors: [String(err)] }
    }
  })
}
