import { useRef, useState, useCallback } from 'react'
import { getTTSService } from '@/services/ttsService'

interface SpeekOptions {
  speed?: 'normal' | 'slow'
  intervalMs?: number
  readWordFirst?: boolean
}

export function useSpeek() {
  const service = useRef(getTTSService())
  const abortControllerRef = useRef<AbortController | null>(null)
  const [speeking, setSpeeking] = useState(false)

  const stopSpeek = useCallback(() => {
    abortControllerRef.current?.abort()
    service.current.stop()
    setSpeeking(false)
  }, [])

  const speek = useCallback(
    async (word: string, options?: SpeekOptions) => {
      // 停止上一次拼读
      stopSpeek()

      const controller = new AbortController()
      abortControllerRef.current = controller
      setSpeeking(true)

      const {
        speed = 'normal',
        intervalMs: customIntervalMs,
        readWordFirst = true,
      } = options ?? {}

      const intervalMs = customIntervalMs ?? (speed === 'slow' ? 800 : 400)

      try {
        // 步骤 1：先整词朗读
        if (readWordFirst) {
          if (controller.signal.aborted) return
          await service.current.speak(word)
        }

        // 步骤 2：逐个字母朗读
        for (const char of word) {
          if (controller.signal.aborted) return

          await service.current.speak(char)

          if (controller.signal.aborted) return

          // 字母之间的等待间隔，可被 abort 中断
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, intervalMs)
            const onAbort = () => {
              clearTimeout(timer)
              resolve()
            }
            controller.signal.addEventListener('abort', onAbort, { once: true })
          })
        }
      } catch (error) {
        // 被 stopSpeek() 中止导致的异常，静默忽略
        if (controller.signal.aborted) return
        // 其他异常恢复 speeking 状态后重新抛出
        setSpeeking(false)
        throw error
      } finally {
        // 只有当前控制器仍然是最新的，才更新状态
        if (abortControllerRef.current === controller) {
          setSpeeking(false)
        }
      }
    },
    [stopSpeek],
  )

  return { speek, stopSpeek, speeking }
}
