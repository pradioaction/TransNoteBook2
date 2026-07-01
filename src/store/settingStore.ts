import { create } from 'zustand'
import type { TranslationSettings, CustomModel, PromptTemplates, EnvVar } from '@/types/notebook'
import { useThemeStore } from '@/store/themeStore'
import { getDefaultEnSid, getDefaultZhSid } from '@/constants/ttsSpeakers'

export interface SettingStore {
  readingFontSize: number
  cellWidthRatio: number
  translation: TranslationSettings
  promptTemplates: PromptTemplates
  customModels: CustomModel[]
  envVars: EnvVar[]
  lastOpenFilePath: string | null
  recentFiles: string[]
  ttsModelPath: string
  ttsSid: number
  ttsSidEn: number
  ttsSidZh: number
  ttsSpeed: number
  _onThemeChange: ((theme: 'light' | 'dark') => void) | null
  setOnThemeChange: (cb: ((theme: 'light' | 'dark') => void) | null) => void
  setReadingFontSize: (size: number) => void
  setCellWidthRatio: (ratio: number) => void
  setTranslation: (settings: TranslationSettings) => void
  setPromptTemplates: (templates: PromptTemplates) => void
  setCustomModels: (models: CustomModel[]) => void
  addCustomModel: (model: CustomModel) => void
  removeCustomModel: (name: string) => void
  setEnvVars: (vars: EnvVar[]) => void
  setLastOpenFilePath: (path: string | null) => void
  addRecentFile: (path: string) => void
  setTtsModelPath: (path: string) => void
  setTtsSid: (sid: number) => void
  setTtsSidEn: (sid: number) => void
  setTtsSidZh: (sid: number) => void
  setTtsSpeed: (speed: number) => void
  loadFromDisk: () => Promise<void>
  saveToDisk: () => Promise<void>
}

const defaultTranslation: TranslationSettings = {
  enabled: false,
  currentProvider: 'system_Ollama',
  ollama: { baseUrl: 'http://localhost:11434', model: 'qwen2.5:0.5b' },
  openai: {
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    timeout: 60,
    proxy: '',
  },
}

const defaultTemplates: PromptTemplates = {
  translation: '请翻译{input}',
  analysis: '请解析{input}',
  scenery: '请完成一篇包含{input}的文章',
  review: '请对以下英文写作进行批改，包括语法检查、句式优化、用词建议和总体评分（满分10分）\n\n原文：\n{input}',
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

const debouncedSave = (saveFn: () => Promise<void>) => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveFn()
    saveTimer = null
  }, 500)
}

