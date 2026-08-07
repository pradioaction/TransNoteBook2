import type { TTSProvider, SpeakOptions, TTSVoice, TTSProviderInfo } from '@/tts/types'
import type { CustomTTSConfig } from '@/tts/types'
import { createSystemTTSProviders, createCustomTTSProviders } from '@/tts/providerFactory'

export interface TTSService {
  speak(text: string, options?: SpeakOptions): Promise<void>
  stop(): void
  pause(): void
  resume(): void
  listProviders(): TTSProviderInfo[]
  setCurrentProvider(providerId: string): void
  getCurrentProviderId(): string
  getVoices(): Promise<TTSVoice[]>
  getProvider(): TTSProvider | undefined
}

let _instance: TTSService | null = null

export function getTTSService(): TTSService {
  if (!_instance) {
    _instance = createTTSService()
  }
  return _instance
}

export function createTTSService(): TTSService {
  let systemProviders = createSystemTTSProviders()
  let customProviders: TTSProvider[] = []
  let currentProviderId = 'system_WebSpeech'

  const getProvider = (providerId?: string): TTSProvider | undefined => {
    const id = providerId || currentProviderId
    return [...systemProviders, ...customProviders].find(p => p.id === id)
  }

  const getAllProviders = (): TTSProvider[] => {
    return [...systemProviders, ...customProviders]
  }

  // 切换到新的 provider 时，先停止当前朗读
  const stopIfSpeaking = () => {
    const current = getProvider()
    if (current) {
      current.stop()
    }
  }

  return {
    speak: async (text: string, options?: SpeakOptions) => {
      const provider = getProvider()
      if (!provider) throw new Error('No TTS provider available')
      return provider.speak(text, options)
    },

    stop: () => {
      const provider = getProvider()
      if (provider) provider.stop()
    },

    pause: () => {
      const provider = getProvider()
      if (provider && provider.pause) provider.pause()
    },

    resume: () => {
      const provider = getProvider()
      if (provider && provider.resume) provider.resume()
    },

    listProviders: () => {
      return getAllProviders().map(p => p.getInfo())
    },

    setCurrentProvider: (providerId: string) => {
      if (getProvider(providerId)) {
        stopIfSpeaking()
        currentProviderId = providerId
      }
    },

    getCurrentProviderId: () => currentProviderId,

    getVoices: async () => {
      const provider = getProvider()
      if (!provider) return []
      return provider.getVoices()
    },

    getProvider: () => getProvider(),
  }
}
