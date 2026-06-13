import { DatabaseManager } from './database'

/**
 * 统计数据访问层 —— 与原始 Python StatDAL 完全一致
 */
export class StatDAL {
  constructor(private _db: DatabaseManager) {}

  getBookProgress(bookId: number): { total: number; studied: number; review_due: number } {
    try {
      const db = this._db.getDb()
      const total = (db.prepare('SELECT COUNT(*) as cnt FROM word WHERE book_id = ?').get(bookId) as { cnt: number }).cnt
      const studied = (db.prepare('SELECT COUNT(*) as cnt FROM user_study WHERE book_id = ?').get(bookId) as { cnt: number }).cnt

      const now = new Date().toISOString()
      const reviewDue = (db.prepare(
        'SELECT COUNT(*) as cnt FROM user_study WHERE book_id = ? AND next_review <= ?'
      ).get(bookId, now) as { cnt: number }).cnt

      return { total, studied, review_due: reviewDue }
    } catch (err) {
      console.error(`[StatDAL] getBookProgress failed: ${err}`)
      return { total: 0, studied: 0, review_due: 0 }
    }
  }

  getBookDetailedStats(bookId: number): { name: string; word_count: number; study_count: number } {
    try {
      const db = this._db.getDb()
      const bookRow = db.prepare('SELECT name, count FROM book WHERE id = ?').get(bookId) as { name: string; count: number } | undefined
      const name = bookRow?.name || '未知'
      const wordCount = bookRow?.count || 0

      const studyCount = (db.prepare('SELECT COUNT(*) as cnt FROM user_study WHERE book_id = ?').get(bookId) as { cnt: number }).cnt

      return { name, word_count: wordCount, study_count: studyCount }
    } catch (err) {
      console.error(`[StatDAL] getBookDetailedStats failed: ${err}`)
      return { name: '未知', word_count: 0, study_count: 0 }
    }
  }
}