export const useSettingStore = create<SettingStore>((set, get) => ({
  readingFontSize: 14,
  cellWidthRatio: 70,
  translation: { ...defaultTranslation },
  promptTemplates: { ...defaultTemplates },
  customModels: [],
  envVars: [],
  lastOpenFilePath: null,
  recentFiles: [],
  ttsModelPath: 'model/kokoro-int8-multi-lang-v1_0',
  ttsSid: 0,
  ttsSidEn: getDefaultEnSid(),
  ttsSidZh: getDefaultZhSid(),
  ttsSpeed: 1.0,
  _onThemeChange: null,
  setOnThemeChange: (cb) => set({ _onThemeChange: cb }),

  setReadingFontSize: (size) => {
    set({ readingFontSize: size })
    debouncedSave(get().saveToDisk)
  },

  setCellWidthRatio: (ratio) => {
    set({ cellWidthRatio: ratio })
    debouncedSave(get().saveToDisk)
  },

  setTranslation: (settings) => {
    set({ translation: settings })
    debouncedSave(get().saveToDisk)
  },

  setPromptTemplates: (templates) => {
    set({ promptTemplates: templates })
    debouncedSave(get().saveToDisk)
  },

  setCustomModels: (models) => {
    set({ customModels: models })
    debouncedSave(get().saveToDisk)
  },

  addCustomModel: (model) => {
    set((s) => ({ customModels: [...s.customModels.filter((m) => m.name !== model.name), model] }))
    debouncedSave(get().saveToDisk)
  },

  removeCustomModel: (name) => {
    set((s) => ({ customModels: s.customModels.filter((m) => m.name !== name) }))
    debouncedSave(get().saveToDisk)
  },

  setEnvVars: (vars) => {
    set({ envVars: vars })
    debouncedSave(get().saveToDisk)
  },

  setLastOpenFilePath: (path) => {
    set({ lastOpenFilePath: path })
    debouncedSave(get().saveToDisk)
  },

  addRecentFile: (path) => {
    set((state) => ({
      recentFiles: [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 10),
    }))
    debouncedSave(get().saveToDisk)
  },

  setTtsModelPath: (path) => {
    set({ ttsModelPath: path })
    debouncedSave(get().saveToDisk)
  },

  setTtsSid: (sid) => {
    set({ ttsSid: sid })
    debouncedSave(get().saveToDisk)
  },

  setTtsSidEn: (sid) => {
    set({ ttsSidEn: sid })
    debouncedSave(get().saveToDisk)
  },

  setTtsSidZh: (sid) => {
    set({ ttsSidZh: sid })
    debouncedSave(get().saveToDisk)
  },

  setTtsSpeed: (speed) => {
    set({ ttsSpeed: speed })
    debouncedSave(get().saveToDisk)
  },

  loadFromDisk: async () => {
    if (!window.electronAPI) return
    try {
      const raw = await window.electronAPI.getSettings()
      const readingFontSize = (raw.readingFontSize as number) || 14
      const cellWidthRatio = (raw.cellWidthRatio as number) || 70
      const translation = (raw.translation as TranslationSettings) || { ...defaultTranslation }
      const promptTemplates = (raw.promptTemplates as PromptTemplates) || { ...defaultTemplates }
      const customModels = (raw.customModels as CustomModel[]) || []
      const envVars = (raw.envVars as EnvVar[]) || []
      const onThemeChange = get()._onThemeChange
      if (raw.theme && onThemeChange) {
        onThemeChange(raw.theme as 'light' | 'dark')
      }
      const lastOpenFilePath = (raw.lastOpenFilePath as string | null) || null
      const recentFiles = (raw.recentFiles as string[]) || []
      const ttsModelPath = (raw.ttsModelPath as string) || 'model/kokoro-int8-multi-lang-v1_0'
      const ttsSid = (raw.ttsSid as number) ?? 0
      const ttsSidEn = (raw.ttsSidEn as number) ?? getDefaultEnSid()
      const ttsSidZh = (raw.ttsSidZh as number) ?? getDefaultZhSid()
      const ttsSpeed = (raw.ttsSpeed as number) ?? 1.0
      set({ readingFontSize, cellWidthRatio, translation, promptTemplates, customModels, envVars, lastOpenFilePath, recentFiles, ttsModelPath, ttsSid, ttsSidEn, ttsSidZh, ttsSpeed })
    } catch { /* ignore */ }
  },

  saveToDisk: async () => {
    if (!window.electronAPI) return
    try {
      const state = get()
      const currentTheme = useThemeStore.getState().theme
      await window.electronAPI.setSettings({
        theme: currentTheme,
        readingFontSize: state.readingFontSize,
        cellWidthRatio: state.cellWidthRatio,
        translation: state.translation,
        promptTemplates: state.promptTemplates,
        customModels: state.customModels,
        envVars: state.envVars,
        lastOpenFilePath: state.lastOpenFilePath,
        recentFiles: state.recentFiles,
        ttsModelPath: state.ttsModelPath,
        ttsSid: state.ttsSid,
        ttsSidEn: state.ttsSidEn,
        ttsSidZh: state.ttsSidZh,
        ttsSpeed: state.ttsSpeed,
      } as unknown as Record<string, unknown>)
    } catch { /* ignore */ }
  },
}))
