import { DatabaseManager } from './database'

export interface WordRow {
  id: number
  book_id: number
  word: string
  phonetic: string
  definition: string
  example: string
  raw_data: string
}

/**
 * 单词数据访问层 —— 与原始 Python WordDAL 完全一致
 */
export class WordDAL {
  constructor(private _db: DatabaseManager) {}

  private _updateBookCount(bookId: number, delta: number): void {
    try {
      const db = this._db.getDb()
      db.prepare('UPDATE book SET count = count + ? WHERE id = ?').run(delta, bookId)
    } catch (err) {
      console.error(`[WordDAL] updateBookCount failed: ${err}`)
    }
  }

  addWord(word: {
    book_id: number
    word: string
    phonetic: string
    definition: string
    example: string
    raw_data: string
  }): WordRow | null {
    try {
      const db = this._db.getDb()
      const stmt = db.prepare(
        'INSERT INTO word (book_id, word, phonetic, definition, example, raw_data) VALUES (?, ?, ?, ?, ?, ?)'
      )
      const result = stmt.run(word.book_id, word.word, word.phonetic, word.definition, word.example, word.raw_data)
      const wordId = result.lastInsertRowid as number
      this._updateBookCount(word.book_id, 1)
      return this.getWordById(wordId)
    } catch (err) {
      console.error(`[WordDAL] addWord failed: ${err}`)
      return null
    }
  }

  addWordsBatch(words: Array<{
    book_id: number
    word: string
    phonetic: string
    definition: string
    example: string
    raw_data: string
  }>): number {
    if (words.length === 0) return 0

    try {
      // Count words per book
      const bookWordCounts = new Map<number, number>()
      for (const w of words) {
        bookWordCounts.set(w.book_id, (bookWordCounts.get(w.book_id) || 0) + 1)
      }

      const db = this._db.getDb()
      const stmt = db.prepare(
        'INSERT INTO word (book_id, word, phonetic, definition, example, raw_data) VALUES (?, ?, ?, ?, ?, ?)'
      )

      const insertMany = db.transaction((items: typeof words) => {
        let count = 0
        for (const w of items) {
          const result = stmt.run(w.book_id, w.word, w.phonetic, w.definition, w.example, w.raw_data)
          count += result.changes
        }
        return count
      })

      const count = insertMany(words)

      // Update book counts
      for (const [bookId, addedCount] of bookWordCounts) {
        this._updateBookCount(bookId, addedCount)
      }

      return count
    } catch (err) {
      console.error(`[WordDAL] addWordsBatch failed: ${err}`)
      return 0
    }
  }

  getWordById(wordId: number): WordRow | null {
    try {
      const db = this._db.getDb()
      const row = db.prepare('SELECT * FROM word WHERE id = ?').get(wordId) as WordRow | undefined
      return row || null
    } catch (err) {
      console.error(`[WordDAL] getWordById failed: ${err}`)
      return null
    }
  }

  getWordsByBookId(bookId: number): WordRow[] {
    try {
      const db = this._db.getDb()
      return db.prepare('SELECT * FROM word WHERE book_id = ?').all(bookId) as WordRow[]
    } catch (err) {
      console.error(`[WordDAL] getWordsByBookId failed: ${err}`)
      return []
    }
  }

  getUnstudiedWords(bookId: number, limit?: number): WordRow[] {
    try {
      const db = this._db.getDb()
      const rows = db.prepare(`
        SELECT w.* FROM word w
        LEFT JOIN user_study us ON w.id = us.word_id AND w.book_id = ?
        WHERE w.book_id = ? AND us.id IS NULL
      `).all(bookId, bookId) as WordRow[]

      // Shuffle logic matching Python: take top N by weight, then random shuffle
      if (limit && rows.length > limit) {
        // Since there's no weight for unstudied words, simply take first N and shuffle
        const selected = rows.slice(0, limit)
        this._shuffle(selected)
        return selected
      }

      this._shuffle(rows)
      return rows
    } catch (err) {
      console.error(`[WordDAL] getUnstudiedWords failed: ${err}`)
      return []
    }
  }

