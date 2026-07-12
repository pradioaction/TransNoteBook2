export type QuizQuestionType = 'word-to-meaning' | 'meaning-to-word'

export interface QuizOption {
  id: 'A' | 'B' | 'C' | 'D'
  text: string
  pairText: string  // 悬停切换显示的对应文本
}

export interface QuizQuestion {
  id: number
  type: QuizQuestionType
  wordId: number
  word: string
  correctAnswer: string
  options: QuizOption[]
  answered?: string   // 用户选择的选项 ID  'A'|'B'|'C'|'D'
  // 翻转卡片展示的单词详细信息
  phonetic?: string   // 音标
  definition?: string // 完整释义
  example?: string    // 例句
  stage?: number      // 艾宾浩斯阶段
}

export interface QuizState {
  questions: QuizQuestion[]
  currentIndex: number
  answers: Map<number, string>    // question.id → 选项 ID（每个 question 独立存储）
  results: Map<number, boolean>   // question.id → 正确/错误（每个 question 独立存储）
  isComplete: boolean
  startTime: number
}

/** 悬浮选项主题配置(预留) */
export interface FloatingOptionTheme {
  optionSize: number
  amplitude: number
  period: number
  optionColors: Record<'A' | 'B' | 'C' | 'D', string>
}
