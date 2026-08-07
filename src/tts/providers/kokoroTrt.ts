/**
 * kokoroTrt.ts — Kokoro TensorRT TTS Provider
 *
 * 实现 TTSProvider 接口, 通过 Electron IPC 调用 C++ Napi Addon
 * 数据流: text → IPC → main process → C++ → TensorRT GPU → PCM → Web Audio API 播放
 */

import type { TTSProvider, SpeakOptions, TTSVoice, TTSProviderInfo } from '../types'

// ============================================================
// IPC 响应类型 (与 electron/handlers/ttsHandlers.ts 保持一致)
// ============================================================
interface SynthesizeIPCResult {
  sampleRate: number
  channels: number
  samples: number[]
  duration: number
}

interface VoiceIPCResult {
  voiceId: string
  name: string
  lang: string
  gender: string
}

interface EngineStatusIPC {
  initialized: boolean
  modelLoaded: boolean
  trtAvailable: boolean
  deviceName: string
  vramUsed: number
}

// ============================================================
// KokoroTrtProvider
// ============================================================
export class KokoroTrtProvider implements TTSProvider {
  readonly id = 'system_KokoroTRT'
  readonly name = 'Kokoro (TensorRT GPU)'
  readonly type = 'system' as const
  readonly backend = 'kokoro-trt'

  private defaultVoiceId: string
  private defaultSpeed: number
  private _initialized = false
  private _activeContext: AudioContext | null = null
  private _pendingInit: Promise<void> | null = null

  constructor(config?: { defaultVoiceId?: string; defaultSpeed?: number }) {
    this.defaultVoiceId = config?.defaultVoiceId ?? 'af_heart'
    this.defaultSpeed = config?.defaultSpeed ?? 1.0
  }

  // ============================================================
  // 懒初始化
  // ============================================================
  private async ensureInit(): Promise<void> {
    if (this._initialized) return

    // 防止并发初始化
    if (this._pendingInit) return this._pendingInit

    this._pendingInit = this._doInit()
    return this._pendingInit
  }

  private async _doInit(): Promise<void> {
    const api = window.electronAPI?.tts
    if (!api) {
      console.warn('[KokoroTRT] Electron API 不可用')
      return
    }

    try {
      const status: EngineStatusIPC = await api.init()
      if (status.initialized) {
        this._initialized = true
        console.log(
          `[KokoroTRT] 引擎就绪 | GPU: ${status.deviceName} | ` +
          `TRT: ${status.trtAvailable ? '已启用' : '不可用'}`
        )
      } else {
        console.warn('[KokoroTRT] 引擎初始化未完成:', status)
      }
    } catch (err) {
      console.error('[KokoroTRT] 初始化异常:', err)
      this._pendingInit = null
      throw err
    }
  }

  // ============================================================
  // TTSProvider.speak()
  // ============================================================
  async speak(
    text: string,
    options?: SpeakOptions,
    _signal?: AbortSignal,
  ): Promise<void> {
    await this.ensureInit()

    const api = window.electronAPI?.tts
    if (!api) {
      throw new Error('TTS Electron API 不可用')
    }

    const voiceId = options?.voiceId ?? this.defaultVoiceId
    const speed = options?.rate ?? this.defaultSpeed
    const volume = options?.volume ?? 1.0
    const lang = options?.lang ?? this.detectLang(text)

    // 调用主进程 → C++ TensorRT 推理
    const result: SynthesizeIPCResult = await api.synthesize({
      text,
      voiceId,
      speed,
      lang,
    })

    // PCM float32 → AudioBuffer → 播放
    await this.playAudio(result, volume)
  }

  // ============================================================
  // TTSProvider.stop()
  // ============================================================
  stop(): void {
    if (this._activeContext) {
      this._activeContext.close().catch(() => {})
      this._activeContext = null
    }
  }

  // ============================================================
  // TTSProvider.getVoices()
  // ============================================================
  async getVoices(): Promise<TTSVoice[]> {
    const api = window.electronAPI?.tts
    if (!api) return []

    try {
      await this.ensureInit()
      const kVoices: VoiceIPCResult[] = await api.getVoices()
      return kVoices.map((v) => ({
        voiceId: v.voiceId,
        name: `${v.name} (${v.lang})`,
        lang: v.lang,
        localService: true,
      }))
    } catch {
      return []
    }
  }

  // ============================================================
  // TTSProvider.getInfo()
  // ============================================================
  getInfo(): TTSProviderInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      backend: this.backend,
    }
  }

  // ============================================================
  // 音频播放
  // ============================================================
  private async playAudio(
    result: SynthesizeIPCResult,
    volume: number,
  ): Promise<void> {
    const sampleRate = result.sampleRate
    const float32 = new Float32Array(result.samples)

    // 创建 AudioContext (指定 Kokoro 输出采样率)
    this._activeContext = new AudioContext({ sampleRate })
    const buffer = this._activeContext.createBuffer(1, float32.length, sampleRate)
    buffer.copyToChannel(float32, 0)

    const source = this._activeContext.createBufferSource()
    source.buffer = buffer

    // 音量控制
    const gain = this._activeContext.createGain()
    gain.gain.value = Math.max(0, Math.min(1, volume))

    source.connect(gain)
    gain.connect(this._activeContext.destination)

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this._activeContext?.close().catch(() => {})
        this._activeContext = null
      }
      source.onended = () => { cleanup(); resolve() }
      source.onerror = () => { cleanup(); reject(new Error('音频播放失败')) }
      source.start()
    })
  }

  // ============================================================
  // 工具: 语言检测
  // ============================================================
  private detectLang(text: string): string {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) return 'zh'
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'
    return 'en'
  }
}
