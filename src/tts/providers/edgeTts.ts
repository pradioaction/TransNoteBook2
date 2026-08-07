/**
 * edgeTts.ts — Edge TTS Provider (Demo)
 *
 * 通过 Electron IPC 调用主进程 (ws 库直连微软 Edge 朗读服务)。
 * 浏览器原生 WebSocket 无法设置自定义 headers（微软服务器会拒绝），
 * 因此合成逻辑放在主进程，renderer 通过 IPC 获取 MP3 并播放。
 *
 * 数据流: text → IPC → 主进程(ws) → 微软服务器 → MP3(base64) → Web Audio API 播放
 *
 * 注意: 非官方接口，微软可能调整协议或限流，仅作 Demo 使用。
 */

import type { TTSProvider, SpeakOptions, TTSVoice, TTSProviderInfo } from '../types'

const MAX_TEXT_LENGTH = 1500 // 单次 SSML 请求的文本长度上限

// 内置兜底音色（在线列表获取失败时使用）
interface EdgeVoiceInfo {
  ShortName: string
  FriendlyName: string
  Locale: string
}

const FALLBACK_VOICES: EdgeVoiceInfo[] = [
  { ShortName: 'zh-CN-XiaoxiaoNeural', FriendlyName: 'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-YunxiNeural', FriendlyName: 'Microsoft Yunxi Online (Natural) - Chinese (Mainland)', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-YunjianNeural', FriendlyName: 'Microsoft Yunjian Online (Natural) - Chinese (Mainland)', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-XiaoyiNeural', FriendlyName: 'Microsoft Xiaoyi Online - Chinese (Mainland)', Locale: 'zh-CN' },
  { ShortName: 'zh-CN-liaoning-XiaobeiNeural', FriendlyName: 'Microsoft Xiaobei Online - Chinese (Liaoning)', Locale: 'zh-CN-liaoning' },
  { ShortName: 'en-US-AriaNeural', FriendlyName: 'Microsoft Aria Online (Natural) - English (United States)', Locale: 'en-US' },
  { ShortName: 'en-US-JennyNeural', FriendlyName: 'Microsoft Jenny Online (Natural) - English (United States)', Locale: 'en-US' },
  { ShortName: 'en-US-GuyNeural', FriendlyName: 'Microsoft Guy Online (Natural) - English (United States)', Locale: 'en-US' },
  { ShortName: 'en-US-ChristopherNeural', FriendlyName: 'Microsoft Christopher Online (Natural) - English (United States)', Locale: 'en-US' },
  { ShortName: 'en-GB-SoniaNeural', FriendlyName: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', Locale: 'en-GB' },
  { ShortName: 'ja-JP-NanamiNeural', FriendlyName: 'Microsoft Nanami Online (Natural) - Japanese (Japan)', Locale: 'ja-JP' },
  { ShortName: 'ko-KR-SunHiNeural', FriendlyName: 'Microsoft SunHi Online (Natural) - Korean (Korea)', Locale: 'ko-KR' },
]

// ============================================================
// EdgeTTSProvider
// ============================================================
export class EdgeTTSProvider implements TTSProvider {
  readonly id = 'system_EdgeTTS'
  readonly name = 'Edge TTS Demo'
  readonly type = 'system' as const
  readonly backend = 'edge-tts'

  private defaultVoiceId: string
  private _voiceCache: TTSVoice[] | null = null
  private _activeContext: AudioContext | null = null

  constructor(config?: { defaultVoiceId?: string }) {
    this.defaultVoiceId = config?.defaultVoiceId ?? 'zh-CN-XiaoxiaoNeural'
  }

  // ============================================================
  // TTSProvider.speak()
  // ============================================================
  async speak(
    text: string,
    options?: SpeakOptions,
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted) {
      throw new Error('TTSCancelledError: 朗读已取消')
    }

    // 校验 voiceId，避免传入其他 provider 的无效 voice 导致服务器报错
    const voiceId = await this.resolveVoiceId(options?.voiceId ?? this.defaultVoiceId)
    const rate = options?.rate ?? 1.0
    const volume = options?.volume ?? 1.0

    // 长文本切分为多个片段，逐段合成并顺序播放
    const chunks = splitText(text)
    for (const chunk of chunks) {
      if (signal?.aborted) {
        throw new Error('TTSCancelledError: 朗读已取消')
      }
      const mp3Data = await this.synthesizeChunk(chunk, voiceId, rate, signal)
      await this.playMp3(mp3Data, volume, signal)
    }
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
    if (this._voiceCache) return this._voiceCache
    try {
      const api = window.electronAPI?.edgeTts
      if (!api) throw new Error('Electron API 不可用')
      const list = await api.getVoices()
      if (!Array.isArray(list) || list.length === 0) throw new Error('empty list')
      this._voiceCache = list.map((v) => ({
        voiceId: v.ShortName,
        name: v.FriendlyName || v.ShortName,
        lang: v.Locale,
        localService: false,
      }))
      return this._voiceCache
    } catch {
      // 在线列表不可用（无网络 / 非 Electron），使用内置兜底
      this._voiceCache = FALLBACK_VOICES.map((v) => ({
        voiceId: v.ShortName,
        name: v.FriendlyName,
        lang: v.Locale,
        localService: false,
      }))
      return this._voiceCache
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

  /**
   * 校验请求的 voiceId 是否有效，无效时回退到默认音色
   * （防止从其他 provider 切换过来时残留无效的 voiceId）
   */
  private async resolveVoiceId(requested: string): Promise<string> {
    try {
      const voices = await this.getVoices()
      if (voices.some((v) => v.voiceId === requested)) return requested
    } catch {
      /* ignore */
    }
    return this.defaultVoiceId
  }

  // ============================================================
  // 单段文本合成 → MP3 (ArrayBuffer)  [走主进程 IPC]
  // ============================================================
  private async synthesizeChunk(
    text: string,
    voiceId: string,
    rate: number,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> {
    const api = window.electronAPI?.edgeTts
    if (!api) {
      throw new Error('Edge TTS 需要 Electron 环境')
    }

    const result = await api.synthesize({ text, voiceId, rate })

    // base64 → Uint8Array → ArrayBuffer
    const binary = atob(result.audio)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  // ============================================================
  // MP3 → AudioContext 播放
  // ============================================================
  private playMp3(
    data: ArrayBuffer,
    volume: number,
    signal?: AbortSignal,
  ): Promise<void> {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) {
      return Promise.reject(new Error('当前环境不支持 AudioContext'))
    }

    const ctx = new Ctor()
    this._activeContext = ctx

    const cleanup = () => {
      ctx.close().catch(() => {})
      if (this._activeContext === ctx) this._activeContext = null
    }

    return new Promise<void>((resolve, reject) => {
      ctx.decodeAudioData(
        data,
        (buffer) => {
          const source = ctx.createBufferSource()
          source.buffer = buffer

          const gain = ctx.createGain()
          gain.gain.value = Math.max(0, Math.min(1, volume))

          source.connect(gain)
          gain.connect(ctx.destination)

          const onAbort = () => {
            try {
              source.stop()
            } catch {
              /* ignore */
            }
            source.onended = null
            cleanup()
            reject(new Error('TTSCancelledError: 朗读已取消'))
          }
          if (signal) signal.addEventListener('abort', onAbort, { once: true })

          source.onended = () => {
            if (signal) signal.removeEventListener('abort', onAbort)
            cleanup()
            resolve()
          }
          source.start()
        },
        (err) => {
          cleanup()
          reject(new Error(`音频解码失败: ${String(err)}`))
        },
      )
    })
  }
}

// ============================================================
// 工具函数
// ============================================================

/** 长文本按自然断点切分，避免超过单次 SSML 长度限制 */
function splitText(text: string, maxLen = MAX_TEXT_LENGTH): string[] {
  const chunks: string[] = []
  let rest = text
  while (rest.length > maxLen) {
    const slice = rest.slice(0, maxLen)
    const breakIdx = Math.max(
      slice.lastIndexOf('。'),
      slice.lastIndexOf('！'),
      slice.lastIndexOf('？'),
      slice.lastIndexOf('\n'),
      slice.lastIndexOf('；'),
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf('.'),
      slice.lastIndexOf('，'),
    )
    const cut = breakIdx > maxLen * 0.3 ? breakIdx + 1 : maxLen
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest.length > 0) {
    chunks.push(rest)
  }
  return chunks
}
