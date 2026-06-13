import { DatabaseManager } from './database'

export interface BookRow {
  id: number
  name: string
  path: string
  count: number
  create_time: string
}

/**
 * 词书数据访问层 —— 与原始 Python BookDAL 完全一致
 */
export class BookDAL {
  constructor(private _db: DatabaseManager) {}

  addBook(book: { name: string; path: string; count: number; create_time?: string }): BookRow | null {
    try {
      const db = this._db.getDb()
      const stmt = db.prepare(
        'INSERT INTO book (name, path, count, create_time) VALUES (?, ?, ?, ?)'
      )
      const result = stmt.run(
        book.name,
        book.path,
        book.count ?? 0,
        book.create_time || new Date().toISOString()
      )
      return this.getBookById(result.lastInsertRowid as number)
    } catch (err) {
      console.error(`[BookDAL] addBook failed: ${err}`)
      return null
    }
  }

  getBookById(bookId: number): BookRow | null {
    try {
      const db = this._db.getDb()
      const row = db.prepare('SELECT * FROM book WHERE id = ?').get(bookId) as BookRow | undefined
      return row || null
    } catch (err) {
      console.error(`[BookDAL] getBookById failed: ${err}`)
      return null
    }
  }

  getAllBooks(): BookRow[] {
    try {
      const db = this._db.getDb()
      return db.prepare('SELECT * FROM book ORDER BY create_time DESC').all() as BookRow[]
    } catch (err) {
      console.error(`[BookDAL] getAllBooks failed: ${err}`)
      return []
    }
  }

  updateBook(book: { id: number; name: string; path: string; count: number }): boolean {
    try {
      const db = this._db.getDb()
      const result = db.prepare('UPDATE book SET name = ?, path = ?, count = ? WHERE id = ?').run(
        book.name,
        book.path,
        book.count,
        book.id
      )
      return result.changes > 0
    } catch (err) {
      console.error(`[BookDAL] updateBook failed: ${err}`)
      return false
    }
  }

  deleteBook(bookId: number): boolean {
    try {
      const db = this._db.getDb()
      const result = db.prepare('DELETE FROM book WHERE id = ?').run(bookId)
      return result.changes > 0
    } catch (err) {
      console.error(`[BookDAL] deleteBook failed: ${err}`)
      return false
    }
  }

  refreshBookCount(bookId: number): boolean {
    try {
      const db = this._db.getDb()
      const row = db.prepare('SELECT COUNT(*) as cnt FROM word WHERE book_id = ?').get(bookId) as { cnt: number }
      db.prepare('UPDATE book SET count = ? WHERE id = ?').run(row.cnt, bookId)
      return true
    } catch (err) {
      console.error(`[BookDAL] refreshBookCount failed: ${err}`)
      return false
    }
  }
}
