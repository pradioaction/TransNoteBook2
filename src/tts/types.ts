export interface TTSProvider {
  readonly id: string
  readonly name: string
  readonly type: 'system' | 'custom'
  readonly backend: string
  speak(text: string, options?: SpeakOptions, signal?: AbortSignal): Promise<void>
  stop(): void
  pause?(): void
  resume?(): void
  getVoices(): Promise<TTSVoice[]>
  getInfo(): TTSProviderInfo
}

export interface SpeakOptions {
  rate?: number      // 语速 0.1~10，默认 1.0
  pitch?: number     // 音调 0~2，默认 1.0
  volume?: number    // 音量 0~1，默认 1.0
  voiceId?: string   // 语音 ID
  lang?: string      // 语言标签，如 'en-US'
}

export interface TTSVoice {
  voiceId: string
  name: string
  lang: string
  localService: boolean
}

export interface TTSProviderInfo {
  id: string
  name: string
  type: 'system' | 'custom'
  backend: string
}

export interface CustomTTSConfig {
  name: string
  backend: string        // "openai-tts" | "azure-tts" | "google-tts"
  apiKeyEnv: string
  endpoint: string
  model?: string
  voice?: string
  timeout: number
  enabled: boolean
}
