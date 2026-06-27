import { ipcMain } from 'electron'
import { loadSettings, saveSettings } from '../state'

export function registerSettingsHandlers() {
  ipcMain.handle('get-settings', async () => {
    return loadSettings()
  })

  ipcMain.handle('set-settings', async (_event, settings: Record<string, unknown>) => {
    saveSettings(settings)
    return true
  })
}
