# TSBook2 API — 语音朗读（TTS）模块

语音朗读模块采用**多 Provider 策略模式**设计，定义在 `src/tts/` 目录下。架构与翻译模块（`translation/`）保持一致，支持多种语音源切换扩展。

> **当前实现**：v1.0 仅内置 `WebSpeechProvider`（基于浏览器 `window.speechSynthesis`），架构预留后续接入在线 TTS API（OpenAI TTS / Azure TTS / Google TTS）的能力。

---

## 13.1 模块架构

```
src/tts/
├── types.ts              # TTSProvider 接口 + 配置类型
├── providerFactory.ts    # 提供者工厂 + 注册机制
├── ttsService.ts         # TTS 服务（单例，管理提供者切换）
└── providers/
    └── webSpeech.ts      # Web Speech API 提供者（v1.0 内置）
    └── openai.ts         # (预留) OpenAI TTS 提供者
    └── azure.ts          # (预留) Azure TTS 提供者
```

**设计原则**：
- `TTSProvider` 接口定义所有语音源的统一契约
- `providerFactory` 负责创建和注册提供者实例
- `TTSService` 是前端调用的单一入口，管理当前提供者切换
- 新增语音源只需实现 `TTSProvider` 接口并在 factory 中注册

---

## 13.2 TTSProvider 接口

```typescript
interface TTSProvider {
  /** 提供者唯一标识 */
  readonly id: string
  /** 提供者显示名称 */
  readonly name: string
  /** 提供者类型：系统内置 / 用户自定义 */
  readonly type: 'system' | 'custom'
  /** 后端引擎标识 */
  readonly backend: string

  /**
   * 朗读指定文本
   * @param text 要朗读的文本
   * @param options 朗读选项（语速、音调、音量、语音等）
   * @param signal 可选的 AbortSignal，用于取消朗读
   * @returns 朗读完成时 resolve（朗读被中断时 reject）
   */
  speak(text: string, options?: SpeakOptions, signal?: AbortSignal): Promise<void>

  /**
   * 立即停止当前朗读
   */
  stop(): void

  /**
   * 暂停朗读（仅部分引擎支持）
   */
  pause?(): void

  /**
   * 恢复暂停的朗读（仅部分引擎支持）
   */
  resume?(): void

  /**
   * 获取当前提供者支持的语音列表
   */
  getVoices(): Promise<TTSVoice[]>

  /**
   * 获取提供者信息
   */
  getInfo(): TTSProviderInfo
}

interface SpeakOptions {
  /** 语速：0.1 ~ 10，默认 1.0 */
  rate?: number
  /** 音调：0 ~ 2，默认 1.0 */
  pitch?: number
  /** 音量：0 ~ 1，默认 1.0 */
  volume?: number
  /** 语音 ID（对应 getVoices() 返回的 voiceId） */
  voiceId?: string
  /** 语言标签，如 'en-US'、'zh-CN' */
  lang?: string
}

interface TTSVoice {
  /** 语音唯一标识 */
  voiceId: string
  /** 语音名称（如 "Microsoft David"） */
  name: string
  /** 语言标签 */
  lang: string
  /** 是否为本地语音 */
  localService: boolean
}

interface TTSProviderInfo {
  id: string
  name: string
  type: 'system' | 'custom'
  backend: string
}
```

### 设计说明

`speak()` 方法返回 `Promise<void>` 的设计：
- **朗读完成** → Promise resolve
- **朗读被取消**（调用 `stop()` 或 AbortSignal 触发）→ Promise reject 一个专门的取消错误
- **朗读出错** → Promise reject 错误详情

这使得调用方可以用 `await` 等待朗读结束，或通过 `try/catch` 捕获取消和错误。

---

## 13.3 WebSpeechProvider（v1.0 内置）

基于浏览器内置的 `window.speechSynthesis` API，无需任何外部依赖。

```typescript
class WebSpeechProvider implements TTSProvider {
  readonly id = 'system_WebSpeech'
  readonly name = 'Web Speech API'
  readonly type = 'system'
  readonly backend = 'web-speech'

  constructor(config?: WebSpeechConfig)

  speak(text: string, options?: SpeakOptions, signal?: AbortSignal): Promise<void>
  stop(): void
  pause(): void
  resume(): void
  getVoices(): Promise<TTSVoice[]>
  getInfo(): TTSProviderInfo
}
```

