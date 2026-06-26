export interface LogService {
  /** 检查指定路径的文件是否存在 */
  exists(filePath: string): Promise<boolean>

  /** 构建日志文件路径，默认当天，可指定日期 */
  getLogPath(date?: Date): string

  /** 检测指定日期是否有日志文件 */
  hasDateLog(date: Date): Promise<boolean>

  /** 向指定文件追加内容（走异步写入队列） */
  appendToFile(filePath: string, content: string): Promise<void>

  /** 创建指定文件 */
  createFile(filePath: string): Promise<void>
}

export function createLogService(getWorkspacePath: () => string | null): LogService {
  const queue: Array<{ filePath: string; content: string }> = []
  let isProcessing = false

  async function processQueue(): Promise<void> {
    if (isProcessing) return
    isProcessing = true
    const api = window.electronAPI
    while (queue.length > 0) {
      const { filePath, content } = queue.shift()!
      if (!api) continue
      try {
        const existing = await api.fileExists(filePath)
          ? await api.readFile(filePath)
          : ''
        await api.writeFile(filePath, existing + content)
      } catch {
        // 静默失败，不阻塞后续写入
      }
    }
    isProcessing = false
  }

  function enqueue(filePath: string, content: string): void {
    queue.push({ filePath, content })
    processQueue()
  }

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
    return `${ws.replace(/\\/g, '/')}/.tranread/log/${getDateStr(date)}.log`
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
      if (!getWorkspacePath()) return
      enqueue(filePath, content)
    },

    createFile: async (filePath) => {
      if (!getWorkspacePath()) return
      try {
        await window.electronAPI?.writeFile(filePath, '')
      } catch {
        // 静默失败
      }
    },
  }
}
