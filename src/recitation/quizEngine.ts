import type { QuizState, QuizQuestion } from './quizTypes'
import type { WordSidebarData } from './wordSidebarTypes'

/**
 * 答题后更新侧边栏单词状态（标记 isAnswered / isCorrect）
 */
export function updateSidebarForAnswer(
  data: WordSidebarData | null,
  wordId: number,
  isCorrect: boolean
): WordSidebarData | null {
  if (!data) return null

  return {
    ...data,
    newWords: data.newWords.map((w) =>
      w.id === wordId ? { ...w, isAnswered: true, isCorrect } : w
    ),
    reviewWordBatches: data.reviewWordBatches.map((b) => ({
      ...b,
      words: b.words.map((w) =>
        w.id === wordId ? { ...w, isAnswered: true, isCorrect } : w
      ),
    })),
  }
}

export interface AnswerResult {
  quizState: QuizState
  sidebarData: WordSidebarData | null
  pendingSyncResults: Record<number, boolean>
}

/**
 * 处理单次答题，返回新的 quizState / sidebarData / pendingSyncResults。
 * 纯函数，不依赖 Zustand store。
 */
export function computeAnswerResult(
  quizState: QuizState,
  sidebarData: WordSidebarData | null,
  pendingSyncResults: Record<number, boolean>,
  questionIndex: number,
  selectedOptionId: string
): AnswerResult {
  const question = quizState.questions[questionIndex]
  if (!question) {
    return { quizState, sidebarData, pendingSyncResults }
  }

  const isCorrect = question.correctAnswer === selectedOptionId

  // 使用 question.id 作为键，确保每道题的结果独立存储（不因 wordId 相同而被覆盖）
  const newAnswers = new Map(quizState.answers)
  newAnswers.set(question.id, selectedOptionId)
  const newResults = new Map(quizState.results)
  newResults.set(question.id, isCorrect)

  // 统计该单词的所有题目中已答的数量
  const wordQuestions = quizState.questions.filter((q) => q.wordId === question.wordId)
  const answeredCount = wordQuestions.filter((q) => newResults.has(q.id)).length
  const isFullyAnswered = answeredCount >= wordQuestions.length

  // 判断该单词是否全部答对（所有题目都已答且全部正确）
  const allCorrect = wordQuestions.every(
    (q) => newResults.has(q.id) && newResults.get(q.id) === true
  )

  const newSidebar = updateSidebarForAnswer(
    sidebarData,
    question.wordId,
    isFullyAnswered && allCorrect
  )

  // 更新当前题目的 answered 字段
  const updatedQuestions = quizState.questions.map((q, i) =>
    i === questionIndex ? { ...q, answered: selectedOptionId } : q
  )

  // 检查是否全部答完
  const allAnswered = updatedQuestions.every((q) => q.answered !== undefined)

  // 如果该单词刚答完，加入待同步队列
  const newPendingSync = { ...pendingSyncResults }
  if (isFullyAnswered && !newPendingSync[question.wordId]) {
    newPendingSync[question.wordId] = allCorrect
  }

  return {
    quizState: {
      ...quizState,
      questions: updatedQuestions,
      answers: newAnswers,
      results: newResults,
      isComplete: allAnswered,
    },
    sidebarData: newSidebar,
    pendingSyncResults: newPendingSync,
  }
}

/**
 * 创建初始测验状态
 */
export function createQuizState(questions: QuizQuestion[]): QuizState {
  return {
    questions,
    currentIndex: 0,
    answers: new Map(),
    results: new Map(),
    isComplete: false,
    startTime: Date.now(),
  }
}
