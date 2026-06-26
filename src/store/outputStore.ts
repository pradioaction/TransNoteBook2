import { create } from 'zustand'
import { createLogService } from '@/services/logService'
import { useWorkspaceStore } from './workspaceStore'

const _logService = createLogService(() => useWorkspaceStore.getState().workspacePath)

function formatTime(): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

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
    const time = formatTime()
    const entry: LogEntry = {
      id: `log-${++_logId}`,
      timestamp: time,
      message,
      level,
    }
    set((state) => ({ logs: [...state.logs, entry] }))

    // 异步写入当日日志文件
    const todayPath = _logService.getLogPath()
    if (todayPath) {
      const levelLabel = level.toUpperCase()
      _logService.appendToFile(todayPath, `[${time}] [${levelLabel}] ${message}\n`)
    }
  },

  clearLogs: () => set({ logs: [] }),
}))
