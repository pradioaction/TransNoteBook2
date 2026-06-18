import { create } from 'zustand'
import type { WordSidebarData, WordSidebarMode } from '@/recitation/wordSidebarTypes'
import type { QuizState, QuizQuestion } from '@/recitation/quizTypes'

export interface RecitationStore {
  // === 模式状态 ===
  active: boolean
  phase: 'book-manager' | 'quiz' | 'review'

  // === 当前选中词书 ===
  selectedBookId: number | null
  selectedBookName: string | null

  // === 右侧侧边栏数据 ===
  sidebarData: WordSidebarData | null
  sidebarMode: WordSidebarMode

  // === 检测状态 ===
  quizState: QuizState | null
  floatingAnimationEnabled: boolean

  // === 文章测试来源标记（非词书管理发起） ===
  articleQuizSource: boolean

  // === 操作 ===
  activate: () => void
  deactivate: () => void
  setPhase: (phase: 'book-manager' | 'quiz' | 'review') => void

  selectBook: (bookId: number, bookName: string) => void
  setSidebarData: (data: WordSidebarData) => void
  setSidebarMode: (mode: WordSidebarMode) => void

  // 侧边栏选择操作
  toggleWordSelection: (wordId: number, isNewWord: boolean) => void
  selectWordRange: (fromIndex: number, toIndex: number, isNewWord: boolean, batchStage?: number) => void
  selectAllWords: (type: 'new' | 'review') => void
  deselectAllWords: (type: 'new' | 'review') => void
  invertWordSelection: (type: 'new' | 'review') => void

  // 检测操作
  startQuiz: (questions: QuizQuestion[]) => void
  answerQuestion: (questionIndex: number, selectedOptionId: string) => void
  nextQuestion: () => void
  prevQuestion: () => void
  toggleFloatingAnimation: () => void
  completeQuiz: () => void

  // === 批量同步追踪 ===
  pendingSyncResults: Record<number, boolean>  // wordId -> isCorrect, 待同步的已答完单词
  markWordsAsSynced: (wordIds: number[]) => void
  getPendingSyncCount: () => number

  // === 检测结果标记（绿/红背景，按词书分组） ===
  quizResultsByBook: Record<number, Record<number, boolean>>  // bookId -> { wordId -> isCorrect }
  setQuizResults: (bookId: number, results: Record<number, boolean>) => void

  // 重置
  reset: () => void
}

