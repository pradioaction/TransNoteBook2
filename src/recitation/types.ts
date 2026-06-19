/* 背诵模式数据模型类型定义 —— 与原始 Python dataclass 完全对应 */

export interface Book {
  id?: number
  name: string
  path: string
  count: number
  create_time?: string | null // ISO datetime string
}

export interface Word {
  id?: number
  book_id: number
  word: string
  phonetic: string
  definition: string
  example: string
  raw_data: string
}

export interface UserStudy {
  id?: number
  book_id: number
  word_id: number
  stage: number
  weight: number
  last_review: string | null // ISO datetime string
  next_review: string | null // ISO datetime string
}

export interface BookProgress {
  total: number
  studied: number
  review_due: number
}

export interface BookDetailedStats {
  name: string
  word_count: number
  study_count: number
}

export interface BookWithProgress {
  book: Book
  total: number
  studied: number
  review_due: number
  progress: number
}

/** 10 阶段原始分布（未学 + stage 0-8） */
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
  beginner: number
  review: number
  consolidate: number
  proficient: number
  mastered: number
}

/** 按阶段过滤单词的参数 */
export interface StageFilter {
  min: number
  max: number
  label: string
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

export interface StudyConfig {
  daily_new_words?: number
  daily_review_words?: number
  current_book_id?: number
  [key: string]: unknown
}

export interface TodayWordsResult {
  newWords: Word[]
  reviewWords: Word[]
  testedNewWordIds: number[]
  testedReviewWordIds: number[]
  quizResults: Record<number, boolean>
}

export interface StudyWordResult {
  word_id: number
  is_correct: boolean
}

export interface ImportBookResult {
  book: Book | null
  words: Word[]
}

/** 电子主进程 recitationAPI 接口 */
export interface RecitationAPI {
  init(workspacePath: string): Promise<boolean>
  addBook(book: Book): Promise<Book | null>
  getBookById(bookId: number): Promise<Book | null>
  getAllBooks(): Promise<Book[]>
  deleteBook(bookId: number): Promise<boolean>
  getBookProgress(bookId: number): Promise<BookProgress>
  getAllBooksWithProgress(): Promise<BookWithProgress[]>
  importBookFromFile(filePath: string): Promise<Book | null>
  getWordsByBook(bookId: number): Promise<Word[]>
  getUnstudiedWords(bookId: number, limit?: number): Promise<Word[]>
  getWordsForReview(bookId: number, limit?: number): Promise<Word[]>
  searchWords(searchText: string, bookId?: number): Promise<Word[]>
  startStudyWord(bookId: number, wordId: number): Promise<UserStudy | null>
  reviewWord(bookId: number, wordId: number, isCorrect: boolean): Promise<UserStudy | null>
  getConfig(): Promise<Record<string, unknown>>
  setConfig(key: string, value: unknown): Promise<boolean>
  getTodayWords(bookId: number, forceRefresh?: boolean): Promise<TodayWordsResult>
  refreshTodayWords(bookId: number): Promise<TodayWordsResult>
  markWordsAsTested(bookId: number, testedNewIds: number[], testedReviewIds: number[]): Promise<boolean>
  addWord(bookId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<Word | null>
  updateWord(wordId: number, word: { word: string; phonetic: string; definition: string; example: string }): Promise<boolean>
  deleteWord(wordId: number): Promise<boolean>
}
