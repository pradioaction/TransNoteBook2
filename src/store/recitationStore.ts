import { create } from 'zustand'
import type { WordSidebarData, WordSidebarMode } from '@/recitation/wordSidebarTypes'
import type { QuizState, QuizQuestion } from '@/recitation/quizTypes'
import { computeAnswerResult, updateSidebarForAnswer, createQuizState } from '@/recitation/quizEngine'

/** 可序列化的检测进度快照（Map 已转为 Record，可直接 JSON 化） */
export interface QuizProgressSnapshot {
  source?: 'article' | 'book'
  questions: QuizQuestion[]
  currentIndex: number
  answers: Record<string, string>      // question.id(string) → optionId
  results: Record<string, boolean>     // question.id(string) → isCorrect
  startTime: number
  selectedBookId: number | null
  selectedBookName: string | null
  pendingSyncResults: Record<number, boolean>
  sidebarData: WordSidebarData | null
}

const SAVED_QUIZ_PROGRESS_KEY = 'saved_quiz_progress'

// 直接通过 electronAPI 持久化，避免 store 对 service 层的循环依赖
// 槽位 → config key 映射：'article' → 'saved_quiz_progress'；`book_${bookId}` → `saved_quiz_progress_book_${bookId}`
function persistSavedProgress(slotKey: string, snapshot: QuizProgressSnapshot | null) {
  try {
    const configKey =
      slotKey === 'article' ? SAVED_QUIZ_PROGRESS_KEY : `saved_quiz_progress_book_${slotKey.slice('book_'.length)}`
    window.electronAPI?.recitationAPI?.setConfig(configKey, snapshot)
  } catch {
    // 忽略持久化失败
  }
}

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

  // === 暂存的检测进度（按槽位：'article' | `book_${bookId}`，持久化到 studywordmode.json） ===
  savedQuizProgress: Record<string, QuizProgressSnapshot | null>

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

  // === 暂存检测进度操作 ===
  saveQuizProgress: (source: 'article' | 'book') => void
  hasSavedQuizProgress: (slotKey: string) => boolean
  restoreQuizProgress: (slotKey: string) => void
  clearSavedQuizProgress: (slotKey: string) => void
  hydrateSavedQuizProgressSlot: (slotKey: string, snapshot: QuizProgressSnapshot | null) => void
  clearSavedQuizProgressSlots: () => void

  // 重置
  reset: () => void
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
  savedQuizProgress: {} as Record<string, QuizProgressSnapshot | null>,
  pendingSyncResults: {},
  quizResultsByBook: {},
}

export const useRecitationStore = create<RecitationStore>((set, get) => ({
  ...initialState,

  activate: () => set({ active: true }),
  deactivate: () => set((state) => ({ ...initialState, savedQuizProgress: state.savedQuizProgress })),
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
      quizState: createQuizState(questions),
      phase: 'quiz',
      sidebarMode: 'quiz',
    })
  },

  answerQuestion: (questionIndex, selectedOptionId) => {
    set((state) => {
      if (!state.quizState) return state
      const result = computeAnswerResult(
        state.quizState,
        state.sidebarData,
        state.pendingSyncResults,
        questionIndex,
        selectedOptionId
      )
      return {
        quizState: result.quizState,
        sidebarData: result.sidebarData,
        pendingSyncResults: result.pendingSyncResults,
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

  // === 暂存检测进度操作 ===
  saveQuizProgress: (source) => {
    const state = get()
    if (!state.quizState) return
    const snapshot: QuizProgressSnapshot = {
      source,
      questions: state.quizState.questions,
      currentIndex: state.quizState.currentIndex,
      answers: Object.fromEntries(state.quizState.answers),
      results: Object.fromEntries(state.quizState.results),
      startTime: state.quizState.startTime,
      selectedBookId: state.selectedBookId,
      selectedBookName: state.selectedBookName,
      pendingSyncResults: state.pendingSyncResults,
      sidebarData: state.sidebarData,
    }
    const slotKey = source === 'article' ? 'article' : `book_${state.selectedBookId}`
    set({ savedQuizProgress: { ...state.savedQuizProgress, [slotKey]: snapshot } })
    persistSavedProgress(slotKey, snapshot)
  },

  hasSavedQuizProgress: (slotKey) => {
    const snapshot = get().savedQuizProgress[slotKey]
    return snapshot !== null && snapshot !== undefined
  },

  restoreQuizProgress: (slotKey) => {
    const snapshot = get().savedQuizProgress[slotKey]
    if (!snapshot) return

    const answers = new Map<number, string>()
    for (const [k, v] of Object.entries(snapshot.answers)) {
      answers.set(Number(k), v)
    }
    const results = new Map<number, boolean>()
    for (const [k, v] of Object.entries(snapshot.results)) {
      results.set(Number(k), v)
    }

    const allAnswered = snapshot.questions.every((q) => q.answered !== undefined)

    set({
      active: true,
      phase: 'quiz',
      sidebarMode: 'quiz',
      articleQuizSource: snapshot.source !== 'book',
      selectedBookId: snapshot.selectedBookId,
      selectedBookName: snapshot.selectedBookName,
      sidebarData: snapshot.sidebarData,
      pendingSyncResults: snapshot.pendingSyncResults,
      quizState: {
        questions: snapshot.questions,
        currentIndex: snapshot.currentIndex,
        answers,
        results,
        isComplete: allAnswered,
        startTime: snapshot.startTime,
      },
    })

    // 恢复词书槽位时同步当前词书
    if (slotKey !== 'article') {
      try {
        window.electronAPI?.recitationAPI?.setConfig('current_book_id', snapshot.selectedBookId)
      } catch {
        // 忽略失败
      }
    }

    // 恢复成功后删除该槽并持久化
    const next = { ...get().savedQuizProgress }
    delete next[slotKey]
    set({ savedQuizProgress: next })
    persistSavedProgress(slotKey, null)
  },

  clearSavedQuizProgress: (slotKey) => {
    const next = { ...get().savedQuizProgress }
    delete next[slotKey]
    set({ savedQuizProgress: next })
    persistSavedProgress(slotKey, null)
  },

  hydrateSavedQuizProgressSlot: (slotKey, snapshot) => {
    set({ savedQuizProgress: { ...get().savedQuizProgress, [slotKey]: snapshot } })
  },

  clearSavedQuizProgressSlots: () => set({ savedQuizProgress: {} }),

  reset: () => set((state) => ({ ...initialState, pendingSyncResults: {}, savedQuizProgress: state.savedQuizProgress })),
}))