  getWordsForReview(bookId: number, limit?: number): WordRow[] {
    try {
      const db = this._db.getDb()
      const now = new Date().toISOString()
      const rows = db.prepare(`
        SELECT w.* FROM word w
        JOIN user_study us ON w.id = us.word_id
        WHERE w.book_id = ? AND us.next_review <= ?
        ORDER BY us.weight DESC
      `).all(bookId, now) as WordRow[]

      // Take top N by weight, then random shuffle (matching Python behavior)
      if (limit && rows.length > limit) {
        const selected = rows.slice(0, limit)
        this._shuffle(selected)
        return selected
      }

      this._shuffle(rows)
      return rows
    } catch (err) {
      console.error(`[WordDAL] getWordsForReview failed: ${err}`)
      return []
    }
  }

  updateWord(word: { id: number; word: string; phonetic: string; definition: string; example: string; raw_data: string }): boolean {
    try {
      const db = this._db.getDb()
      const result = db.prepare(
        'UPDATE word SET word = ?, phonetic = ?, definition = ?, example = ?, raw_data = ? WHERE id = ?'
      ).run(word.word, word.phonetic, word.definition, word.example, word.raw_data, word.id)
      return result.changes > 0
    } catch (err) {
      console.error(`[WordDAL] updateWord failed: ${err}`)
      return false
    }
  }

  deleteWord(wordId: number): boolean {
    let bookId: number | null = null
    try {
      const db = this._db.getDb()
      const row = db.prepare('SELECT book_id FROM word WHERE id = ?').get(wordId) as { book_id: number } | undefined
      if (!row) return false
      bookId = row.book_id

      const result = db.prepare('DELETE FROM word WHERE id = ?').run(wordId)
      return result.changes > 0
    } catch (err) {
      console.error(`[WordDAL] deleteWord failed: ${err}`)
      return false
    } finally {
      if (bookId !== null) {
        this._updateBookCount(bookId, -1)
      }
    }
  }

  checkWordExistsInBook(bookId: number, wordText: string): boolean {
    try {
      const db = this._db.getDb()
      const row = db.prepare('SELECT COUNT(*) as cnt FROM word WHERE book_id = ? AND word = ?').get(bookId, wordText) as { cnt: number }
      return row.cnt > 0
    } catch (err) {
      console.error(`[WordDAL] checkWordExistsInBook failed: ${err}`)
      return false
    }
  }

  searchWords(searchText: string, bookId?: number): WordRow[] {
    try {
      const db = this._db.getDb()
      const pattern = `%${searchText}%`

      if (bookId !== undefined) {
        return db.prepare(
          'SELECT * FROM word WHERE book_id = ? AND (word LIKE ? OR definition LIKE ?) ORDER BY word'
        ).all(bookId, pattern, pattern) as WordRow[]
      }

      return db.prepare(
        'SELECT * FROM word WHERE word LIKE ? OR definition LIKE ? ORDER BY word'
      ).all(pattern, pattern) as WordRow[]
    } catch (err) {
      console.error(`[WordDAL] searchWords failed: ${err}`)
      return []
    }
  }

  searchWordExactLower(wordText: string, bookId?: number): WordRow | null {
    try {
      const searchWord = wordText.toLowerCase()
      const db = this._db.getDb()

      if (bookId !== undefined) {
        const row = db.prepare(
          'SELECT * FROM word WHERE book_id = ? AND LOWER(word) = ? LIMIT 1'
        ).get(bookId, searchWord) as WordRow | undefined
        return row || null
      }

      const row = db.prepare(
        'SELECT * FROM word WHERE LOWER(word) = ? LIMIT 1'
      ).get(searchWord) as WordRow | undefined
      return row || null
    } catch (err) {
      console.error(`[WordDAL] searchWordExactLower failed: ${err}`)
      return null
    }
  }

  batchDelete(wordIds: number[]): number {
    if (wordIds.length === 0) return 0
    try {
      const db = this._db.getDb()
      const placeholders = wordIds.map(() => '?').join(',')
      const result = db.prepare(`DELETE FROM word WHERE id IN (${placeholders})`).run(...wordIds)
      return result.changes
    } catch (err) {
      console.error(`[WordDAL] batchDelete failed: ${err}`)
      return 0
    }
  }

  private _shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]
    }
  }
}
