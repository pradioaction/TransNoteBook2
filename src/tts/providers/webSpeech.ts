import type { TTSProvider, SpeakOptions, TTSVoice, TTSProviderInfo } from '../types'

export class WebSpeechProvider implements TTSProvider {
  readonly id = 'system_WebSpeech'
  readonly name = 'Web Speech API'
  readonly type = 'system' as const
  readonly backend = 'web-speech'

  private currentUtterance: SpeechSynthesisUtterance | null = null
  private config: { defaultRate: number; defaultPitch: number; defaultVolume: number; defaultLang: string }
  private voiceLoadPromise: Promise<TTSVoice[]> | null = null

  constructor(config?: { defaultRate?: number; defaultPitch?: number; defaultVolume?: number; defaultLang?: string; defaultVoiceName?: string }) {
    this.config = {
      defaultRate: config?.defaultRate ?? 0.9,
      defaultPitch: config?.defaultPitch ?? 1.0,
      defaultVolume: config?.defaultVolume ?? 1.0,
      defaultLang: config?.defaultLang ?? 'en-US',
    }
  }

  async speak(text: string, options?: SpeakOptions, signal?: AbortSignal): Promise<void> {
    // 1. 检查浏览器是否支持
    if (!window.speechSynthesis) {
      throw new Error('TTSNotSupportedError: 当前浏览器不支持语音合成')
    }

    // 2. 如果 signal 已经触发，直接 reject
    if (signal?.aborted) {
      throw new Error('TTSCancelledError: 朗读已取消')
    }

    // 3. 创建 utterance
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = options?.lang || this.config.defaultLang
    utterance.rate = options?.rate ?? this.config.defaultRate
    utterance.pitch = options?.pitch ?? this.config.defaultPitch
    utterance.volume = options?.volume ?? this.config.defaultVolume
    this.currentUtterance = utterance

    // 4. 如果有 voiceId，尝试匹配语音
    if (options?.voiceId) {
      const voices = await this.getVoices()
      const matched = voices.find(v => v.voiceId === options.voiceId)
      if (matched) {
        utterance.voice = window.speechSynthesis.getVoices().find(v => v.name === matched.name && v.lang === matched.lang) || null
      }
    }

    // 5. 返回 Promise
    return new Promise((resolve, reject) => {
      // 监听停止事件（AbortSignal）
      const onAbort = () => {
        window.speechSynthesis.cancel()
        this.currentUtterance = null
        reject(new Error('TTSCancelledError: 朗读已取消'))
      }

      // 监听 signal
      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true })
      }

      utterance.onend = () => {
        if (signal) signal.removeEventListener('abort', onAbort)
        this.currentUtterance = null
        resolve()
      }

      utterance.onerror = (event) => {
        if (signal) signal.removeEventListener('abort', onAbort)
        this.currentUtterance = null
        // 如果是被 cancel 触发的不算错误，静默忽略
        if (event.error === 'canceled' || event.error === 'interrupted') {
          reject(new Error('TTSCancelledError: 朗读已取消'))
        } else {
          reject(new Error(`TTS error: ${event.error}`))
        }
      }

      window.speechSynthesis.speak(utterance)
    })
  }

  stop(): void {
    window.speechSynthesis.cancel()
    this.currentUtterance = null
  }

  pause(): void {
    window.speechSynthesis.pause()
  }

  resume(): void {
    window.speechSynthesis.resume()
  }

  async getVoices(): Promise<TTSVoice[]> {
    // 如果有缓存的 Promise，直接返回
    if (this.voiceLoadPromise) return this.voiceLoadPromise

    this.voiceLoadPromise = new Promise<TTSVoice[]>((resolve) => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        resolve(this.mapVoices(voices))
        return
      }
      // 语音尚未加载，等待 onvoiceschanged 事件
      window.speechSynthesis.onvoiceschanged = () => {
        const loadedVoices = window.speechSynthesis.getVoices()
        resolve(this.mapVoices(loadedVoices))
      }
      // 超时兜底
      setTimeout(() => {
        const fallback = window.speechSynthesis.getVoices()
        resolve(this.mapVoices(fallback.length > 0 ? fallback : []))
      }, 3000)
    })

    return this.voiceLoadPromise
  }

  private mapVoices(voices: SpeechSynthesisVoice[]): TTSVoice[] {
    return voices.map(v => ({
      voiceId: `${v.name}_${v.lang}`,
      name: v.name,
      lang: v.lang,
      localService: v.localService,
    }))
  }

  getInfo(): TTSProviderInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      backend: this.backend,
    }
  }
}
