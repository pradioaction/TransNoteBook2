import fs from 'fs'
import { RecitationDAL } from './recitationDAL'
import { PathManager } from './database'
import { EbbinghausAlgorithm } from './ebbinghaus'
import { WordRow } from './wordDAL'
import { UserStudyRow } from './userStudyDAL'

/**
 * 学习服务 —— 管理学习记录、抽取单词、更新学习进度
 * 与原始 Python StudyService 完全一致
 */
export class StudyService {
  private static readonly CONFIG_KEY_DAILY_NEW = 'daily_new_words'
  private static readonly CONFIG_KEY_DAILY_REVIEW = 'daily_review_words'
  private static readonly CONFIG_KEY_TODAY_WORDS = 'today_words'
  private static readonly CONFIG_KEY_TODAY_DATE = 'today_date'

  private static readonly DEFAULT_DAILY_NEW = 20
  private static readonly DEFAULT_DAILY_REVIEW = 50

  private _dal: RecitationDAL
  private _pathManager: PathManager
  private _ebbinghaus: EbbinghausAlgorithm
  private _config: Record<string, unknown> = {}

  constructor(dal: RecitationDAL, pathManager: PathManager) {
    this._dal = dal
    this._pathManager = pathManager
    this._ebbinghaus = new EbbinghausAlgorithm()
    this._loadConfig()
  }

  private _loadConfig(): void {
    try {
      const configPath = this._pathManager.getConfigPath()
      if (configPath && fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8')
        this._config = JSON.parse(content)
        this._cleanupStaleTodayWords()
      }
    } catch (err) {
      console.warn(`[StudyService] Load config failed: ${err}`)
      this._config = {}
    }
  }

  private _saveConfig(): void {
    try {
      const configPath = this._pathManager.getConfigPath()
      if (configPath) {
        fs.writeFileSync(configPath, JSON.stringify(this._config, null, 2), 'utf-8')
      }
    } catch (err) {
      console.error(`[StudyService] Save config failed: ${err}`)
    }
  }

  getConfig(): Record<string, unknown> {
    return { ...this._config }
  }

  setConfig(key: string, value: unknown): void {
    this._config[key] = value
    this._saveConfig()
  }

  getDailyNewWords(): number {
    return (this._config[StudyService.CONFIG_KEY_DAILY_NEW] as number) || StudyService.DEFAULT_DAILY_NEW
  }

  setDailyNewWords(count: number): void {
    this._config[StudyService.CONFIG_KEY_DAILY_NEW] = Math.max(1, count)
    this._saveConfig()
  }

  getDailyReviewWords(): number {
    return (this._config[StudyService.CONFIG_KEY_DAILY_REVIEW] as number) || StudyService.DEFAULT_DAILY_REVIEW
  }

  setDailyReviewWords(count: number): void {
    this._config[StudyService.CONFIG_KEY_DAILY_REVIEW] = Math.max(1, count)
    this._saveConfig()
  }

  private _getTodayKey(bookId: number): string {
    return `${StudyService.CONFIG_KEY_TODAY_WORDS}_${bookId}`
  }

  private _isSameDay(): boolean {
    const todayStr = new Date().toISOString().split('T')[0]
    const savedDate = this._config[StudyService.CONFIG_KEY_TODAY_DATE] as string || ''
    return todayStr === savedDate
  }

  private _cleanupStaleTodayWords(): void {
    const todayStr = new Date().toISOString().split('T')[0]
    const savedDate = this._config[StudyService.CONFIG_KEY_TODAY_DATE] as string || ''

    if (todayStr === savedDate) return

    const keysToRemove: string[] = []
    for (const key of Object.keys(this._config)) {
      if (key.startsWith(StudyService.CONFIG_KEY_TODAY_WORDS + '_')) {
        keysToRemove.push(key)
      }
    }

    for (const key of keysToRemove) {
      delete this._config[key]
    }

    if (this._config[StudyService.CONFIG_KEY_TODAY_DATE] !== todayStr) {
      this._config[StudyService.CONFIG_KEY_TODAY_DATE] = todayStr
    }

    this._saveConfig()
  }

  getTodayWords(bookId: number, forceRefresh: boolean = false): { newWords: WordRow[]; reviewWords: WordRow[]; testedNewWordIds: number[]; testedReviewWordIds: number[] } {
    const todayKey = this._getTodayKey(bookId)
    let needRefresh = forceRefresh

    if (!(todayKey in this._config)) {
      needRefresh = true
    }

    if (!needRefresh) {
      const savedData = this._config[todayKey] as { new_words: number[]; review_words: number[]; tested_new_word_ids: number[]; tested_review_word_ids: number[] }
      const newWordIds = savedData?.new_words || []
      const reviewWordIds = savedData?.review_words || []
      const testedNewWordIds = savedData?.tested_new_word_ids || []
      const testedReviewWordIds = savedData?.tested_review_word_ids || []

      const newWords: WordRow[] = []
      const reviewWords: WordRow[] = []

      for (const wid of newWordIds) {
        const word = this._dal.getWordById(wid)
        if (word) newWords.push(word)
      }
      for (const wid of reviewWordIds) {
        const word = this._dal.getWordById(wid)
        if (word) reviewWords.push(word)
      }

      return { newWords, reviewWords, testedNewWordIds, testedReviewWordIds }
    }

    const dailyNew = this.getDailyNewWords()
    const dailyReview = this.getDailyReviewWords()

    const newWords = this._dal.getUnstudiedWords(bookId, dailyNew)
    const reviewWords = this._dal.getWordsForReview(bookId, dailyReview)

    const todayStr = new Date().toISOString().split('T')[0]
    this._config[StudyService.CONFIG_KEY_TODAY_DATE] = todayStr
    this._config[todayKey] = {
      new_words: newWords.map(w => w.id),
      review_words: reviewWords.map(w => w.id),
      tested_new_word_ids: [],
      tested_review_word_ids: [],
    }
    this._saveConfig()

    return { newWords, reviewWords, testedNewWordIds: [], testedReviewWordIds: [] }
  }