### WebSpeechConfig

```typescript
interface WebSpeechConfig {
  /** 默认语速，默认 0.9（略慢于正常语速，适合学习场景） */
  defaultRate?: number
  /** 默认音调，默认 1.0 */
  defaultPitch?: number
  /** 默认音量，默认 1.0 */
  defaultVolume?: number
  /** 默认语言，默认 'en-US' */
  defaultLang?: string
  /** 默认语音名称（若未指定则使用系统默认语音） */
  defaultVoiceName?: string
}
```

### 实现细节

| 细节 | 说明 |
|------|------|
| **语音选择** | `getVoices()` 调用 `window.speechSynthesis.getVoices()`，优先选择匹配 `lang` 的语音；若指定了 `voiceId`，则按 ID 精确匹配 |
| **取消朗读** | 调用 `window.speechSynthesis.cancel()` |
| **暂停/恢复** | 调用 `window.speechSynthesis.pause()` / `resume()` |
| **Promise 完成** | 监听 `SpeechSynthesisUtterance` 的 `end` 事件 resolve；`error` 事件 reject |
| **AbortSignal** | signal 触发时调用 `stop()` 并 reject |

### 跨平台语音质量说明

| 平台 | 默认英语语音 | 质量评估 |
|------|-------------|---------|
| Windows 11 | Microsoft David / Zira | ⭐⭐⭐ 可接受 |
| macOS | Samantha / Alex | ⭐⭐⭐⭐ 较好 |
| Linux | 可能无内置语音 | ⭐ 需自行安装 speech-dispatcher |

---

## 13.4 ProviderFactory

```typescript
/**
 * 创建所有系统内置的 TTS 提供者
 * v1.0 仅返回 WebSpeechProvider
 */
function createSystemTTSProviders(): TTSProvider[]

/**
 * 根据配置创建用户自定义的 TTS 提供者（预留）
 * v1.0 返回空数组
 */
function createCustomTTSProviders(customConfigs: CustomTTSConfig[]): TTSProvider[]
```

**CustomTTSConfig**（预留，v1.0 暂不使用）：
```typescript
interface CustomTTSConfig {
  name: string
  backend: string        // "openai-tts" | "azure-tts" | "google-tts"
  apiKeyEnv: string
  endpoint: string
  model?: string         // 如 OpenAI TTS 的 "tts-1"
  voice?: string         // 如 "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
  timeout: number
  enabled: boolean
}
```

**添加新 Provider 的示例**（以 OpenAI TTS 为例）：
```typescript
// providers/openai.ts
export class OpenAITTSProvider implements TTSProvider {
  readonly id = 'custom_OpenAITTS'
  readonly name = 'OpenAI TTS'
  readonly type = 'custom'
  readonly backend = 'openai-tts'

  async speak(text: string, options?: SpeakOptions, signal?: AbortSignal): Promise<void> {
    // 调用 OpenAI TTS API
    // 返回音频 → 使用 AudioContext 或 <audio> 播放
  }
  // ... 实现其余接口
}

// providerFactory.ts 注册
export function createCustomTTSProviders(configs: CustomTTSConfig[]): TTSProvider[] {
  return configs.filter(c => c.enabled).map(c => {
    if (c.backend === 'openai-tts') return new OpenAITTSProvider(c)
    if (c.backend === 'azure-tts') return new AzureTTSProvider(c)
    // ...
  })
}
```

---

## 13.5 TTSService

TTSService 是一个模块级单例，提供统一的朗读入口。

```typescript
class TTSService {
  private systemProviders: TTSProvider[]
  private customProviders: TTSProvider[]
  private currentProviderId: string

  /** 获取当前提供者 */
  private getProvider(): TTSProvider | undefined

  /** 获取所有提供者 */
  private getAllProviders(): TTSProvider[]

  /** 切换当前提供者 */
  setCurrentProvider(providerId: string): void

  /** 获取当前提供者 ID */
  getCurrentProviderId(): string

  /** 列出所有可用提供者 */
  listProviders(): TTSProviderInfo[]

  /** 朗读文本 */
  async speak(text: string, options?: SpeakOptions): Promise<void>

  /** 停止朗读 */
  stop(): void

  /** 暂停朗读 */
  pause(): void

  /** 恢复朗读 */
  resume(): void

  /** 获取语音列表 */
  async getVoices(): Promise<TTSVoice[]>
}
```

