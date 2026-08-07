import { create } from 'zustand'
import { useOutputStore } from './outputStore'

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export interface ReadingTimerStore {
  running: boolean
  elapsed: number
  notebookPath: string | null
  startTimer: (path: string) => void
  stopTimer: (reason: string) => void
  tick: () => void
}

export const useReadingTimerStore = create<ReadingTimerStore>((set, get) => ({
  running: false,
  elapsed: 0,
  notebookPath: null,

  startTimer: (path) =>
    set({ running: true, elapsed: 0, notebookPath: path }),

  stopTimer: (reason) => {
    const { elapsed, notebookPath } = get()
    if (elapsed === 0) {
      set({ running: false, elapsed: 0 })
      return
    }
    const name = notebookPath?.split(/[/\\]/).pop() || 'untitled'
    const timeStr = formatTime(elapsed)
    useOutputStore.getState().addLog(`Reading: ${timeStr} on ${name}${reason}`)
    set({ running: false, elapsed: 0 })
  },

  tick: () => set((state) => ({ elapsed: state.elapsed + 1 })),
}))
