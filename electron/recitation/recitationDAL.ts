import { DatabaseManager } from './database'
import { BookDAL, BookRow } from './bookDAL'
import { WordDAL, WordRow } from './wordDAL'
import { UserStudyDAL, UserStudyRow } from './userStudyDAL'
import { StatDAL } from './statDAL'

/**
 * 背诵模式数据访问层 —— 组合各子 DAL 模块
 * 与原始 Python RecitationDAL 完全一致
 */
export class RecitationDAL {
  readonly bookDAL: BookDAL
  readonly wordDAL: WordDAL
  readonly userStudyDAL: UserStudyDAL
  readonly statDAL: StatDAL

  constructor(private _db: DatabaseManager) {
    this.bookDAL = new BookDAL(_db)
    this.wordDAL = new WordDAL(_db)
    this.userStudyDAL = new UserStudyDAL(_db)
    this.statDAL = new StatDAL(_db)
  }

  // ==================== 词书相关 ====================

  addBook(book: { name: string; path: string; count: number; create_time?: string }): BookRow | null {
    return this.bookDAL.addBook(book)
  }

  getBookById(bookId: number): BookRow | null {
    return this.bookDAL.getBookById(bookId)
  }

  getAllBooks(): BookRow[] {
    return this.bookDAL.getAllBooks()
  }

  updateBook(book: { id: number; name: string; path: string; count: number }): boolean {
    return this.bookDAL.updateBook(book)
  }

  deleteBook(bookId: number): boolean {
    return this.bookDAL.deleteBook(bookId)
  }

  refreshBookCount(bookId: number): boolean {
    return this.bookDAL.refreshBookCount(bookId)
  }

  refreshAllBookCounts(): boolean {
    try {
      const books = this.getAllBooks()
      let success = true
      for (const book of books) {
        if (!this.refreshBookCount(book.id)) {
          success = false
        }
      }
      return success
    } catch (err) {
      console.error(`[RecitationDAL] refreshAllBookCounts failed: ${err}`)
      return false
    }
  }

  // ==================== 单词相关 ====================

  addWord(word: {
    book_id: number
    word: string
    phonetic: string
    definition: string
    example: string
    raw_data: string
  }): WordRow | null {
    return this.wordDAL.addWord(word)
  }

  addWordsBatch(words: Array<{
    book_id: number
    word: string
    phonetic: string
    definition: string
    example: string
    raw_data: string
  }>): number {
    return this.wordDAL.addWordsBatch(words)
  }

  getWordById(wordId: number): WordRow | null {
    return this.wordDAL.getWordById(wordId)
  }

  getWordsByBookId(bookId: number): WordRow[] {
    return this.wordDAL.getWordsByBookId(bookId)
  }

  getUnstudiedWords(bookId: number, limit?: number): WordRow[] {
    return this.wordDAL.getUnstudiedWords(bookId, limit)
  }

  getWordsForReview(bookId: number, limit?: number): WordRow[] {
    return this.wordDAL.getWordsForReview(bookId, limit)
  }

  updateWord(word: { id: number; word: string; phonetic: string; definition: string; example: string; raw_data: string }): boolean {
    return this.wordDAL.updateWord(word)
  }

  deleteWord(wordId: number): boolean {
    return this.wordDAL.deleteWord(wordId)
  }

  checkWordExistsInBook(bookId: number, wordText: string): boolean {
    return this.wordDAL.checkWordExistsInBook(bookId, wordText)
  }

  searchWords(searchText: string, bookId?: number): WordRow[] {
    return this.wordDAL.searchWords(searchText, bookId)
  }

  searchWordExactLower(wordText: string, bookId?: number): WordRow | null {
    return this.wordDAL.searchWordExactLower(wordText, bookId)
  }

  // ==================== 学习记录相关 ====================

  addUserStudy(study: {
    book_id: number
    word_id: number
    stage: number
    weight: number
    last_review: string | null
    next_review: string | null
  }): UserStudyRow | null {
    return this.userStudyDAL.addUserStudy(study)
  }

  getUserStudyByWordId(bookId: number, wordId: number): UserStudyRow | null {
    return this.userStudyDAL.getUserStudyByWordId(bookId, wordId)
  }

  getUserStudiesByBookId(bookId: number): UserStudyRow[] {
    return this.userStudyDAL.getUserStudiesByBookId(bookId)
  }

  updateUserStudy(study: {
    id: number
    stage: number
    weight: number
    last_review: string | null
    next_review: string | null
  }): boolean {
    return this.userStudyDAL.updateUserStudy(study)
  }

  deleteUserStudy(studyId: number): boolean {
    return this.userStudyDAL.deleteUserStudy(studyId)
  }

  // ==================== 统计相关 ====================

  getBookProgress(bookId: number): { total: number; studied: number; review_due: number } {
    return this.statDAL.getBookProgress(bookId)
  }

  getBookDetailedStats(bookId: number): { name: string; word_count: number; study_count: number } {
    return this.statDAL.getBookDetailedStats(bookId)
  }
}