### speak() 详细行为

```
speak(text, options)
    │
    ├─ 获取当前 provider
    ├─ 调用 provider.speak(text, options)
    │     ├─ WebSpeechProvider: 创建 SpeechSynthesisUtterance → speak
    │     └─ (未来) 在线 TTS: 请求音频 → AudioContext 播放
    ├─ await 朗读完成
    └─ 若 cancelled → reject
```

### 状态管理

TTS 朗读状态不与 Zustand store 耦合，通过 `AbortController` + Promise 管理：

| 场景 | 行为 |
|------|------|
| 同文本重复点击 | 先 `stop()` 当前朗读，再重新 `speak()` |
| 切换 Provider 时 | 自动 `stop()` 当前朗读 |
| 组件卸载时 | 调用 `stop()` 清理 |
| 单词快速切换 | 仅最后一个朗读生效（防抖） |

---

## 13.6 useTTSService Hook

```typescript
function useTTSService(): {
  /** 朗读指定文本 */
  speak(text: string, options?: SpeakOptions): Promise<void>
  /** 停止朗读 */
  stop: () => void
  /** 暂停朗读 */
  pause: () => void
  /** 恢复朗读 */
  resume: () => void
  /** 是否正在朗读中 */
  speaking: boolean
  /** 是否支持暂停 */
  supportsPause: boolean
  /** 当前提供者信息 */
  currentProvider: TTSProviderInfo | null
  /** 所有可用提供者列表 */
  providers: TTSProviderInfo[]
  /** 切换提供者 */
  setProvider: (providerId: string) => void
  /** 当前可用语音列表 */
  voices: TTSVoice[]
  /** 当前选中的语音 ID */
  voiceId: string
  /** 设置语音 */
  setVoice: (voiceId: string) => void
  /** 语速（受控） */
  rate: number
  setRate: (rate: number) => void
  /** 音量（受控） */
  volume: number
  setVolume: (volume: number) => void
}
```

### 实现要点

- `speaking` 状态通过内部 `useState` 同步（speak 开始设为 true，完成/错误/取消设为 false）
- `voices` 在 provider 切换时重新加载
- 配置项（rate, volume, voiceId）存储在 `recitationStore` 中，通过 `recitationService.setConfig()` 持久化到 `studywordmode.json`
- Hook 返回的 `speak()` 方法自带防抖：连续快速调用时，自动取消前一次朗读

---

## 13.7 配置持久化

TTS 配置通过 `recitationService.setConfig()` 存储到 `studywordmode.json`：

```typescript
// studywordmode.json 新增字段
{
  "tts_provider": "system_WebSpeech",    // 当前 TTS 提供者 ID
  "tts_rate": 0.9,                       // 语速
  "tts_volume": 1.0,                     // 音量
  "tts_voice_id": "",                    // 选中语音 ID（空 = 系统默认）
  "tts_enabled": true                    // 全局 TTS 开关
}
```

---

## 13.8 音量调解功能

为了使用户在跟读和听力训练中获得更好的体验，TTS 模块内置**音量独立调解功能**：

### 功能概述

- 用户可通过滑块或快捷键独立调节 TTS 朗读音量（0% ~ 200%）
- 音量调节独立于系统音量，仅影响 TTS 播放
- 当前音量值实时持久化到 `studywordmode.json`（`tts_volume` 字段）

### Hook 接口

```typescript
function useTTSVolume(): {
  /** 当前音量值，范围 0.0 ~ 2.0（对应 0% ~ 200%） */
  volume: number
  /** 设置音量 */
  setVolume: (v: number) => void
  /** 音量增减步进 */
  increaseVolume: (step?: number) => void
  decreaseVolume: (step?: number) => void
  /** 音量百分比显示文本 */
  volumePercent: string  // 如 "100%", "150%"
}
```

### 音量调解的使用场景

| 场景 | 建议行为 |
|------|---------|
| 跟读训练 | 用户调低 TTS 音量至 60%~80%，给自己留出跟读空间 |
| 听力磨耳朵 | 调高至 120%~150%，在背景中循环播放 |
| 安静环境 | 正常 100% 即可 |
| 嘈杂环境 | 调高至 150%~200% |

