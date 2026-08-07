# TSBook2 Kokoro TTS GPU 加速 — 实施文档

> 日期：2026-07-22
> 目标：为 TSBook2 集成本地 Kokoro TTS 模型，使用 GPU 加速推理

---

## 一、项目背景

TSBook2 现有 TTS 系统基于浏览器 Web Speech API，无 GPU 加速。计划引入本地 Kokoro 模型 (82M 参数)，通过 C++ Napi Addon 调用 GPU 推理。

### 环境清单

| 组件 | 路径/版本 | 状态 |
|---|---|---|
| GPU | NVIDIA GeForce RTX 3060 (12GB) | ✅ |
| NVIDIA 驱动 | 572.60 | ✅ |
| CUDA Toolkit | 12.8 (`C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8`) | ✅ |
| cuDNN 8 | `cudnn64_8.dll` (CUDA 自带) | ✅ |
| cuDNN 9 | `cudnn64_9.dll` (ORT 1.27 需要，后安装) | ✅ |
| Visual Studio 2022 | Community 17.13, MSVC 14.43 | ✅ |
| CMake | 3.31.11 | ✅ |
| Node.js | v24.12.0 x64 | ✅ |
| Python | 3.14.0 | ✅ |
| node-gyp | 全局安装 | ✅ |
| TensorRT | 10.9.0.34 (`G:\program\tensorrt\TensorRT-10.9.0.34`) | ✅ |
| ONNX Runtime GPU | 1.27.0 (`G:\program\onnxruntime\onnxruntime-win-x64-gpu_cuda12-1.27.0`) | ✅ |
| Kokoro 模型 | `model/kokoro-int8-multi-lang-v1_0/` | ✅ |

---

## 二、架构设计

### 整体架构

```
Renderer (React)
  └── SpeakButton / useTTSService (不改)
       └── ttsService (不改)
            └── KokoroTrtProvider (新增, 实现 TTSProvider)
                 └── window.electronAPI.tts.synthesize() (preload 追加)
                      └── IPC → Main Process
                           └── ttsHandlers.ts (新增)
                                └── C++ Napi Addon (kokoro_trt_native.node)
                                     ├── Tokenizer (tokens.txt)
                                     ├── Phonemizer (lexicon-*.txt)
                                     ├── VoiceManager (voices.bin)
                                     └── ORTInference (model.onnx + CUDA EP)
```

### 改动文件清单

| 类型 | 文件 | 说明 |
|---|---|---|
| **新** | `native/kokoro-trt-native/` (整个目录) | C++ Napi Addon 项目 |
| **新** | `src/tts/providers/kokoroTrt.ts` | Kokoro TRT Provider |
| **新** | `electron/handlers/ttsHandlers.ts` | IPC Handler |
| **改** | `src/tts/providerFactory.ts` | +2 行注册 Kokoro |
| **改** | `electron/preload.ts` | +9 行追加 `electronAPI.tts` |
| **改** | `electron/main.ts` | +2 行注册 handler |

---

## 三、TensorRT 方案尝试（失败）

### 3.1 尝试 1：model.int8.onnx

```
trtexec --onnx=model.int8.onnx --fp16 ...
```

**错误**：`ConvInteger` 算子解析失败，`DynamicQuantizeLSTM` (Microsoft 域算子) TRT 不支持。

**原因**：该模型是 ONNX Runtime 量化工具生成的，包含 MS 私有算子。

### 3.2 尝试 2：model_fp16.onnx

```
trtexec --onnx=model_fp16.onnx --fp16 ...
trtexec --onnx=model_fp16.onnx ...
```

**错误**：`importSTFT: Input to STFT must be Float32. Received type: float16`

**原因**：模型内部的 STFT 算子被 bake 为 FP16，TensorRT 10 要求 STFT 输入为 FP32。

### 3.3 尝试 3：model.onnx (FP32)

```
trtexec --onnx=model.onnx --fp16 --tacticSources=-CUDNN --builderOptimizationLevel=5 ...
```

**错误**：`CaskDeconvolution isConsistent check failed.`

**原因**：Kokoro 模型的 Vocoder 中 ConvTranspose 层参数 (stride/padding/kernel) 与 TensorRT 10 不兼容。尝试了 5 个构建策略全部失败。

### 3.4 TensorRT 结论

**TensorRT 10.9 无法直接推理 Kokoro-82M 模型**。根本原因是 ConvTranspose 层配置与 TRT 内部 deconvolution builder 的 isConsistent 检查冲突，无论 FP16/FP32/CUDNN 开关均无法绕过。

---

## 四、ONNX Runtime 方案（成功）

### 4.1 技术选型

| 维度 | TensorRT | ONNX Runtime + CUDA |
|---|---|---|
| 模型兼容性 | ❌ ConvTranspose 硬伤 | ✅ 完全兼容 |
| GPU 加速 | 需转 engine | 直接加载 .onnx |
| 构建步骤 | trtexec 转换 (1-5 分钟) | 零转换 |
| RTX 3060 推理速度 | N/A | ~0.15 RTF (6x 实时) |

