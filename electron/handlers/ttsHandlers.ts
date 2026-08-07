/**
 * ttsHandlers.ts — Kokoro TRT TTS 的 Electron IPC Handlers
 *
 * 在主进程中注册, 管理 C++ addon 实例
 * 通道:
 *   tts:init       → 初始化引擎 (加载模型, ONNX → TRT)
 *   tts:synthesize → 文本合成语音
 *   tts:getVoices  → 获取可用语音列表
 *   tts:getStatus  → 获取引擎状态
 *   tts:destroy    → 释放 GPU 资源
 */

import { ipcMain, app } from 'electron'
import path from 'path'

// ============================================================
// 类型 (与 renderer 侧一致)
// ============================================================
interface SynthesizeRequest {
  text: string
  voiceId: string
  speed: number
  lang: string
}

interface SynthesizeResult {
  sampleRate: number
  channels: number
  samples: number[]
  duration: number
}

interface VoiceInfo {
  voiceId: string
  name: string
  lang: string
  gender: string
}

interface EngineStatusResult {
  initialized: boolean
  modelLoaded: boolean
  trtAvailable: boolean
  deviceName: string
  vramUsed: number
}

// ============================================================
// KokoroTRTEngine 类型 (来自 C++ addon)
// ============================================================
interface KokoroTRTEngine {
  initialize(): Promise<boolean>
  synthesize(
    text: string,
    opts: { voiceId: string; speed: number; lang: string },
  ): Promise<{
    sampleRate: number
    channels: number
    samples: Float32Array
    duration: number
  }>
  getVoices(lang?: string): Promise<VoiceInfo[]>
  getStatus(): {
    initialized: boolean
    modelLoaded: boolean
    trtAvailable: boolean
    deviceName: string
    vramUsed: number
  }
  destroy(): boolean
}

// ============================================================
// 状态
// ============================================================
let _engine: KokoroTRTEngine | null = null
let _initPromise: Promise<void> | null = null

// 打包后模型在 extraResources，用 process.resourcesPath；
// 开发期模型在项目根目录，用 app.getAppPath()
const isPackaged = app.isPackaged
const MODEL_DIR = isPackaged
  ? path.join(process.resourcesPath, 'model', 'kokoro-int8-multi-lang-v1_0')
  : path.join(app.getAppPath(), 'model', 'kokoro-int8-multi-lang-v1_0')
const CACHE_DIR = path.join(app.getPath('userData'), 'kokoro-trt-cache')

// ============================================================
// 工具: 加载 C++ addon
// ============================================================
function getNativeModule(): { KokoroTRTEngine: new (
  config: { modelDir: string; cacheDir?: string; deviceId?: number },
) => KokoroTRTEngine } | null {
  try {
    // 打包后 .node 文件在 extraResources/native/ 下；
    // 开发期在项目根目录下
    const nativeDir = isPackaged
      ? path.join(process.resourcesPath, 'native')
      : path.join(app.getAppPath(), 'native', 'kokoro-trt-native', 'build', 'Release')

    const addonPath = path.join(nativeDir, 'kokoro_trt_native.node')
    return require(addonPath)
  } catch {
    console.warn('[TTS] Failed to load kokoro-trt-native addon')
    return null
  }
}

// ============================================================
// 注册 Handlers
// ============================================================
export function registerTtsHandlers(): void {
  // ──── 1. 初始化 ────
  ipcMain.handle('tts:init', async (): Promise<EngineStatusResult> => {
    if (_initPromise) await _initPromise

    if (_engine) {
      const s = _engine.getStatus()
      return {
        initialized: s.initialized,
        modelLoaded: s.modelLoaded,
        trtAvailable: s.trtAvailable,
        deviceName: s.deviceName,
        vramUsed: s.vramUsed,
      }
    }

    _initPromise = (async () => {
      const native = getNativeModule()
      if (!native) {
        return
      }

      _engine = new native.KokoroTRTEngine({
        modelDir: MODEL_DIR,
        cacheDir: CACHE_DIR,
      })

      await _engine.initialize()
    })()

    try {
      await _initPromise
      const s = _engine!.getStatus()
      return {
        initialized: s.initialized,
        modelLoaded: s.modelLoaded,
        trtAvailable: s.trtAvailable,
        deviceName: s.deviceName,
        vramUsed: s.vramUsed,
      }
    } catch (err) {
      console.error('[TTS] 引擎初始化失败:', err)
      _engine = null
      _initPromise = null
      return {
        initialized: false,
        modelLoaded: false,
        trtAvailable: false,
        deviceName: 'ERROR',
        vramUsed: 0,
      }
    }
  })

  // ──── 2. 合成 ────
  ipcMain.handle(
    'tts:synthesize',
    async (_event, req: SynthesizeRequest): Promise<SynthesizeResult> => {
      if (!_engine) {
        throw new Error('TTS 引擎未初始化, 请先调用 tts:init')
      }

      const result = await _engine.synthesize(req.text, {
        voiceId: req.voiceId,
        speed: req.speed,
        lang: req.lang,
      })

      // Float32Array → number[] (结构化克隆兼容)
      return {
        sampleRate: result.sampleRate,
        channels: result.channels,
        samples: Array.from(result.samples),
        duration: result.duration,
      }
    },
  )

  // ──── 3. 语音列表 ────
  ipcMain.handle(
    'tts:getVoices',
    async (_event, lang?: string): Promise<VoiceInfo[]> => {
      if (!_engine) return []
      return _engine.getVoices(lang)
    },
  )

  // ──── 4. 状态 ────
  ipcMain.handle('tts:getStatus', async (): Promise<EngineStatusResult> => {
    if (!_engine) {
      return {
        initialized: false,
        modelLoaded: false,
        trtAvailable: false,
        deviceName: 'N/A',
        vramUsed: 0,
      }
    }
    const s = _engine.getStatus()
    return {
      initialized: s.initialized,
      modelLoaded: s.modelLoaded,
      trtAvailable: s.trtAvailable,
      deviceName: s.deviceName,
      vramUsed: s.vramUsed,
    }
  })

  // ──── 5. 销毁 ────
  ipcMain.handle('tts:destroy', async () => {
    if (_engine) {
      _engine.destroy()
      _engine = null
      _initPromise = null
    }
    return true
  })
}

// ──── 应用退出时释放 GPU 资源 ────
app.on('before-quit', () => {
  if (_engine) {
    _engine.destroy()
    _engine = null
  }
})
