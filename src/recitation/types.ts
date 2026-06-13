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

export interface StudyConfig {
  daily_new_words?: number
  daily_review_words?: number
  current_book_id?: number
  [key: string]: unknown
}

export interface TodayWordsResult {
  new_words: Word[]
  review_words: Word[]
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
}
