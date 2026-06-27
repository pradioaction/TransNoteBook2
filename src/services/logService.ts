export interface LogService {
  /** 检查指定路径的文件是否存在 */
  exists(filePath: string): Promise<boolean>

  /** 构建日志文件路径，默认当天，可指定日期 */
  getLogPath(date?: Date): string

  /** 检测指定日期是否有日志文件 */
  hasDateLog(date: Date): Promise<boolean>

  /** 向指定文件追加内容（直接 IPC appendFile，无需队列） */
  appendToFile(filePath: string, content: string): Promise<void>

  /** 创建指定文件 */
  createFile(filePath: string): Promise<void>

  /** 清理超过保留天数的旧日志文件，默认 30 天 */
  cleanupOldLogs(retentionDays?: number): Promise<void>
}

export function createLogService(getWorkspacePath: () => string | null): LogService {
  function getDateStr(date?: Date): string {
    const d = date ?? new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function buildLogPath(date?: Date): string {
    const ws = getWorkspacePath()
    if (!ws) return ''
    return `${ws.replace(/\\/g, '/')}/.TransRead/log/${getDateStr(date)}.log`
  }

  return {
    exists: async (filePath) => {
      return window.electronAPI?.fileExists(filePath) ?? false
    },

    getLogPath: (date) => {
      return buildLogPath(date)
    },

    hasDateLog: async (date) => {
      const logPath = buildLogPath(date)
      if (!logPath) return false
      return window.electronAPI?.fileExists(logPath) ?? false
    },

    appendToFile: async (filePath, content) => {
      if (!getWorkspacePath() || !window.electronAPI?.appendFile) return
      try {
        await window.electronAPI.appendFile(filePath, content)
      } catch {
        // 静默失败
      }
    },

    createFile: async (filePath) => {
      if (!getWorkspacePath()) return
      try {
        await window.electronAPI?.writeFile(filePath, '')
      } catch {
        // 静默失败
      }
    },

    cleanupOldLogs: async (retentionDays = 30) => {
      const ws = getWorkspacePath()
      if (!ws) return
      const logDir = `${ws.replace(/\\/g, '/')}/.TransRead/log`
      try {
        const api = window.electronAPI
        if (!api) return
        const entries = await api.readDirectory(logDir)
        const now = Date.now()
        const maxAge = retentionDays * 24 * 60 * 60 * 1000
        for (const entry of entries) {
          if (!entry.isDirectory && entry.name.endsWith('.log')) {
            // Parse date from filename: yyyy-MM-dd.log
            const datePart = entry.name.replace('.log', '')
            const fileDate = new Date(datePart).getTime()
            if (!isNaN(fileDate) && (now - fileDate) > maxAge) {
              await api.deleteFile(entry.path).catch(() => {})
            }
          }
        }
      } catch {
        // 如果日志目录不存在，静默忽略
      }
    },
  }
}
