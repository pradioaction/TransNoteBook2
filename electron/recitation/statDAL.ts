import { DatabaseManager } from './database'
import type { WordRow } from './wordDAL'

/** 阶段分布：未学 + 9 个 stage */
export interface StageDistribution {
  unstudied: number
  stage0: number
  stage1: number
  stage2: number
  stage3: number
  stage4: number
  stage5: number
  stage6: number
  stage7: number
  stage8: number
}

/** 合并后的 6 阶段摘要 */
export interface StageSummary {
  unstudied: number
  beginner: number    // stage 0-1
  review: number      // stage 2-3
  consolidate: number // stage 4-5
  proficient: number  // stage 6-7
  mastered: number    // stage 8
}

/** 将 10 阶段原始分布合并为 6 阶段摘要 */
export function mergeToSixStages(dist: StageDistribution): StageSummary {
  return {
    unstudied: dist.unstudied,
    beginner: dist.stage0 + dist.stage1,
    review: dist.stage2 + dist.stage3,
    consolidate: dist.stage4 + dist.stage5,
    proficient: dist.stage6 + dist.stage7,
    mastered: dist.stage8,
  }
}

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

  /** 查询某本词书的阶段分布 */
  getStageDistribution(bookId: number): StageDistribution {
    try {
      const db = this._db.getDb()

      // 未学：仅存在于 word 表，不在 user_study 表中的词
      const unstudied = (db.prepare(
        'SELECT COUNT(*) as cnt FROM word WHERE book_id = ? AND id NOT IN (SELECT word_id FROM user_study WHERE book_id = ?)'
      ).get(bookId, bookId) as { cnt: number }).cnt

      // 各 stage 计数
      const stageRows = db.prepare(
        'SELECT stage, COUNT(*) as cnt FROM user_study WHERE book_id = ? GROUP BY stage'
      ).all(bookId) as { stage: number; cnt: number }[]

      const stageCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 }
      for (const row of stageRows) {
        stageCounts[row.stage] = row.cnt
      }

      return {
        unstudied,
        stage0: stageCounts[0],
        stage1: stageCounts[1],
        stage2: stageCounts[2],
        stage3: stageCounts[3],
        stage4: stageCounts[4],
        stage5: stageCounts[5],
        stage6: stageCounts[6],
        stage7: stageCounts[7],
        stage8: stageCounts[8],
      }
    } catch (err) {
      console.error(`[StatDAL] getStageDistribution failed: ${err}`)
      return { unstudied: 0, stage0: 0, stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0, stage6: 0, stage7: 0, stage8: 0 }
    }
  }

  /** 查询全部词书的阶段分布（汇总） */
  getOverallStageDistribution(): StageDistribution {
    try {
      const db = this._db.getDb()

      const unstudied = (db.prepare(
        `SELECT COUNT(*) as cnt FROM word WHERE id NOT IN (
          SELECT DISTINCT word_id FROM user_study
        )`
      ).get() as { cnt: number }).cnt

      const stageRows = db.prepare(
        'SELECT stage, COUNT(*) as cnt FROM user_study GROUP BY stage'
      ).all() as { stage: number; cnt: number }[]

      const stageCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 }
      for (const row of stageRows) {
        stageCounts[row.stage] = row.cnt
      }

      return {
        unstudied,
        stage0: stageCounts[0],
        stage1: stageCounts[1],
        stage2: stageCounts[2],
        stage3: stageCounts[3],
        stage4: stageCounts[4],
        stage5: stageCounts[5],
        stage6: stageCounts[6],
        stage7: stageCounts[7],
        stage8: stageCounts[8],
      }
    } catch (err) {
      console.error(`[StatDAL] getOverallStageDistribution failed: ${err}`)
      return { unstudied: 0, stage0: 0, stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0, stage6: 0, stage7: 0, stage8: 0 }
    }
  }

  /** 按 stage 范围查询单词（含 stage 信息） */
  getWordsByStage(bookId: number, minStage: number, maxStage: number): (WordRow & { stage: number })[] {
    try {
      const db = this._db.getDb()
      return db.prepare(`
        SELECT w.*, us.stage FROM word w
        JOIN user_study us ON w.id = us.word_id AND w.book_id = us.book_id
        WHERE w.book_id = ? AND us.stage >= ? AND us.stage <= ?
        ORDER BY us.stage, w.word
      `).all(bookId, minStage, maxStage) as (WordRow & { stage: number })[]
    } catch (err) {
      console.error(`[StatDAL] getWordsByStage failed: ${err}`)
      return []
    }
  }
}
