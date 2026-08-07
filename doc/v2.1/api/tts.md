# TSBook2 API -- 语音朗读（TTS）模块

> v2.1 修正：TTS 状态存储位置从 `recitationStore` → `ttsSettingStore`，TTSService 改为 `getTTSService()` 模块级单例，两个 hook 共用同一实例。

语音朗读模块采用**多 Provider 策略模式**设计，类型定义在 `src/tts/`，服务实现位于 `src/services/ttsService.ts`。架构与翻译模块（`translation/`）保持一致。

> **当前实现**：内置 `WebSpeechProvider`（浏览器 Web Speech API）和 `KokoroTrtProvider`（ONNX Runtime + CUDA GPU 加速，基于 C++ Napi Addon），架构预留后续接入在线 TTS API 的能力。

---

## 13.1 实际模块文件结构 (v2.1)

```
src/tts/
├── types.ts              # TTSProvider 接口 + SpeakOptions / TTSVoice / TTSProviderInfo / CustomTTSConfig
├── providerFactory.ts    # createSystemTTSProviders() + createCustomTTSProviders()
└── providers/
    ├── webSpeech.ts      # WebSpeechProvider（浏览器 speechSynthesis）
    └── kokoroTrt.ts      # KokoroTrtProvider（ONNX Runtime + CUDA GPU，通过 IPC 调用 C++ Addon）★ v2.1 新增

src/services/
└── ttsService.ts         # TTSService 实现 + getTTSService() 模块级单例导出

src/store/
└── ttsSettingStore.ts    # TTS 配置独立 Store（v2.1 从 settingStore 拆分）

electron/handlers/
└── ttsHandlers.ts        # Kokoro TTS 主进程 IPC Handler（tts:init / tts:synthesize 等 5 个通道）★ v2.1 新增

native/kokoro-trt-native/ # C++ Napi Addon 项目 ★ v2.1 新增
├── CMakeLists.txt        # 构建配置（CUDA + ONNX Runtime + Napi）
├── package.json
└── src/
    ├── main.cc           # Napi 模块入口
    ├── napi_engine.h/.cc # JS 可调用类（initialize / synthesize / getVoices / destroy）
    ├── tokenizer.h/.cc   # 文本 → token ID
    ├── phonemizer.h/.cc  # 文本 → 音素 ID（加载官方 tokens.txt 映射）
    ├── ort_inference.h/.cc  # ONNX Runtime + CUDA EP GPU 推理
    ├── voice_manager.h/.cc  # voices.bin 语音嵌入管理（46 个语音）
    ├── audio_decoder.h/.cc  # Griffin-Lim mel→PCM（保留，Kokoro 不调用）
    ├── trt_inference.h/.cc  # TensorRT 推理（保留，备用）
    └── model_cache.h/.cc    # ONNX→TRT engine 缓存（保留）
```

**模型文件**（位于 `model/kokoro-int8-multi-lang-v1_0/`）：
- `model.onnx` — FP32 ONNX 模型（ORT 直接加载，~326MB）
- `tokens.txt` — 音素→ID 映射表（114 个 IPA 音素）
- `voices.bin` — 47 个语音嵌入向量（256 维）
- `lexicon-us-en.txt` / `lexicon-gb-en.txt` — 英文发音词典
- `lexicon-zh.txt` — 中文发音词典
- `espeak-ng-data/` — eSpeak-NG 多语言音素数据

---

## 13.5 TTSService (v2.1 修正)

TTSService 通过 `getTTSService()` 返回模块级惰性单例，`useTTSService` 和 `useSpeek` 两个 hook **共用同一实例**，确保 `stop()` 可跨 hook 生效。

```typescript
// src/services/ttsService.ts
export function getTTSService(): TTSService  // 惰性单例
export function createTTSService(): TTSService  // 工厂函数

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
```

---

## 13.6 useTTSService Hook (v2.1 修正)

配置项（rate, volume, voiceId, provider, enabled）从 `ttsSettingStore` 读取，而非 `settingStore`。

```typescript
// src/hooks/useTTSService.ts
import { getTTSService } from '@/services/ttsService'
import { useTTSSettingStore } from '@/store/ttsSettingStore'

const ttsService = getTTSService()  // 单例

export function useTTSService(): {
  speak(text: string, options?: SpeakOptions): Promise<void>
  stop: () => void
  pause: () => void
  resume: () => void
  speaking: boolean
  supportsPause: boolean
  currentProvider: TTSProviderInfo | null
  providers: TTSProviderInfo[]
  setProvider: (providerId: string) => void
  voices: TTSVoice[]
  voiceId: string
  setVoice: (voiceId: string) => void
  rate: number
  setRate: (rate: number) => void
  volume: number
  setVolume: (volume: number) => void
}
```

