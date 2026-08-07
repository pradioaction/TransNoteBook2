# TSBook2 软件架构 — 核心模块详解 (v2.1)

> v2.1 更新：记录 TTS 模块修正、Store 拆分、测验引擎提取。其他章节与 v2.0 一致，参见 [v2.0 modules.md](../v2.0/architecture/modules.md)。

## 3.1-3.13 Electron 主进程 / 状态管理 / 布局层 / 笔记本 / 工具层 / 类型系统 / 翻译模块

与 v2.0 完全一致。

## 3.14 语音朗读模块详解 (tts/) — v2.1 修正

### 实际模块文件结构

v2.0 文档描述的 `src/tts/ttsService.ts` 不存在。实际结构：

```
src/tts/
├── types.ts
├── providerFactory.ts
└── providers/
    └── webSpeech.ts

src/services/
└── ttsService.ts         # TTSService 实现 + getTTSService() 模块级单例 🆕

src/store/
└── ttsSettingStore.ts    # TTS 配置独立 Store 🆕
```

### TTS 配置存储位置 (已修正)

**v2.0 文档错误**：声称 `recitationStore` 包含 `TTSState`（`ttsEnabled` / `ttsProvider` / `ttsRate` / `ttsVolume` / `ttsVoiceId`）。

**v2.1 实际**：TTS 配置在 `ttsSettingStore`（独立的 Zustand Store），持久化到 `settings.json` 的 `tts` 字段。`settingStore` 不再包含 `tts` 状态。

### TTSService 单例 (v2.1 修正)

`useTTSService` 和 `useSpeek` 两个 hook 通过 `getTTSService()` 共用同一 `TTSService` 实例，确保 `stop()` 跨 hook 生效。

---

## 3.15 测验引擎模块 (quizEngine.ts) — v2.1 新增

`src/recitation/quizEngine.ts` 提取了 `recitationStore` 中约 50 行测验引擎纯逻辑：

| 函数 | 说明 |
|------|------|
| `createQuizState(questions)` | 创建初始测验状态 |
| `computeAnswerResult(quizState, sidebarData, pendingSyncResults, questionIndex, selectedOptionId)` | 处理单次答题，返回新 `quizState` / `sidebarData` / `pendingSyncResults` |
| `updateSidebarForAnswer(data, wordId, isCorrect)` | 更新侧边栏单词的 `isAnswered`/`isCorrect` 标记 |

`recitationStore` 中的 `startQuiz` 和 `answerQuestion` 现在委托给这些纯函数。

---

## 3.16 outputStore 日志写入解耦 — v2.1 修正

**v2.0**：`addLog()` 内同时更新状态 + 异步写文件。

**v2.1**：`addLog()` 仅更新状态；文件写入移至 `useOutputStore.subscribe()` 回调。

---

## 3.17 TranslationService 保存解耦 — v2.1 修正

**v2.0**：`doTranslateCells()` 翻译完成后直接调用 `window.electronAPI.writeFile()`。

**v2.1**：通过 `TranslationServiceDeps.onTranslateComplete` 回调通知 `useTranslationService` hook，由 hook 层执行保存逻辑。

---

## 3.18 Kokoro TRT TTS 引擎 — v2.1 新增

### 概述

Kokoro-82M 模型的 GPU 加速推理引擎，作为 C++ Napi Addon 编译为 `.node` 文件，由 Electron 主进程加载。

### 推理后端

**主方案**：ONNX Runtime 1.27 + CUDA Execution Provider 12.8 + cuDNN 9。

**备用方案（未启用）**：TensorRT 10.9。经测试 Kokoro 模型的 ConvTranspose 层参数与 TensorRT 10 不兼容（`CaskDeconvolution isConsistent check failed`），无法使用。`trt_inference.cc` 和 `model_cache.cc` 保留在代码库中，等待 TRT 后续版本修复。

**已排除的方案**：
- `model.int8.onnx` — 包含 `DynamicQuantizeLSTM` (MS 域私有算子)，TRT 不支持
- `model_fp16.onnx` — STFT 算子在模型内为 FP16，TRT 要求 FP32

### 核心组件

| 组件 | 文件 | 功能 |
|---|---|---|
| Tokenizer | `tokenizer.h/.cc` | UTF-8 文本 → BPE token |
| Phonemizer | `phonemizer.h/.cc` | 文本 → 音素（查 lexicon-*.txt）→ 音素 ID（查 tokens.txt） |
| ORTInference | `ort_inference.h/.cc` | ONNX Runtime 推理（创建 Session、CUDA EP 配置、Run） |
| VoiceManager | `voice_manager.h/.cc` | 加载 voices.bin，管理 46 个语音嵌入向量 |
| AudioDecoder | `audio_decoder.h/.cc` | Griffin-Lim mel→PCM（Kokoro 模型直接输出音频，此组件暂时不调用） |
| NapiEngine | `napi_engine.h/.cc` | JS 可调用类，组合上述组件，暴露 `initialize/synthesize/getVoices` |

### 数据流

```
JS: engine.synthesize("Hello", {voiceId: "af_heart"})
  → Phonemizer: "Hello" → ["h", "ɛ", "l", "o", "ʊ"] → [50, 86, 54, 57, 135]
  → VoiceManager: "af_heart" → float[256]
  → ORTInference.Run(tokens=[0..50..135..0], style=float[256], speed=1.0)
  → GPU (CUDA EP): ONNX Session Run
  → 输出: float[audio_length] (24000Hz PCM 采样)
  → 返回 JS: Float32Array → Web Audio API 播放
```

### 模型信息

| 项目 | 值 |
|---|---|
| 模型文件 | `model/kokoro-int8-multi-lang-v1_0/model.onnx` |
| 输入 | `tokens` [1, N] INT64, `style` [1, 256] FLOAT, `speed` [1] FLOAT |
| 输出 | `audio` [L] FLOAT (PCM 24kHz) |
| 音素映射 | `tokens.txt`（114 个 IPA 音素） |
| 语音 | `voices.bin`（47 个 256 维嵌入） |

### 运行环境

**编译**：VS 2022, CMake 3.20+, CUDA 12.8 SDK, ONNX Runtime 1.27 SDK。
**运行**：`onnxruntime.dll`, `onnxruntime_providers_cuda.dll`, `cudnn64_9.dll`。
