# TSBook2 API — 语音朗读（TTS）模块 (v2.2)

> v2.2 变更：**无功能性变更**。TTS 代码在 v2.2 周期内未被修改，仍以 [v2.1 tts.md](../v2.1/api/tts.md) 为准。
> 本文仅补充两处 v2.1 文档未记录/表述不准的要点。

## 13.1 已实现但默认不展示的 Provider（补充说明）

[v2.1 tts.md](../v2.1/api/tts.md) 将 `KokoroTrtProvider` 描述为「第二个系统内置 TTS Provider」。实际代码中它受开关控制：

```typescript
// src/tts/providerFactory.ts
// 开发中 TTS 提供者（Kokoro TRT / Edge TTS）暂不对外展示，
// 后续启用时改为 true 即可
const SHOW_DEV_TTS_PROVIDERS = false

export function createSystemTTSProviders(): TTSProvider[] {
  const providers: TTSProvider[] = [new WebSpeechProvider()]
  if (SHOW_DEV_TTS_PROVIDERS) {
    providers.push(new EdgeTTSProvider())                    // 免 Key 在线合成
    if (typeof window !== 'undefined' && window.electronAPI?.tts) {
      providers.push(new KokoroTrtProvider())                // ONNX Runtime + CUDA
    }
  }
  return providers
}
```

**因此默认运行时可用 Provider 只有 `WebSpeechProvider`**。`EdgeTTSProvider`（[providers/edgeTts.ts](../../../src/tts/providers/edgeTts.ts)）与 `KokoroTrtProvider`（[providers/kokoroTrt.ts](../../../src/tts/providers/kokoroTrt.ts)）源码与 IPC 通道均已就绪，但需要把该常量改为 `true` 才对外展示。

## 13.2 模块文件结构（实际）

```
src/tts/
├── types.ts              # TTSProvider / SpeakOptions / TTSVoice / TTSProviderInfo / CustomTTSConfig
├── providerFactory.ts    # createSystemTTSProviders() + createCustomTTSProviders()
└── providers/
    ├── webSpeech.ts      # WebSpeechProvider（浏览器 speechSynthesis，默认启用）
    ├── kokoroTrt.ts      # KokoroTrtProvider（IPC → C++ Napi Addon，默认隐藏）
    └── edgeTts.ts        # EdgeTTSProvider（IPC → 在线合成，默认隐藏）

src/services/ttsService.ts   # TTSService 实现 + getTTSService() 模块级单例
src/store/ttsSettingStore.ts # TTS 配置独立 Store
electron/handlers/ttsHandlers.ts     # tts:init / synthesize / getVoices / getStatus / destroy
electron/handlers/edgeTtsHandlers.ts # tts:edgeSynthesize / tts:edgeGetVoices
native/kokoro-trt-native/            # C++ Napi Addon 工程
```

> **v2.1 文档勘误**：v2.1 的 tts.md「实际模块文件结构」只列了 `webSpeech.ts` 与 `kokoroTrt.ts`，漏记 `edgeTts.ts` 及 `electron/handlers/edgeTtsHandlers.ts`。

## 13.3 TTSProvider 接口（实际）

```typescript
// src/tts/types.ts
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
  rate?: number    // 0.1~10，默认 1.0
  pitch?: number   // 0~2，默认 1.0
  volume?: number  // 0~1，默认 1.0
  voiceId?: string
  lang?: string    // 如 'en-US'
}

export interface TTSVoice {
  voiceId: string
  name: string
  lang: string
  localService: boolean
}

export interface CustomTTSConfig {   // 预留，createCustomTTSProviders 返回空数组
  name: string
  backend: string    // "openai-tts" | "azure-tts" | "google-tts"
  apiKeyEnv: string
  endpoint: string
  model?: string
  voice?: string
  timeout: number
  enabled: boolean
}
```

`supportsPause`（useTTSService 返回值）通过 `provider?.pause !== undefined && provider?.resume !== undefined` 动态判定。

## 13.4 TTS 配置默认值

```typescript
// src/store/ttsSettingStore.ts
const defaultTTS: TTSSettings = {
  enabled: true,
  provider: 'system_WebSpeech',
  rate: 0.9,
  volume: 1.0,
  voiceId: '',
}
```

> `useTTSService.speak()` 在 `ttsEnabled === false` 时直接返回，不发声。