---

## 13.7 配置持久化 (v2.1 修正)

TTS 配置通过 `ttsSettingStore` 独立管理，读取/写入 `electronAPI.getSettings()/setSettings()` 的 `tts` 字段（与 settings.json 合并存储，不覆盖其他字段）：

```typescript
// src/store/ttsSettingStore.ts
export interface TTSSettings {
  enabled: boolean
  provider: string
  rate: number
  volume: number
  voiceId: string
}

interface TTSSettingStore {
  tts: TTSSettings
  setTTS: (settings: Partial<TTSSettings>) => void  // 500ms debounced 保存
  loadFromDisk: () => Promise<void>
  saveToDisk: () => Promise<void>
}
```

`saveToDisk()` 行为：先读取现有全部 settings → 合并 `tts` 字段 → 写回，避免覆盖其他设置。

---

## 13.9 Speek 功能 (v2.1 修正)

`useSpeek` 与 `useTTSService` 共用同一个 `getTTSService()` 单例：

```typescript
// src/hooks/useSpeek.ts
import { getTTSService } from '@/services/ttsService'

export function useSpeek(): {
  speek: (word: string, options?: SpeekOptions) => Promise<void>
  stopSpeek: () => void
  speeking: boolean
}
```

> **v2.1 变更**：移除独立的 `serviceInstance` 和 `getService()`，改为 `getTTSService()` 共用单例。

---

## 13.10 KokoroTrtProvider — GPU 加速 TTS ★ v2.1 新增

`KokoroTrtProvider` 是第二个系统内置 TTS Provider，通过 Electron IPC 调用主进程中的 C++ Napi Addon，使用 ONNX Runtime + CUDA EP 在 GPU 上执行 Kokoro-82M 模型推理。

### 数据流

```
Renderer                          Main Process
  KokoroTrtProvider.speak()
    → window.electronAPI.tts.synthesize()
         (IPC: tts:synthesize)
                                    → ttsHandlers.ts
                                      → C++ KokoroTRTEngine.synthesize()
                                        → Tokenizer → Phonemizer
                                        → ORTInference (CUDA EP)
                                        → PCM float32[] 返回
    ← PCM 音频数据
    → Web Audio API 播放
```

### IPC 通道

| 通道 | 方向 | 说明 |
|---|---|---|
| `tts:init` | Renderer → Main | 初始化引擎（加载 model.onnx，配置 CUDA EP） |
| `tts:synthesize` | Renderer → Main | 合成语音（text + voiceId + speed → PCM 采样） |
| `tts:getVoices` | Renderer → Main | 获取可用语音列表（46 个） |
| `tts:getStatus` | Renderer → Main | 查询引擎状态（GPU 设备名等） |
| `tts:destroy` | Renderer → Main | 释放 GPU 资源 |

### 模型信息

| 项目 | 详情 |
|---|---|
| 模型 | Kokoro-82M v1.0 (Apache 2.0) |
| 推理后端 | ONNX Runtime 1.27 + CUDA 12.8 + cuDNN 9 |
| GPU | NVIDIA RTX 3060 (12GB) |
| 采样率 | 24000 Hz, mono |
| 语音 | 46 个（覆盖 en/zh/ja/fr/ko/pt/es/hi/it） |
| 推理速度 | ~0.15 RTF（6 倍实时，首次推理有 CUDA kernel 编译开销） |

### 环境依赖

编译时需要：Visual Studio 2022, CMake 3.20+, CUDA 12.8, ONNX Runtime 1.27 SDK。
运行时需要：`onnxruntime.dll` + `onnxruntime_providers_cuda.dll` + `cudnn64_9.dll`。

### 降级策略

KokoroTrtProvider 初始化失败（无 GPU 或驱动问题）→ Provider 注册表中回退到 `WebSpeechProvider`，用户无感知。

### 已知限制

- 中文音素转换（FST 解析）尚未完整实现，当前依靠 lexicon-zh.txt 查表
- `destroy()` 调用后可能存在 ORT atexit 冲突，推荐进程退出时直接 `process.exit(0)`