  refreshTodayWords(bookId: number): { newWords: WordRow[]; reviewWords: WordRow[]; testedNewWordIds: number[]; testedReviewWordIds: number[] } {
    return this.getTodayWords(bookId, true)
  }

  startStudyWord(bookId: number, wordId: number): UserStudyRow | null {
    const existing = this._dal.getUserStudyByWordId(bookId, wordId)
    if (existing) return existing

    const initialState = this._ebbinghaus.calculateInitialState()

    return this._dal.addUserStudy({
      book_id: bookId,
      word_id: wordId,
      stage: initialState.stage,
      weight: initialState.weight,
      last_review: initialState.lastReview,
      next_review: initialState.nextReview,
    })
  }

  reviewWord(bookId: number, wordId: number, isCorrect: boolean): UserStudyRow | null {
    const userStudy = this._dal.getUserStudyByWordId(bookId, wordId)
    if (!userStudy) return null

    const result = this._ebbinghaus.calculateReviewResult(
      userStudy.stage,
      userStudy.weight,
      userStudy.last_review || new Date().toISOString(),
      isCorrect,
    )

    const success = this._dal.updateUserStudy({
      id: userStudy.id,
      stage: result.newStage,
      weight: result.newWeight,
      last_review: result.newLastReview,
      next_review: result.newNextReview,
    })

    if (success) {
      return this._dal.getUserStudyByWordId(bookId, wordId)
    }
    return null
  }

  reviewBatchWords(bookId: number, wordResults: Array<{ word_id: number; is_correct: boolean }>): Array<UserStudyRow | null> {
    return wordResults.map(r => this.reviewWord(bookId, r.word_id, r.is_correct))
  }

  startStudyBatchWords(bookId: number, wordIds: number[]): Array<UserStudyRow | null> {
    return wordIds.map(wordId => this.startStudyWord(bookId, wordId))
  }

  removeSuccessWordsFromToday(bookId: number, successWordIds: number[]): void {
    const todayKey = this._getTodayKey(bookId)
    if (!(todayKey in this._config)) return

    const savedData = this._config[todayKey] as { new_words: number[]; review_words: number[] }
    const successSet = new Set(successWordIds)

    savedData.new_words = savedData.new_words.filter(wid => !successSet.has(wid))
    savedData.review_words = savedData.review_words.filter(wid => !successSet.has(wid))

    this._config[todayKey] = savedData
    this._saveConfig()
  }

  markWordsAsTested(bookId: number, testedNewIds: number[], testedReviewIds: number[]): void {
    const todayKey = this._getTodayKey(bookId)
    if (!(todayKey in this._config)) return

    const savedData = this._config[todayKey] as { 
      new_words: number[]; 
      review_words: number[];
      tested_new_word_ids: number[];
      tested_review_word_ids: number[];
    }
    
    // Ensure tested arrays exist
    if (!savedData.tested_new_word_ids) savedData.tested_new_word_ids = []
    if (!savedData.tested_review_word_ids) savedData.tested_review_word_ids = []

    // Append new IDs (avoid duplicates)
    const newSet = new Set(savedData.tested_new_word_ids)
    for (const id of testedNewIds) newSet.add(id)
    savedData.tested_new_word_ids = [...newSet]

    const reviewSet = new Set(savedData.tested_review_word_ids)
    for (const id of testedReviewIds) reviewSet.add(id)
    savedData.tested_review_word_ids = [...reviewSet]

    this._config[todayKey] = savedData
    this._saveConfig()
  }

  processQuizResults(
    bookId: number,
    newWordIds: number[],
    reviewWordIds: number[],
    wordResults: Array<{ word_id: number; is_correct: boolean }>,
  ): void {
    // 1. Start new words
    if (newWordIds.length > 0) {
      this.startStudyBatchWords(bookId, newWordIds)
    }

    // 2. Process review results
    if (wordResults.length > 0) {
      this.reviewBatchWords(bookId, wordResults)
    }

    // 3. Mark successful words as tested
    const successWordIds = wordResults.filter(r => r.is_correct).map(r => r.word_id)
    if (successWordIds.length > 0) {
      const successSet = new Set(successWordIds)
      const testedNewIds = newWordIds.filter(id => successSet.has(id))
      const testedReviewIds = reviewWordIds.filter(id => successSet.has(id))
      this.markWordsAsTested(bookId, testedNewIds, testedReviewIds)
    }
  }
}
