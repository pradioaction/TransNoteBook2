import { create } from 'zustand'

export interface TTSSettings {
  enabled: boolean
  provider: string
  rate: number
  volume: number
  voiceId: string
}

export interface TTSSettingStore {
  tts: TTSSettings
  setTTS: (settings: Partial<TTSSettings>) => void
  loadFromDisk: () => Promise<void>
  saveToDisk: () => Promise<void>
}

const defaultTTS: TTSSettings = {
  enabled: true,
  provider: 'system_WebSpeech',
  rate: 0.9,
  volume: 1.0,
  voiceId: '',
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

const debouncedSave = (saveFn: () => Promise<void>) => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveFn()
    saveTimer = null
  }, 500)
}

export const useTTSSettingStore = create<TTSSettingStore>((set, get) => ({
  tts: { ...defaultTTS },

  setTTS: (settings) => {
    set((state) => ({ tts: { ...state.tts, ...settings } }))
    debouncedSave(get().saveToDisk)
  },

  loadFromDisk: async () => {
    if (!window.electronAPI) return
    try {
      const raw = await window.electronAPI.getSettings()
      const tts = (raw.tts as TTSSettings) || { ...defaultTTS }
      set({ tts })
    } catch { /* ignore */ }
  },

  saveToDisk: async () => {
    if (!window.electronAPI) return
    try {
      // 读取现有全部设置，仅更新 tts 字段，保持其余不变
      const existing = await window.electronAPI.getSettings() ?? {}
      await window.electronAPI.setSettings({
        ...existing,
        tts: get().tts,
      } as unknown as Record<string, unknown>)
    } catch { /* ignore */ }
  },
}))
