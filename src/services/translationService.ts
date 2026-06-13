import type { TranslationService, TranslationStatus, ProviderInfo } from './types'
import type { TranslationProvider } from '@/translation/types'
import { createSystemProviders, createCustomProviders } from '@/translation/providerFactory'
import { useNotebookStore } from '@/store/notebookStore'
import { useSettingStore } from '@/store/settingStore'

export function createTranslationService(): TranslationService {
  let systemProviders = createSystemProviders()
  let customProviders: TranslationProvider[] = []
  let currentProviderId = 'system_Ollama'
  let abortController: AbortController | null = null

  const status: TranslationStatus = {
    state: 'idle',
    currentIndex: 0,
    totalCount: 0,
    progress: 0,
    error: null,
    cellStates: {},
    cellErrors: {},
    currentContent: undefined,
  }

  const getProvider = (providerId?: string): TranslationProvider | undefined => {
    const id = providerId || currentProviderId
    return [...systemProviders, ...customProviders].find(p => p.id === id)
  }

  const getAllProviders = (): TranslationProvider[] => {
    return [...systemProviders, ...customProviders]
  }

  const reloadCustomProviders = () => {
    const settings = useSettingStore.getState()
    customProviders = createCustomProviders(
      settings.customModels.map(m => ({
        name: m.name,
        apiKeyEnv: m.apiKeyEnv,
        endpoint: m.endpoint,
        model: m.model,
        timeout: m.timeout,
        backend: m.backend,
        enabled: m.enabled,
      }))
    )
    // If current provider no longer exists, fall back to system_Ollama
    if (!getProvider()) {
      currentProviderId = 'system_Ollama'
    }
  }

  const syncProvider = () => {
    const settings = useSettingStore.getState()
    currentProviderId = settings.translation.currentProvider
    reloadCustomProviders()
  }

  const doTranslateCells = async (indices: number[]) => {
    syncProvider()
    const provider = getProvider()
    if (!provider) throw new Error('No translation provider available')
    if (indices.length === 0) return

    abortController = new AbortController()
    status.state = 'translating'
    status.currentIndex = 0
    status.totalCount = indices.length
    status.progress = 0
    status.error = null
    status.cellStates = {}
    status.cellErrors = {}

    // 初始化所有待翻译单元格状态
    for (const idx of indices) {
      status.cellStates[idx] = 'pending'
    }

    const settings = useSettingStore.getState()
    const template = settings.promptTemplates.analysis || '请解析{input}'

    for (let i = 0; i < indices.length; i++) {
      if (abortController.signal.aborted) {
        status.state = 'idle'
        return
      }
      const idx = indices[i]
      const cell = useNotebookStore.getState().notebook?.cells[idx]
      if (!cell || !cell.content.trim()) {
        status.cellStates[idx] = 'done'
        continue
      }

      status.currentIndex = i
      status.currentContent = cell.content.substring(0, 80)
      status.cellStates[idx] = 'translating'

      try {
        const result = await provider.translate(cell.content, template, abortController.signal)
        useNotebookStore.getState().updateCellOutput(idx, result)
        status.cellStates[idx] = 'done'
        status.currentIndex = i
        status.progress = Math.round(((i + 1) / indices.length) * 100)
      } catch (err: any) {
        if (err.name === 'AbortError') {
          status.state = 'idle'
          return
        }
        status.cellStates[idx] = 'error'
        status.cellErrors[idx] = err.message || 'Translation failed'
        status.error = err.message || 'Translation failed'
        status.state = 'error'
        return
      }
    }
    status.state = 'idle'
    status.currentContent = undefined
    status.progress = 100
  }

  return {
    listProviders: (): ProviderInfo[] => {
      reloadCustomProviders()
      return getAllProviders().map(p => p.getInfo())
    },

    setCurrentProvider: (providerId: string) => {
      currentProviderId = providerId
    },

    translateCell: async (index: number) => {
      syncProvider()
      const provider = getProvider()
      if (!provider) throw new Error('No translation provider available')

      const notebook = useNotebookStore.getState().notebook
      if (!notebook) return
      const cell = notebook.cells[index]
      if (!cell || !cell.content.trim()) return

      const settings = useSettingStore.getState()
      const template = settings.promptTemplates.analysis || '请解析{input}'

      abortController = new AbortController()
      status.state = 'translating'
      status.currentIndex = index
      status.totalCount = 1
      status.progress = 0
      status.error = null
      status.cellStates = {}
      status.cellErrors = {}
      status.currentContent = cell.content.substring(0, 80)
      status.cellStates[index] = 'translating'

      try {
        const result = await provider.translate(cell.content, template, abortController.signal)
        useNotebookStore.getState().updateCellOutput(index, result)
        status.cellStates[index] = 'done'
        status.progress = 100
        status.state = 'idle'
        status.currentContent = undefined
      } catch (err: any) {
        if (err.name === 'AbortError') {
          status.state = 'idle'
          return
        }
        status.cellStates[index] = 'error'
        status.cellErrors[index] = err.message || 'Translation failed'
        status.state = 'error'
        status.error = err.message || 'Translation failed'
      }
    },

    translateAll: async () => {
      const cells = useNotebookStore.getState().notebook?.cells ?? []
      const indices = cells.map((_, i) => i).filter(i => cells[i].content.trim())
      await doTranslateCells(indices)
    },

    translateCells: doTranslateCells,

    testConnection: async (providerId: string): Promise<{ success: boolean; error?: string }> => {
      reloadCustomProviders()
      const provider = getProvider(providerId)
      if (!provider) return { success: false, error: `Provider not found: ${providerId}` }
      return await provider.testConnection()
    },

    getStatus: () => ({ ...status }),

    cancel: () => {
      if (abortController) {
        abortController.abort()
        abortController = null
      }
      status.state = 'idle'
    },

    generateSceneText: async (words: string[], promptTemplate?: string): Promise<string> => {
      syncProvider()
      const provider = getProvider()
      if (!provider) throw new Error('No translation provider available')
      const template = promptTemplate || useSettingStore.getState().promptTemplates.scenery || '请完成一篇包含{input}的文章'
      const input = words.join(', ')
      return await provider.translate(input, template)
    },
  }
}
