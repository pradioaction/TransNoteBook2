import { ipcMain, clipboard } from 'electron'
import path from 'path'
import fs from 'fs'

export function registerFileHandlers() {
  ipcMain.handle('read-file', async (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8')
  })

  ipcMain.handle('write-file', async (_event, filePath: string, content: string) => {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('file-exists', async (_event, filePath: string) => {
    return fs.existsSync(filePath)
  })

  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return true
  })

  ipcMain.handle('rename-file', async (_event, oldPath: string, newPath: string) => {
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath)
    return true
  })

  ipcMain.handle('append-file', async (_event, filePath: string, content: string) => {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('read-clipboard', async () => {
    return clipboard.readText()
  })

  ipcMain.handle('read-directory', async (_event, dirPath: string) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      return entries
        .filter((e) => e.name.endsWith('.transnb') || e.isDirectory())
        .map((e) => ({
          name: e.name,
          path: path.join(dirPath, e.name),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
    } catch {
      return []
    }
  })

  ipcMain.handle('read-directory-recursive', async (_event, dirPath: string) => {
    const result: Array<{ name: string; path: string }> = []
    try {
      function walk(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const e of entries) {
          const fullPath = path.join(dir, e.name)
          if (e.isDirectory()) {
            walk(fullPath)
          } else if (e.name.endsWith('.transnb')) {
            result.push({ name: e.name, path: fullPath })
          }
        }
      }
      walk(dirPath)
    } catch { /* ignore */ }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  })
}