### 4.2 环境准备

#### 安装 cuDNN 9

ORT 1.27 需要 cuDNN 9.x。CUDA 12.8 自带 cuDNN 8.x。

1. 访问：`https://developer.download.nvidia.com/compute/cudnn/redist/cudnn/windows-x86_64/`
2. 下载最新 `cudnn-windows-x86_64-9.x.x.xx_cuda12-archive.zip`
3. 解压，将 `bin\` 下所有 `.dll` 拷贝到 `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8\bin\`

文件名不会冲突（cuDNN 8 = `cudnn64_8.dll`，cuDNN 9 = `cudnn64_9.dll`）。

### 4.3 C++ Addon 关键源文件

| 文件 | 功能 |
|---|---|
| `native/kokoro-trt-native/CMakeLists.txt` | CMake 构建配置 (CUDA + ORT + Napi) |
| `src/main.cc` | Napi 模块入口 |
| `src/napi_engine.h/.cc` | JS 可调用类 (initialize/synthesize/getVoices/destroy) |
| `src/tokenizer.h/.cc` | tokens.txt → token ID |
| `src/phonemizer.h/.cc` | 文本 → phoneme → ID (用 tokens.txt 映射) |
| `src/ort_inference.h/.cc` | ONNX Runtime + CUDA EP 推理 |
| `src/voice_manager.h/.cc` | voices.bin 语音嵌入管理 |
| `src/audio_decoder.h/.cc` | Griffin-Lim mel→PCM (Kokoro 不用，保留) |
| `src/model_cache.h/.cc` | ONNX→TRT engine 缓存 (保留) |
| `src/trt_inference.h/.cc` | TensorRT 推理 (保留，后续可用) |

### 4.4 模型输入

| 输入名 | 形状 | 类型 | 来源 |
|---|---|---|---|
| `tokens` | [1, N] | INT64 | Phonemizer 输出 (tokens.txt 音素 ID) |
| `style` | [1, 256] | FLOAT | voices.bin 语音嵌入 |
| `speed` | [1] | FLOAT | 语速因子 |

### 4.5 模型输出

| 输出名 | 形状 | 类型 |
|---|---|---|
| `audio` | [audio_length] | FLOAT (PCM 24kHz) |
| `onnx::Shape_3623` | [1] | INT64 (形状信息，忽略) |

> **重要**：模型直接输出音频波形，不是 mel spectrogram，不需要 Griffin-Lim 解码。

### 4.6 关键问题与修复

#### 问题 1：音素 ID 映射不匹配

**现象**：Synthesize 无限卡死。

**原因**：自建 `kPhonemeList` 的 ID 映射和 Kokoro 官方 `tokens.txt` 不匹配，传入了错误 ID。

**修复**：`phonemizer.cc` 改为从 `tokens.txt` 加载音素→ID 映射。

```cpp
// 修复前: 使用自建 kPhonemeList
for (int32_t i = 0; i < kPhonemeList.size(); ++i) {
    phoneme_to_id_[kPhonemeList[i]] = i;
}

// 修复后: 从 tokens.txt 加载
std::ifstream tf(tokens_path);
while (std::getline(tf, line)) {
    // 格式: "phoneme ID"
    phoneme_to_id_[phoneme] = id;
}
```

#### 问题 2：错误运行 Griffin-Lim

**现象**：Synthesize 无限卡死，生成上千万采样点。

**原因**：Kokoro 模型输出是音频波形，却当 mel spectrogram 喂给 Griffin-Lim 算法。

**修复**：`napi_engine.cc` 跳过 Griffin-Lim，直接返回模型输出。

```cpp
// 修复前
auto samples = impl_->decoder.DecodeGriffinLim(mel.mel_data, mel.mel_frames, ...);

// 修复后: 模型直接输出音频，不解码
float duration = mel.mel_data.size() / mel.sample_rate;
Napi::Float32Array arr = Napi::Float32Array::New(env, mel.mel_data.size());
memcpy(arr.Data(), mel.mel_data.data(), ...);
```

#### 问题 3：退出时堆损坏

**现象**：`exit code -1073740940` (0xC0000374, heap corruption)

**原因**：ORT Napi Addon 析构时调用 Release API，与 ORT 内部 atexit handler 冲突。

**修复**：析构函数只置空指针，不调用 Release。进程退出时 ORT 内部自行清理。

```cpp
~Impl() {
    // 不调用 Release*，避免与 ORT atexit 冲突
    allocator = nullptr;
    session = nullptr;
    env = nullptr;
    // ...
}
```

JS 侧调用方用 `process.exit(0)` 退出。

#### 问题 4：ORT 输出名不匹配

**现象**：`Invalid output name: audio`

**原因**：模型有 2 个输出 (`audio` + `onnx::Shape_3623`)，ORT `Run()` 需要指定全部。

**修复**：保存并传入全部输出名称。

#### 问题 5：模型文件选择

**现象**：`model.int8.onnx` 和 `model_fp16.onnx` 均无法在 TensorRT 或 ORT 中使用。

**修复**：使用 `model.onnx` (FP32, ~326MB)。

---

## 五、构建命令

```powershell
# 1. 进入 addon 目录
cd native\kokoro-trt-native

