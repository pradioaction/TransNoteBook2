import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { getTTSService } from '@/services/ttsService'
import type { TTSVoice, TTSProviderInfo, SpeakOptions } from '@/tts/types'
import { useTTSSettingStore } from '@/store/ttsSettingStore'

const ttsService = getTTSService()

export function useTTSService() {
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState<TTSVoice[]>([])
  const [voiceId, setVoiceIdState] = useState<string>('')

  const speakingRef = useRef(false)

  // Reactive store bindings for TTS config from ttsSettingStore
  const ttsEnabled = useTTSSettingStore((s) => s.tts.enabled)
  const ttsRate = useTTSSettingStore((s) => s.tts.rate)
  const ttsVolume = useTTSSettingStore((s) => s.tts.volume)
  const ttsProvider = useTTSSettingStore((s) => s.tts.provider)

  // Load voices on mount and initialise voiceId from store
  useEffect(() => {
    ttsService.getVoices().then((v) => {
      setVoices(v)
      const storedVoiceId = useTTSSettingStore.getState().tts.voiceId
      if (storedVoiceId) {
        setVoiceIdState(storedVoiceId)
      } else if (v.length > 0) {
        setVoiceIdState(v[0].voiceId)
      }
    })
  }, [])

  const speak = useCallback(async (text: string, options?: SpeakOptions) => {
    // 检查 TTS 是否启用
    if (!ttsEnabled) return

    // 防抖：如果正在朗读则先 stop() 再重新开始
    if (speakingRef.current) {
      ttsService.stop()
    }
    speakingRef.current = true
    setSpeaking(true)
    try {
      await ttsService.speak(text, {
        ...options,
        rate: options?.rate ?? ttsRate,
        volume: options?.volume ?? ttsVolume,
        voiceId: options?.voiceId ?? voiceId,
      })
    } finally {
      speakingRef.current = false
      setSpeaking(false)
    }
  }, [ttsEnabled, ttsRate, ttsVolume, voiceId])

  const stop = useCallback(() => {
    ttsService.stop()
    speakingRef.current = false
    setSpeaking(false)
  }, [])

  const pause = useCallback(() => {
    ttsService.pause()
  }, [])

  const resume = useCallback(() => {
    ttsService.resume()
  }, [])

  const currentProvider = useMemo<TTSProviderInfo | null>(() => {
    const providers = ttsService.listProviders()
    return providers.find((p) => p.id === ttsProvider) ?? null
  }, [ttsProvider])

  const supportsPause = useMemo(() => {
    const provider = ttsService.getProvider()
    return provider?.pause !== undefined && provider?.resume !== undefined
  }, [ttsProvider])

  const providers = useMemo<TTSProviderInfo[]>(() => {
    return ttsService.listProviders()
  }, [])

  const setProvider = useCallback((providerId: string) => {
    ttsService.setCurrentProvider(providerId)
    useTTSSettingStore.getState().setTTS({ provider: providerId })
  }, [])

  const setVoice = useCallback((newVoiceId: string) => {
    setVoiceIdState(newVoiceId)
    useTTSSettingStore.getState().setTTS({ voiceId: newVoiceId })
  }, [])

  const setRate = useCallback((rate: number) => {
    useTTSSettingStore.getState().setTTS({ rate })
  }, [])

  const setVolume = useCallback((volume: number) => {
    useTTSSettingStore.getState().setTTS({ volume })
  }, [])

  return {
    speak,
    stop,
    pause,
    resume,
    speaking,
    supportsPause,
    currentProvider,
    providers,
    setProvider,
    voices,
    voiceId,
    setVoice,
    rate: ttsRate,
    setRate,
    volume: ttsVolume,
    setVolume,
  }
}
