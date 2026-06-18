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
