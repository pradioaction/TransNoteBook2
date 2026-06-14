import { create } from 'zustand'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  timestamp: string
  message: string
  level: LogLevel
}

export interface OutputStore {
  logs: LogEntry[]
  addLog: (message: string, level?: LogLevel) => void
  clearLogs: () => void
}

let _logId = 0

export const useOutputStore = create<OutputStore>((set) => ({
  logs: [],

  addLog: (message, level = 'info') => {
    const entry: LogEntry = {
      id: `log-${++_logId}`,
      timestamp: new Date().toLocaleTimeString(),
      message,
      level,
    }
    set((state) => ({ logs: [...state.logs, entry] }))
  },

  clearLogs: () => set({ logs: [] }),
}))
