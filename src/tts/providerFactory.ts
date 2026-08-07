import type { TTSProvider } from './types'
import type { CustomTTSConfig } from './types'
import { WebSpeechProvider } from './providers/webSpeech'
import { KokoroTrtProvider } from './providers/kokoroTrt'
import { EdgeTTSProvider } from './providers/edgeTts'

// 开发中 TTS 提供者（Kokoro TRT / Edge TTS）暂不对外展示，
// 后续启用时改为 true 即可
const SHOW_DEV_TTS_PROVIDERS = false

/**
 * 创建所有系统内置的 TTS 提供者
 */
export function createSystemTTSProviders(): TTSProvider[] {
  const providers: TTSProvider[] = [new WebSpeechProvider()]

  if (SHOW_DEV_TTS_PROVIDERS) {
    // Edge TTS: 免 Key 在线合成，浏览器/Electron 通用
    providers.push(new EdgeTTSProvider())

    // 仅在 Electron 环境且原生 TTS API 可用时添加 KokoroTrtProvider
    if (typeof window !== 'undefined' && window.electronAPI?.tts) {
      providers.push(new KokoroTrtProvider())
    }
  }

  return providers
}

/**
 * 根据配置创建用户自定义的 TTS 提供者（预留）
 * v1.0 返回空数组
 */
export function createCustomTTSProviders(_configs: CustomTTSConfig[]): TTSProvider[] {
  return []
}
