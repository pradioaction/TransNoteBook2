import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { createTranslationService } from '@/services/translationService'
import type { TranslationService, OperationStatus } from '@/services/types'
import type { ProviderInfo } from '@/translation/types'
import { useNotebookStore } from '@/store/notebookStore'
import { useSettingStore } from '@/store/settingStore'

let serviceInstance: TranslationService | null = null

function getService(): TranslationService {
  if (!serviceInstance) {
    serviceInstance = createTranslationService({
      getSettingState: () => useSettingStore.getState(),
      getNotebook: () => useNotebookStore.getState().notebook,
      updateCellOutput: (index, output) => useNotebookStore.getState().updateCellOutput(index, output),
      setModified: (v) => useNotebookStore.getState().setModified(v),
    })
  }
  return serviceInstance
}

export function useTranslationService() {
  const service = useMemo(() => getService(), [])
  const [status, setStatus] = useState<OperationStatus>(() => service.getStatus())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const s = service.getStatus()
      setStatus((prev) => {
        if (
          prev.state === s.state &&
          prev.currentIndex === s.currentIndex &&
          prev.totalCount === s.totalCount &&
          prev.progress === s.progress &&
          prev.error === s.error
        ) {
          return prev
        }
        return { ...s }
      })
    }, 200)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [service])

  const translateCell = useCallback(
    async (index: number) => {
      try {
        await service.translateCell(index)
      } catch { /* errors reflected in status */ }
    },
    [service]
  )

  const translateAll = useCallback(async () => {
    try {
      await service.translateAll()
    } catch { /* errors reflected in status */ }
  }, [service])

  const testConnection = useCallback(
    async (providerId: string): Promise<{ success: boolean; error?: string }> => {
      return await service.testConnection(providerId)
    },
    [service]
  )

  const cancel = useCallback(() => {
    service.cancel()
  }, [service])

  const listProviders = useCallback((): ProviderInfo[] => {
    return service.listProviders()
  }, [service])

  const setCurrentProvider = useCallback(
    (providerId: string) => {
      service.setCurrentProvider(providerId)
    },
    [service]
  )

  const generateSceneText = useCallback(
    async (words: string[], promptTemplate?: string): Promise<string> => {
      return await service.generateSceneText(words, promptTemplate)
    },
    [service]
  )

  const reviewCell = useCallback(
    async (index: number, promptTemplate?: string): Promise<void> => {
      await service.reviewCell(index, promptTemplate)
    },
    [service]
  )

  return {
    status,
    translateCell,
    translateAll,
    testConnection,
    cancel,
    listProviders,
    setCurrentProvider,
    generateSceneText,
    reviewCell,
  }
}
