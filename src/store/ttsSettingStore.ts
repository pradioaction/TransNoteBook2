import { create } from 'zustand'

/**
 * 自动朗读时机。按「使用场景」而非题型内部模型划分，
 * 这样背诵模块的题型变更不会影响本配置层；手动点击朗读按钮也不受这些开关影响。
 */
export interface TTSAutoReadSettings {
  /** 切题时朗读题干单词（仅英文题干题型，不泄露答案） */
  question: boolean
  /** 答题前朗读答案单词作为提示（会提前听到答案） */
  hint: boolean
  /** 作答后朗读所选选项的单词 */
  answer: boolean
  /** 翻卡时朗读卡片上的单词 */
  flip: boolean
}

export interface TTSSettings {
  enabled: boolean
  provider: string
  rate: number
  volume: number
  voiceId: string
  autoRead: TTSAutoReadSettings
}

export interface TTSSettingStore {
  tts: TTSSettings
  setTTS: (settings: Partial<TTSSettings>) => void
  setAutoRead: (settings: Partial<TTSAutoReadSettings>) => void
  loadFromDisk: () => Promise<void>
  saveToDisk: () => Promise<void>
}

const defaultAutoRead: TTSAutoReadSettings = {
  question: true,
  hint: false,
  answer: true,
  flip: true,
}

const defaultTTS: TTSSettings = {
  enabled: true,
  provider: 'system_WebSpeech',
  rate: 0.9,
  volume: 1.0,
  voiceId: '',
  autoRead: { ...defaultAutoRead },
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

  setAutoRead: (settings) => {
    set((state) => ({
      tts: { ...state.tts, autoRead: { ...state.tts.autoRead, ...settings } },
    }))
    debouncedSave(get().saveToDisk)
  },

  loadFromDisk: async () => {
    if (!window.electronAPI) return
    try {
      const raw = await window.electronAPI.getSettings()
      const stored = (raw.tts ?? {}) as Partial<TTSSettings>
      // 旧配置文件没有 autoRead 字段，需逐层兜底，否则读取时会得到 undefined
      set({
        tts: {
          ...defaultTTS,
          ...stored,
          autoRead: { ...defaultAutoRead, ...(stored.autoRead ?? {}) },
        },
      })
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