### UI 交互

- **快速入口**：在单词朗读按钮旁边显示当前音量百分比，hover 时弹出音量滑块
- **快捷键**：`Ctrl+Shift++` 增加音量，`Ctrl+Shift+-` 减少音量（预留）
- **同步**：调节后即时生效，下次朗读使用新音量

---

## 13.9 Speek 功能

> **Speek** 是 TTS 模块中的单词拼读功能，区别于常规的整词朗读。用于帮助用户掌握单词的字母拼写。

### 功能概述

- 将单词按字母逐个读出（如 "hello" → "H · E · L · L · O"）
- 可选拼读速度（正常/慢速）
- 可选拼读模式：纯字母 / 字母+对应音标发音

### Hook 接口

```typescript
function useSpeek(): {
  /** 开始拼读指定单词 */
  speek: (word: string, options?: SpeekOptions) => Promise<void>
  /** 停止拼读 */
  stopSpeek: () => void
  /** 是否正在拼读中 */
  speeking: boolean
}

interface SpeekOptions {
  /** 拼读速度：'normal' | 'slow'，默认 'normal' */
  speed?: 'normal' | 'slow'
  /** 字母间隔（毫秒），默认 normal=400ms, slow=800ms */
  intervalMs?: number
  /** 是否在朗读前先整词朗读一遍，默认 true */
  readWordFirst?: boolean
}
```

### 实现逻辑

```
speek("hello")
  ├─ 先整词朗读 "hello"（若 readWordFirst=true）
  ├─ 逐个字母朗读：
  │    "H" ─ pause 400ms ─ "E" ─ pause 400ms ─ "L" ─ pause 400ms ─ "L" ─ pause 400ms ─ "O"
  └─ 完成
```

### 使用场景

| 场景 | 说明 |
|------|------|
| 检测中答错的单词 | 回顾时用户点击"拼读"按钮，听字母拼写加深记忆 |
| 新学单词 | 首次学习时拼读，建立单词拼写印象 |
| 侧边栏单词列表 | 右键或长按单词弹出"拼读"选项 |

---

## 13.10 UI 集成点

朗读按钮以**扬声器图标**（🔊）形式嵌入以下组件：

### 集成点一览

| 位置 | 组件 | 触发方式 | 朗读内容 |
|------|------|----------|----------|
| ① 检测翻转卡片 | `FloatingOptions.tsx` 详情卡 | 点击扬声器图标 | 当前单词 |
| ② 侧边栏单词列表 | `WordListItem.tsx` | 点击单词右侧扬声器图标 | 该单词 |
| ③ 检测题目卡片 | `FloatingOptions.tsx` 题目卡 | 点击单词旁的扬声器图标 | 题目中的单词 |
| ④ 单词编辑弹窗 | `WordEditorDialog.tsx` | 点击扬声器图标 | 编辑中的单词 |
| ⑤ 复习回顾列表 | `ReviewPanel.tsx` | 错词旁扬声器图标 | 该错词 |
| ⑥ 阅读模式 | `NotebookEditor.tsx` | 选中文本后弹出朗读选项 | 选中的文本 |

### 朗读按钮组件

```typescript
// src/components/common/SpeakButton.tsx
interface SpeakButtonProps {
  /** 要朗读的文本 */
  text: string
  /** 朗读选项 */
  options?: SpeakOptions
  /** 按钮尺寸 */
  size?: number
  /** 是否显示拼读按钮（speek） */
  showSpeek?: boolean
  /** 额外的 class name */
  className?: string
}
```

该组件封装了：
- 点击 → 调用 `useTTSService().speak(text)`
- 正在朗读时图标变为停止按钮
- hover 显示"朗读"tooltip
- 支持快捷键

---

## 13.11 扩展指南：添加新的 TTS Provider

以添加 OpenAI TTS 为例：

### 步骤 1：创建 Provider 类

