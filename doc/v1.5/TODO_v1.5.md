# TSBook2 v1.5 开发路线图 — TTS 语音朗读

> 基于 Kokoro TTS + sherpa-onnx 的本地离线语音合成
> 最后更新: 2026-06-30

---

## P0 — 已完成功能

### P0-1 ✅ C++ TTS 引擎 DLL

| 文件 | 说明 |
|------|------|
| [TtsEngine.h](file:///g:/program/TSBook2/electron/tts/TtsEngine.h) | C API 头文件，7 个公开函数 |
| [TtsEngine.cpp](file:///g:/program/TSBook2/electron/tts/TtsEngine.cpp) | DLL 实现，封装 sherpa-onnx C API |
| [CMakeLists.txt](file:///g:/program/TSBook2/electron/tts/CMakeLists.txt) | CMake 双目标构建（DLL + EXE） |
| [tts_server.cpp](file:///g:/program/TSBook2/electron/tts/tts_server.cpp) | EXE 通信壳，stdin/stdout JSON 协议 |

**能力**：
- 支持 53 种说话人声音（中英文男女声）
- 中英文混合文本自动处理（jieba 分词 + espeak-ng 音素）
- int8 量化 ONNX 模型，86MB，全 CPU 本地推理
- 线程安全取消、进度回调

### P0-2 ✅ Electron IPC 集成

| 文件 | 说明 |
|------|------|
| [ttsHandlers.ts](file:///g:/program/TSBook2/electron/handlers/ttsHandlers.ts) | 子进程管理 + IPC handler |
| [main.ts](file:///g:/program/TSBook2/electron/main.ts) | 注册 ttsHandlers |
| [preload.ts](file:///g:/program/TSBook2/electron/preload.ts) | 暴露 `window.electronAPI.ttsAPI` |
| [state.ts](file:///g:/program/TSBook2/electron/state.ts) | 默认模型路径配置 |
| [settingStore.ts](file:///g:/program/TSBook2/src/store/settingStore.ts) | `ttsModelPath` 前端持久化 |

**IPC 通道**：

| 通道 | 参数 | 返回值 |
|------|------|--------|
| `tts:init` | — | `{success, sampleRate, numSpeakers}` |
| `tts:speak` | `text, sid?, speed?` | `{success, dataUrl, sampleRate}` |
| `tts:status` | — | `{running}` |
| `tts:stop` | — | `{success}` |

### P0-3 ✅ 单词检测页面集成

**修改文件**：
- [recitationStore.ts](file:///g:/program/TSBook2/src/store/recitationStore.ts) — 新增 `ttsEnabled` 状态
- [QuizPanel.tsx](file:///g:/program/TSBook2/src/components/recitation/QuizPanel.tsx) — 喇叭按钮 + 自动朗读 + 双击朗读
- [FloatingOptions.tsx](file:///g:/program/TSBook2/src/components/recitation/FloatingOptions.tsx) — 双击回调
- [zh-CN.json](file:///g:/program/TSBook2/src/locales/zh-CN.json) / [en-US.json](file:///g:/program/TSBook2/src/locales/en-US.json) — 翻译

**功能**：
- 顶部工具栏 `♫` 按钮（默认开启），点击切换
- 切换题目时自动朗读当前单词
- 双击题目卡片重新朗读
- 双击选项朗读选项文字

---

## P1 — 待完成

### P1-1 🟠 设置页 TTS 配置面板

- [ ] 在 `SettingsDialog` 中新增 TTS 标签页
- [ ] 说话人选择（sid 0-52，显示说话人名）
- [ ] 语速调节（speed）
- [ ] 模型路径配置（已有 `ttsModelPath`，需加 UI）

### P1-2 🟠 文章页面 TTS 朗读

- [ ] 在 `NotebookEditor` 或 `CellOutput` 中加朗读按钮
- [ ] 选中文字朗读、全文朗读
- [ ] 朗读时高亮当前句子

### P1-3 🟠 背诵模式朗读增强

- [ ] 单词列表中加喇叭按钮（WordSidebar / WordListItem）
- [ ] 复习页面朗读支持
- [ ] 朗读音标/例句

### P1-4 🟠 TTS 状态管理优化

- [ ] TTS 子进程异常退出自动重启
- [ ] 模型加载进度显示
- [ ] 首次加载慢的优化提示

---

## P2 — 后续增强

### P2-1 🟡 子进程打包

- [x] `electron-builder.yml` 配置 `extraResources` 打包 tts-server.exe + DLL
- [x] `package.json` 的 build script 中自动编译 C++

### P2-2 🟡 更多 TTS 声音

- [ ] 说话人预览（试听每个声音）
- [ ] 支持切换模型（如更换不同语言/质量模型）

### P2-3 🟡 音频播放优化

- [ ] 使用 Web Audio API 替代 `new Audio()`，支持更精细控制
- [ ] 播放进度可视化
- [ ] 暂停/停止播放

---

## 架构参考

```
渲染进程 (React) → IPC → 主进程 (Node.js) → spawn → tts-server.exe
                                                          ↓
                                                    TtsEngine.dll
                                                          ↓
                                                  sherpa-onnx-c-api.dll
                                                          ↓
                                                   onnxruntime.dll
                                                          ↓
                                                  model.int8.onnx (Kokoro)
```

通信协议：stdin/stdout JSON 行 + WAV 二进制，详见 [tts_server.cpp](file:///g:/program/TSBook2/electron/tts/tts_server.cpp)
