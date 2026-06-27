import { ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'

const WORKSPACE_CONFIG_FILENAME = 'workspace-config.json'

export function registerWorkspaceConfigHandlers() {
  ipcMain.handle('workspace-config:get', async (_event, workspacePath: string): Promise<Record<string, unknown>> => {
    if (!workspacePath) return {}
    const configPath = path.join(workspacePath, '.TransRead', WORKSPACE_CONFIG_FILENAME)
    try {
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      }
    } catch { /* ignore */ }
    return {}
  })

  ipcMain.handle('workspace-config:set', async (_event, workspacePath: string, key: string, value: unknown): Promise<boolean> => {
    if (!workspacePath) return false
    const configPath = path.join(workspacePath, '.TransRead', WORKSPACE_CONFIG_FILENAME)
    try {
      const dir = path.dirname(configPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      let config: Record<string, unknown> = {}
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      }
      config[key] = value
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
      return true
    } catch { return false }
  })
}
