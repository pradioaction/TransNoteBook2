# TSBook2 API — 语音朗读（TTS）模块 (v2.2)

> v2.2 变更：新增**答题自动朗读开关**（§13.5），`ttsSettingStore` 与 `useTTSService` 相应扩展；引擎侧（Provider / IPC / Kokoro）无变更，仍以 [v2.1 tts.md](../v2.1/api/tts.md) 为准。
> 本文另补充两处 v2.1 文档未记录/表述不准的要点。

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
  autoRead: { question: true, hint: false, answer: true, flip: true },  // v2.2 新增
}
```

> `useTTSService.speak()` 在 `ttsEnabled === false` 时直接返回，不发声。

## 13.5 答题自动朗读开关（autoRead）— v2.2 新增

### 类型定义

```typescript
// src/store/ttsSettingStore.ts
export interface TTSAutoReadSettings {
  question: boolean   // 切题时朗读题干单词（仅英文题干题型，不泄露答案）
  hint: boolean       // 答题前朗读答案单词作为提示（会提前听到答案）
  answer: boolean     // 作答后朗读所选选项的单词
  flip: boolean       // 翻卡时朗读卡片上的单词
}
```

默认值 `{ question: true, hint: false, answer: true, flip: true }`：`question` / `answer` / `flip` 保持 v2.1 既有行为，`hint` 默认关闭以保证升级后题目难度不变。

### 触发点与开关映射

| 触发时机 | 开关 | 朗读内容 | 位置 |
|---|---|---|---|
| 切题（延迟 100ms） | `question` | `q.word`（英文题干单词） | [QuizPanel.tsx](../../../src/components/recitation/QuizPanel.tsx#L347-L371) |
| 切题（延迟 100ms） | `hint` | 正确选项文本（答案单词） | 同上 `else` 分支 |
| 作答后 | `answer` | 所选选项的单词 | [QuizPanel.tsx](../../../src/components/recitation/QuizPanel.tsx#L242) |
| 翻卡 | `flip` | 卡片单词 | [QuizPanel.tsx](../../../src/components/recitation/QuizPanel.tsx#L373-L377) |

语速统一 `rate: 0.9`（未显式传时回落到 `ttsSettingStore.tts.rate`）。

### 设计约束

1. **手动朗读不受开关影响**：`SpeakButton` 直接调用 `useTTSService.speak()`，仅 `tts.enabled` 能全局静音；`autoRead.*` 只约束上述自动触发点。
2. **决策在 QuizPanel，TTS 层无感知**：`ttsService` / Provider 不知道「答题」场景的存在，依赖方向为 `QuizPanel → useTTSService → ttsSettingStore`，无反向依赖。
3. **按「使用场景」而非题型命名**：字段名不含 `word-to-meaning` / `meaning-to-word` 等 `quizTypes` 术语，题型增删不影响配置层。
4. **读取用 ref 快照**：`autoReadRef`（[QuizPanel.tsx#L46-L50](../../../src/components/recitation/QuizPanel.tsx#L46-L50)）在触发时机读取开关值。若把 `autoRead` 加入切题 `useEffect` 的依赖数组，改设置时会重跑 effect 并连带执行 `setIsFlipped(false)` / `setKbHoverOptionId(null)`，导致界面状态被意外重置。

### 配置持久化的向后兼容

旧版本 `settings.json` 无 `autoRead` 字段，`loadFromDisk()` 必须逐层兜底，否则读出的 `autoRead` 为 `undefined`：

```typescript
// src/store/ttsSettingStore.ts
const stored = (raw.tts ?? {}) as Partial<TTSSettings>
set({
  tts: {
    ...defaultTTS,
    ...stored,
    autoRead: { ...defaultAutoRead, ...(stored.autoRead ?? {}) },
  },
})
```

`setAutoRead(partial)` 亦对 `autoRead` 做浅合并，避免直接 `setTTS({ autoRead })` 覆盖整组。

### `QuizQuestion.word` 的语义陷阱（重要）

`QuizQuestion.word` 在三种题型下语义不一致，**不能**作为「答案单词」使用：

| 题型 | `word` 实际内容 | 出处 |
|---|---|---|
| `word-to-meaning` | 英文单词（= 题干） | [NotebookToolbar.tsx#L168](../../../src/components/notebook/NotebookToolbar.tsx#L168) |
| `meaning-to-word` | **中文释义（= 题干）** | [NotebookToolbar.tsx#L191](../../../src/components/notebook/NotebookToolbar.tsx#L191) |
| `cloze` | 英文单词（= 答案） | [NotebookToolbar.tsx#L242](../../../src/components/notebook/NotebookToolbar.tsx#L242) |

因此「答案单词」唯一稳定的取法是正确选项的文本：

```typescript
const correctText = q.options.find((o) => o.id === q.correctAnswer)?.text
```

同一取法已用于翻转卡数据（[QuizPanel.tsx#L195](../../../src/components/recitation/QuizPanel.tsx#L195)）与题干区朗读按钮（[FloatingOptions.tsx#L285-L287](../../../src/components/recitation/FloatingOptions.tsx#L285-L287)）。

### UI

「设置 → TTS」页在 `ttsEnabled` 为真时展示「自动朗读」分组（4 个复选框 + 说明文字），见 [SettingsDialog.tsx](../../../src/components/settings/SettingsDialog.tsx#L584-L628)。文案键：`settings.ttsAutoRead` / `ttsAutoReadDesc` / `ttsAutoReadQuestion` / `ttsAutoReadHintWord` / `ttsAutoReadAnswer` / `ttsAutoReadFlip`。
