import { create } from 'zustand'
import { createLogService } from '@/services/logService'
import { useWorkspaceStore } from './workspaceStore'

let _logService: ReturnType<typeof createLogService> | null = null

function getLogService() {
  if (!_logService) {
    _logService = createLogService(() => useWorkspaceStore.getState().workspacePath)
    // 首次创建时清理过期日志（仅启动时执行一次）
    _logService.cleanupOldLogs().catch(() => {})
  }
  return _logService
}

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
  color?: string
}

export interface OutputStore {
  logs: LogEntry[]
  addLog: (message: string, level?: LogLevel, color?: string) => void
  clearLogs: () => void
}

let _logId = 0

export const useOutputStore = create<OutputStore>((set) => ({
  logs: [],

  addLog: (message, level = 'info', color) => {
    const time = formatTime()
    const entry: LogEntry = {
      id: `log-${++_logId}`,
      timestamp: time,
      message,
      level,
      color,
    }
    set((state) => ({ logs: [...state.logs, entry] }))

    // 异步写入当日日志文件
    const svc = getLogService()
    const todayPath = svc.getLogPath()
    if (todayPath) {
      const levelLabel = level.toUpperCase()
      svc.appendToFile(todayPath, `[${time}] [${levelLabel}] ${message}\n`)
    }
  },

  clearLogs: () => set({ logs: [] }),
}))