# 2. 安装依赖（首次）
npm install

# 3. 编译 (Electron target)
npx cmake-js build

# 4. 拷贝运行时 DLL (每次编译后)
Copy-Item "G:\program\onnxruntime\onnxruntime-win-x64-gpu_cuda12-1.27.0\lib\onnxruntime*.dll" build\Release\
```

---

## 六、Node.js 独立测试（通过）

```
=== 初始化 ===
Init time: 3.8s (GPU CUDA EP)
Device: NVIDIA GeForce RTX 3060
Voices loaded: 46

=== 合成 "Hello world" ===
Output: 24000 Hz, 45000 samples, 1.88s
Exit code: 0 (clean)
```

---
## 七、Electron 集成测试（失败）

### 7.1 现象

启动 Electron dev 模式后，点击 TTS 测试按钮无任何反应：
- 无错误日志
- 无崩溃（exit code 0）
- 无音频输出
- 无 UI 反馈

### 7.2 根因分析

推测调用链静默失败：

```
┌── Renderer (React) ──────────────────────────┐
│ KokoroTrtProvider.speak()                     │
│ └─ ensureInit() → _doInit()                   │
│    └─ if (!window.electronAPI?.tts)           │
│       └─ console.warn → 静默 return ❌         │  ← 问题 1: 静默返回
│                                                │
│ doSpeak() → this.engine?.synthesize()         │
│   → undefined → throw 'TTS Electron API 不可用'│
│                                                │
│ useTTSService.speak()                         │
│   try { ... } finally { setSpeaking(false) }  │  ← 问题 2: finally 吞掉错误
└────────────────────────────────────────────────┘
```

两个问题叠加导致无声失败：

1. **`_doInit()` 静默吞错** ([kokoroTrt.ts](file:///g:/program/TSBook2/src/tts/providers/kokoroTrt.ts))：检测 `window.electronAPI.tts` 不可用时，仅 `console.warn` 后 `return`，不向上抛出异常。

2. **`speak()` 错误被 finally 吞掉**：`speak()` 抛出 `'TTS Electron API 不可用'` 后，被 `useTTSService` 的 `try-catch-finally` 块中 `finally { setSpeaking(false) }` 静默处理。

### 7.3 可能根因

| # | 可能性 | 检查方法 |
|---|--------|----------|
| 1 | `preload.ts` 中 `electronAPI.tts` 未正确注入 | 打开 Electron DevTools Console，输入 `window.electronAPI` |
| 2 | `main.ts` 中 `registerTtsHandlers()` 未被调用 | 查看主进程日志是否有 handler 注册日志 |
| 3 | Electron dev 模式中 preload 脚本路径错误 | 检查 `main.ts` 中 `webPreferences.preload` 路径 |
| 4 | `ipcMain.handle` 注册在主进程初始化之前 | 检查 `registerTtsHandlers()` 调用时机 |

### 7.4 排查步骤建议

```javascript
// 1. 在 Electron DevTools Console 执行
console.log(window.electronAPI)          // 应看到对象
console.log(window.electronAPI?.tts)     // 应看到 { init, synthesize, ... }

// 2. 在主进程 main.ts 中添加
console.log('[Main] registerTtsHandlers called')
registerTtsHandlers()
console.log('[Main] tts:init handler count:', ipcMain.listeners('tts:init').length)
```

### 7.5 结论

**第二次本地模型尝试失败**。C++ Addon 编译和 Node.js 独立测试均通过，但 Electron IPC 集成链路存在静默失败问题。核心原因是渲染进程侧的 `KokoroTrtProvider` 在 API 不可用时光降级不报错，导致用户看不到任何反馈。

---
## 八、待办事项

| 项目 | 优先级 | 说明 |
|---|---|---|
| 排查 Electron IPC | 🔴 高 | 确认 `window.electronAPI.tts` 在 dev 模式下是否可用；检查 preload 注入和 handler 注册 |
| 中文 Phonemizer 适配 | 🟡 中 | 当前 phonemizer 中文支持不完整，需解析 phone-zh.fst |
| 音频输出验证 | 🟡 中 | 将 PCM 数据写入 WAV 文件试听确认音质 |
| ORT 手动清理 | 🟢 低 | 解决 `destroy()` 时的 atexit 冲突，避免依赖 process.exit(0) |
| TensorRT 后续尝试 | 🟢 低 | 关注 TRT 新版本对 ConvTranspose 的兼容性修复 |