function updateSidebarForAnswer(
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

const initialState = {
  active: false,
  phase: 'book-manager' as const,
  selectedBookId: null,
  selectedBookName: null,
  sidebarData: null,
  sidebarMode: 'full' as const,
  quizState: null,
  floatingAnimationEnabled: true,
  articleQuizSource: false,
  pendingSyncResults: {},
  quizResultsByBook: {},
}

export const useRecitationStore = create<RecitationStore>((set, get) => ({
  ...initialState,

  activate: () => set({ active: true }),
  deactivate: () => set({ ...initialState }),
  setPhase: (phase) => set({ phase }),

  selectBook: (bookId, bookName) => set({ selectedBookId: bookId, selectedBookName: bookName }),
  setSidebarData: (data) => set({ sidebarData: data }),
  setSidebarMode: (mode) => set({ sidebarMode: mode }),

  // 侧边栏选择操作
  toggleWordSelection: (wordId, isNewWord) => {
    set((state) => {
      if (!state.sidebarData) return state
      const newData = { ...state.sidebarData }
      if (isNewWord) {
        newData.newWords = newData.newWords.map((w) =>
          w.id === wordId ? { ...w, isSelected: !w.isSelected } : w
        )
      } else {
        newData.reviewWordBatches = newData.reviewWordBatches.map((batch) => ({
          ...batch,
          words: batch.words.map((w) =>
            w.id === wordId ? { ...w, isSelected: !w.isSelected } : w
          ),
        }))
      }
      return { sidebarData: newData }
    })
  },

  selectWordRange: (fromIndex, toIndex, isNewWord, batchStage) => {
    set((state) => {
      if (!state.sidebarData) return state
      const newData = { ...state.sidebarData }
      const start = Math.min(fromIndex, toIndex)
      const end = Math.max(fromIndex, toIndex)

      if (isNewWord) {
        newData.newWords = newData.newWords.map((w, i) =>
          i >= start && i <= end ? { ...w, isSelected: true } : w
        )
      } else if (batchStage !== undefined) {
        newData.reviewWordBatches = newData.reviewWordBatches.map((batch) =>
          batch.stage === batchStage
            ? {
                ...batch,
                words: batch.words.map((w, i) =>
                  i >= start && i <= end ? { ...w, isSelected: true } : w
                ),
              }
            : batch
        )
      }
      return { sidebarData: newData }
    })
  },

  selectAllWords: (type) => {
    set((state) => {
      if (!state.sidebarData) return state
      const newData = { ...state.sidebarData }
      if (type === 'new') {
        newData.newWords = newData.newWords.map((w) => ({ ...w, isSelected: true }))
      } else {
        newData.reviewWordBatches = newData.reviewWordBatches.map((b) => ({
          ...b,
          words: b.words.map((w) => ({ ...w, isSelected: true })),
        }))
      }
      return { sidebarData: newData }
    })
  },

  deselectAllWords: (type) => {
    set((state) => {
      if (!state.sidebarData) return state
      const newData = { ...state.sidebarData }
      if (type === 'new') {
        newData.newWords = newData.newWords.map((w) => ({ ...w, isSelected: false }))
      } else {
        newData.reviewWordBatches = newData.reviewWordBatches.map((b) => ({
          ...b,
          words: b.words.map((w) => ({ ...w, isSelected: false })),
        }))
      }
      return { sidebarData: newData }
    })
  },

  invertWordSelection: (type) => {
    set((state) => {
      if (!state.sidebarData) return state
      const newData = { ...state.sidebarData }
      if (type === 'new') {
        newData.newWords = newData.newWords.map((w) => ({ ...w, isSelected: !w.isSelected }))
      } else {
        newData.reviewWordBatches = newData.reviewWordBatches.map((b) => ({
          ...b,
          words: b.words.map((w) => ({ ...w, isSelected: !w.isSelected })),
        }))
      }
      return { sidebarData: newData }
    })
  },

  // 检测操作
  startQuiz: (questions) => {
    set({
      quizState: {
        questions,
        currentIndex: 0,
        answers: new Map(),
        results: new Map(),
        isComplete: false,
        startTime: Date.now(),
      },
      phase: 'quiz',
      sidebarMode: 'quiz',
    })
  },

  answerQuestion: (questionIndex, selectedOptionId) => {
    set((state) => {
      if (!state.quizState) return state
      const question = state.quizState.questions[questionIndex]
      if (!question) return state
      const isCorrect = question.correctAnswer === selectedOptionId

      // 使用 question.id 作为键，确保每道题的结果独立存储（不因 wordId 相同而被覆盖）
      const newAnswers = new Map(state.quizState.answers)
      newAnswers.set(question.id, selectedOptionId)
      const newResults = new Map(state.quizState.results)
      newResults.set(question.id, isCorrect)

      // 统计该单词的所有题目中已答的数量
      const wordQuestions = state.quizState.questions.filter((q) => q.wordId === question.wordId)
      const answeredCount = wordQuestions.filter((q) => newResults.has(q.id)).length
      const isFullyAnswered = answeredCount >= wordQuestions.length

      // 判断该单词是否全部答对（所有题目都已答且全部正确）
      const allCorrect = wordQuestions.every(
        (q) => newResults.has(q.id) && newResults.get(q.id) === true
      )

      const newSidebar = updateSidebarForAnswer(
        state.sidebarData,
        question.wordId,
        isFullyAnswered && allCorrect // 只有两道题都答完且全部正确才算正确
      )

      // 更新当前题目的 answered 字段
      const updatedQuestions = state.quizState.questions.map((q, i) =>
        i === questionIndex ? { ...q, answered: selectedOptionId } : q
      )

      // 检查是否全部答完: 所有题目都有 answered 字段
      const allAnswered = updatedQuestions.every((q) => q.answered !== undefined)

      // 如果该单词刚答完两道题，加入待同步队列
      let newPendingSync = state.pendingSyncResults ? { ...state.pendingSyncResults } : {}
      if (isFullyAnswered && !newPendingSync[question.wordId]) {
        newPendingSync[question.wordId] = allCorrect
      }

      return {
        quizState: {
          ...state.quizState,
          questions: updatedQuestions,
          answers: newAnswers,
          results: newResults,
          isComplete: allAnswered,
        },
        sidebarData: newSidebar,
        pendingSyncResults: newPendingSync,
      }
    })
  },

  nextQuestion: () => {
    set((state) => {
      if (!state.quizState) return state
      const next = Math.min(state.quizState.currentIndex + 1, state.quizState.questions.length - 1)
      return { quizState: { ...state.quizState, currentIndex: next } }
    })
  },

  prevQuestion: () => {
    set((state) => {
      if (!state.quizState) return state
      const prev = Math.max(state.quizState.currentIndex - 1, 0)
      return { quizState: { ...state.quizState, currentIndex: prev } }
    })
  },

  toggleFloatingAnimation: () => {
    set((state) => ({ floatingAnimationEnabled: !state.floatingAnimationEnabled }))
  },

  completeQuiz: () => {
    set({ phase: 'review', sidebarMode: 'review' })
  },

  markWordsAsSynced: (wordIds) => {
    set((state) => {
      const newPending = { ...state.pendingSyncResults }
      for (const id of wordIds) {
        delete newPending[id]
      }
      return { pendingSyncResults: newPending }
    })
  },

  getPendingSyncCount: () => {
    return Object.keys(get().pendingSyncResults || {}).length
  },

  // 检测结果标记（按词书分组）
  setQuizResults: (bookId, results) => {
    set((state) => ({
      quizResultsByBook: {
        ...state.quizResultsByBook,
        [bookId]: { ...(state.quizResultsByBook[bookId] || {}), ...results },
      },
    }))
  },

  reset: () => set({ ...initialState, pendingSyncResults: {} }),
}))