```typescript
// src/tts/providers/openai.ts
export class OpenAITTSProvider implements TTSProvider {
  readonly id = 'custom_OpenAITTS'
  readonly name = 'OpenAI TTS'
  readonly type = 'custom'
  readonly backend = 'openai-tts'

  private abortController: AbortController | null = null

  constructor(private config: OpenAITTSCofig) {}

  async speak(text: string, options?: SpeakOptions, signal?: AbortSignal): Promise<void> {
    this.abortController = new AbortController()
    const combinedSignal = signal ? combineSignals(signal, this.abortController.signal) : this.abortController.signal

    // 1. 请求 TTS API 获取音频
    const response = await fetch(`${this.config.endpoint}/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resolveApiKey(this.config.apiKeyEnv)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'tts-1',
        input: text,
        voice: options?.voiceId || this.config.voice || 'alloy',
        speed: options?.rate || 1.0,
      }),
      signal: combinedSignal,
    })

    // 2. 播放音频
    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)

    return new Promise((resolve, reject) => {
      audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve() }
      audio.onerror = (e) => { URL.revokeObjectURL(audioUrl); reject(e) }
      combinedSignal.onabort = () => { audio.pause(); URL.revokeObjectURL(audioUrl); reject(new Error('Cancelled')) }
      audio.play()
    })
  }

  stop(): void {
    this.abortController?.abort()
    this.abortController = null
  }

  // ... 其余接口
}
```

### 步骤 2：在 Factory 中注册

```typescript
// src/tts/providerFactory.ts
export function createCustomTTSProviders(configs: CustomTTSConfig[]): TTSProvider[] {
  return configs.filter(c => c.enabled).map(c => {
    switch (c.backend) {
      case 'openai-tts':
        return new OpenAITTSProvider(c)
      // case 'azure-tts': return new AzureTTSProvider(c)
      default:
        console.warn(`Unknown TTS backend: ${c.backend}`)
        return null
    }
  }).filter(Boolean) as TTSProvider[]
}
```

### 步骤 3：暴露给用户切换

- 在 `SettingsDialog` 中新增 TTS 标签页
- 用户选择提供者后调用 `ttsService.setCurrentProvider(id)`
- 配置自动持久化到 `studywordmode.json`（通过 `recitationService.setConfig()`）

---

## 13.12 事件与错误处理

### 朗读事件

```typescript
enum TTSEvent {
  /** 朗读开始 */
  Start = 'start',
  /** 朗读完成 */
  End = 'end',
  /** 朗读暂停 */
  Pause = 'pause',
  /** 朗读恢复 */
  Resume = 'resume',
  /** 朗读被取消 */
  Cancel = 'cancel',
  /** 朗读出错 */
  Error = 'error',
}
```

### 错误类型

| 错误 | 说明 | 处理方式 |
|------|------|----------|
| `TTSCancelledError` | 朗读被取消（用户切换单词/组件卸载） | 静默忽略 |
| `TTSNotSupportedError` | 当前浏览器/环境不支持语音合成 | 隐藏朗读按钮 |
| `TTSNetworkError` | 在线 TTS API 网络错误 | 输出面板日志 + 自动回退 WebSpeech |
| `TTSVoiceNotFoundError` | 指定语音不可用 | 回退默认语音 |

---

## 13.13 配置 Store 扩展（RecitationStore）

在 `recitationStore` 中新增 TTS 相关状态：

```typescript
interface TTSState {
  /** TTS 功能全局开关 */
  ttsEnabled: boolean
  /** 当前 TTS 提供者 ID */
  ttsProvider: string
  /** 语速 */
  ttsRate: number
  /** 音量 */
  ttsVolume: number
  /** 选中的语音 ID */
  ttsVoiceId: string

  // 操作
  setTTSEnabled: (enabled: boolean) => void
  setTTSProvider: (providerId: string) => void
  setTTSRate: (rate: number) => void
  setTTSVolume: (volume: number) => void
  setTTSVoiceId: (voiceId: string) => void
}
```

---

## 13.14 国际化

在 `zh-CN.json` / `en-US.json` 中新增 TTS 相关翻译键：

```json
{
  "tts.speak": "朗读",
  "tts.stop": "停止",
  "tts.pause": "暂停",
  "tts.resume": "恢复",
  "tts.speeking": "朗读中...",
  "tts.speek": "拼读",
  "tts.speeking": "拼读中...",
  "tts.volume": "音量",
  "tts.rate": "语速",
  "tts.voice": "语音",
  "tts.provider": "语音引擎",
  "tts.noVoice": "当前引擎无可用语音",
  "tts.notSupported": "当前浏览器不支持语音朗读"
}
```
