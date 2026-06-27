import { RecitationDAL } from './recitationDAL'
import { BookImporter } from './bookImporter'
import { ConfigProvider } from '../workspace/configProvider'
import { BookRow } from './bookDAL'

/**
 * 词书管理服务 —— 提供词书管理的业务逻辑
 * 与原始 Python BookService 完全一致
 */
export class BookService {
  private static readonly CONFIG_KEY_CURRENT_BOOK = 'current_book_id'

  private _dal: RecitationDAL
  private _configProvider: ConfigProvider
  private _bookImporter: BookImporter

  constructor(dal: RecitationDAL, configProvider: ConfigProvider) {
    this._dal = dal
    this._configProvider = configProvider
    this._bookImporter = new BookImporter()
  }

  importBook(filePath: string): BookRow | null {
    const result = this._bookImporter.importFromFile(filePath)
    if (!result.book || result.words.length === 0) return null

    const savedBook = this._dal.addBook({
      name: result.book.name,
      path: result.book.path,
      count: 0, // Will be refreshed after adding words
    })

    if (!savedBook) return null

    const words = result.words.map(w => ({
      book_id: savedBook.id,
      word: w.word,
      phonetic: w.phonetic,
      definition: w.definition,
      example: w.example,
      raw_data: w.raw_data,
    }))

    const count = this._dal.addWordsBatch(words)
    console.log(`[BookService] Imported book: ${savedBook.name}, words: ${count}`)

    return savedBook
  }

  getAllBooks(): BookRow[] {
    return this._dal.getAllBooks()
  }

  getBookWithProgress(bookId: number): { book: BookRow | null; total: number; studied: number; review_due: number; progress: number } | null {
    const book = this._dal.getBookById(bookId)
    if (!book) return null

    const progress = this._dal.getBookProgress(bookId)

    return {
      book,
      total: progress.total,
      studied: progress.studied,
      review_due: progress.review_due,
      progress: progress.total > 0 ? (progress.studied / progress.total) * 100 : 0,
    }
  }

  getAllBooksWithProgress(): Array<{ book: BookRow; total: number; studied: number; review_due: number; progress: number }> {
    const books = this.getAllBooks()
    return books.map(book => {
      const progress = this._dal.getBookProgress(book.id)
      return {
        book,
        total: progress.total,
        studied: progress.studied,
        review_due: progress.review_due,
        progress: progress.total > 0 ? (progress.studied / progress.total) * 100 : 0,
      }
    })
  }

  selectBook(bookId: number): boolean {
    const book = this._dal.getBookById(bookId)
    if (!book) return false

    this._configProvider.set(BookService.CONFIG_KEY_CURRENT_BOOK, bookId)
    return true
  }

  getCurrentBook(): BookRow | null {
    const bookId = this._configProvider.get(BookService.CONFIG_KEY_CURRENT_BOOK) as number | undefined
    if (!bookId) return null

    return this._dal.getBookById(bookId)
  }

  deleteBook(bookId: number): boolean {
    const success = this._dal.deleteBook(bookId)

    if (success) {
      const currentId = this._configProvider.get(BookService.CONFIG_KEY_CURRENT_BOOK) as number | undefined
      if (currentId === bookId) {
        this._configProvider.set(BookService.CONFIG_KEY_CURRENT_BOOK, null)
      }
    }

    return success
  }
}
