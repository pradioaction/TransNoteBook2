import { DatabaseManager } from './database'

export interface UserStudyRow {
  id: number
  book_id: number
  word_id: number
  stage: number
  weight: number
  last_review: string | null
  next_review: string | null
}

/**
 * 学习记录数据访问层 —— 与原始 Python UserStudyDAL 完全一致
 */
export class UserStudyDAL {
  constructor(private _db: DatabaseManager) {}

  addUserStudy(study: {
    book_id: number
    word_id: number
    stage: number
    weight: number
    last_review: string | null
    next_review: string | null
  }): UserStudyRow | null {
    try {
      const db = this._db.getDb()
      const result = db.prepare(
        'INSERT INTO user_study (book_id, word_id, stage, weight, last_review, next_review) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(study.book_id, study.word_id, study.stage, study.weight, study.last_review, study.next_review)

      return this.getUserStudyByWordId(study.book_id, study.word_id)
    } catch (err) {
      console.error(`[UserStudyDAL] addUserStudy failed: ${err}`)
      return null
    }
  }

  getUserStudyByWordId(bookId: number, wordId: number): UserStudyRow | null {
    try {
      const db = this._db.getDb()
      const row = db.prepare(
        'SELECT * FROM user_study WHERE book_id = ? AND word_id = ?'
      ).get(bookId, wordId) as UserStudyRow | undefined
      return row || null
    } catch (err) {
      console.error(`[UserStudyDAL] getUserStudyByWordId failed: ${err}`)
      return null
    }
  }

  getUserStudiesByBookId(bookId: number): UserStudyRow[] {
    try {
      const db = this._db.getDb()
      return db.prepare('SELECT * FROM user_study WHERE book_id = ?').all(bookId) as UserStudyRow[]
    } catch (err) {
      console.error(`[UserStudyDAL] getUserStudiesByBookId failed: ${err}`)
      return []
    }
  }

  updateUserStudy(study: {
    id: number
    stage: number
    weight: number
    last_review: string | null
    next_review: string | null
  }): boolean {
    try {
      const db = this._db.getDb()
      const result = db.prepare(
        'UPDATE user_study SET stage = ?, weight = ?, last_review = ?, next_review = ? WHERE id = ?'
      ).run(study.stage, study.weight, study.last_review, study.next_review, study.id)
      return result.changes > 0
    } catch (err) {
      console.error(`[UserStudyDAL] updateUserStudy failed: ${err}`)
      return false
    }
  }

  deleteUserStudy(studyId: number): boolean {
    try {
      const db = this._db.getDb()
      const result = db.prepare('DELETE FROM user_study WHERE id = ?').run(studyId)
      return result.changes > 0
    } catch (err) {
      console.error(`[UserStudyDAL] deleteUserStudy failed: ${err}`)
      return false
    }
  }
}
