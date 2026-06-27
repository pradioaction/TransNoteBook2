import { RecitationDAL } from './recitationDAL'
import { EbbinghausAlgorithm } from './ebbinghaus'
import { WordRow } from './wordDAL'
import { UserStudyRow } from './userStudyDAL'
import { ConfigProvider } from '../workspace/configProvider'

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
  private _configProvider: ConfigProvider
  private _ebbinghaus: EbbinghausAlgorithm

  constructor(dal: RecitationDAL, configProvider: ConfigProvider) {
    this._dal = dal
    this._configProvider = configProvider
    this._ebbinghaus = new EbbinghausAlgorithm()
    this._cleanupStaleTodayWords()
  }

  getConfig(): Record<string, unknown> {
    return this._configProvider.getAll()
  }

  setConfig(key: string, value: unknown): void {
    this._configProvider.set(key, value)
  }

  getDailyNewWords(): number {
    return (this._configProvider.get(StudyService.CONFIG_KEY_DAILY_NEW) as number) || StudyService.DEFAULT_DAILY_NEW
  }

  setDailyNewWords(count: number): void {
    this._configProvider.set(StudyService.CONFIG_KEY_DAILY_NEW, Math.max(1, count))
  }

  getDailyReviewWords(): number {
    return (this._configProvider.get(StudyService.CONFIG_KEY_DAILY_REVIEW) as number) || StudyService.DEFAULT_DAILY_REVIEW
  }

  setDailyReviewWords(count: number): void {
    this._configProvider.set(StudyService.CONFIG_KEY_DAILY_REVIEW, Math.max(1, count))
  }

  private _getTodayKey(bookId: number): string {
    return `${StudyService.CONFIG_KEY_TODAY_WORDS}_${bookId}`
  }

  private _isSameDay(): boolean {
    const todayStr = new Date().toISOString().split('T')[0]
    const savedDate = this._configProvider.get(StudyService.CONFIG_KEY_TODAY_DATE) as string || ''
    return todayStr === savedDate
  }

  private _cleanupStaleTodayWords(): void {
    const todayStr = new Date().toISOString().split('T')[0]
    const savedDate = this._configProvider.get(StudyService.CONFIG_KEY_TODAY_DATE) as string || ''

    if (todayStr === savedDate) return

    const allConfig = this._configProvider.getAll()
    for (const key of Object.keys(allConfig)) {
      if (key.startsWith(StudyService.CONFIG_KEY_TODAY_WORDS + '_')) {
        this._configProvider.set(key, undefined)
      }
    }

    this._configProvider.set(StudyService.CONFIG_KEY_TODAY_DATE, todayStr)
  }

  getTodayWords(bookId: number, forceRefresh: boolean = false): { newWords: WordRow[]; reviewWords: WordRow[]; testedNewWordIds: number[]; testedReviewWordIds: number[]; quizResults: Record<number, boolean> } {
    const todayKey = this._getTodayKey(bookId)
    let needRefresh = forceRefresh

    if (!this._configProvider.get(todayKey)) {
      needRefresh = true
    }

    if (!needRefresh) {
      const savedData = this._configProvider.get(todayKey) as { new_words: number[]; review_words: number[]; tested_new_word_ids: number[]; tested_review_word_ids: number[]; quiz_results?: Record<number, boolean> }
      const newWordIds = savedData?.new_words || []
      const reviewWordIds = savedData?.review_words || []
      const testedNewWordIds = savedData?.tested_new_word_ids || []
      const testedReviewWordIds = savedData?.tested_review_word_ids || []
      const quizResults = savedData?.quiz_results || {}

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

      return { newWords, reviewWords, testedNewWordIds, testedReviewWordIds, quizResults }
    }

    const dailyNew = this.getDailyNewWords()
    const dailyReview = this.getDailyReviewWords()

    const newWords = this._dal.getUnstudiedWords(bookId, dailyNew)
    const reviewWords = this._dal.getWordsForReview(bookId, dailyReview)

    const todayStr = new Date().toISOString().split('T')[0]
    this._configProvider.set(StudyService.CONFIG_KEY_TODAY_DATE, todayStr)
    this._configProvider.set(todayKey, {
      new_words: newWords.map(w => w.id),
      review_words: reviewWords.map(w => w.id),
      tested_new_word_ids: [],
      tested_review_word_ids: [],
    })

    return { newWords, reviewWords, testedNewWordIds: [], testedReviewWordIds: [], quizResults: {} }
  }

  refreshTodayWords(bookId: number): { newWords: WordRow[]; reviewWords: WordRow[]; testedNewWordIds: number[]; testedReviewWordIds: number[]; quizResults: Record<number, boolean> } {
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
    const savedData = this._configProvider.get(todayKey) as { new_words: number[]; review_words: number[] } | undefined
    if (!savedData) return

    const successSet = new Set(successWordIds)

    savedData.new_words = savedData.new_words.filter(wid => !successSet.has(wid))
    savedData.review_words = savedData.review_words.filter(wid => !successSet.has(wid))

    this._configProvider.set(todayKey, savedData)
  }

  markWordsAsTested(bookId: number, testedNewIds: number[], testedReviewIds: number[], quizResults?: Record<number, boolean>): void {
    const todayKey = this._getTodayKey(bookId)
    const savedData = this._configProvider.get(todayKey) as { 
      new_words: number[]; 
      review_words: number[];
      tested_new_word_ids: number[];
      tested_review_word_ids: number[];
      quiz_results?: Record<number, boolean>;
    } | undefined
    if (!savedData) return
    
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

    // Write quiz results if provided
    if (quizResults && Object.keys(quizResults).length > 0) {
      if (!savedData.quiz_results) savedData.quiz_results = {}
      Object.assign(savedData.quiz_results, quizResults)
    }

    this._configProvider.set(todayKey, savedData)
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
