# TSBook2 v2.1 开发路线图

> 基于 v2.0 | 最后更新: 2026-09-20

## ✅ 已完成 — v2.1 架构优化

v2.1 主要聚焦架构健康度提升，共修复 7 个模块化问题 + 新增大功能 1 项。详见 [architecture/optimization.md](architecture/optimization.md)。

| 优先级 | 项目 | 说明 |
|--------|------|------|
| P0 | TTSService 实例重复 | `getTTSService()` 单例，useTTSService / useSpeek 共用 |
| P1 | outputStore 副作用 | addLog 纯状态，文件写入 → subscribe |
| P1 | TranslationService 自动保存 | 通过 onTranslateComplete 回调解耦 |
| P1 | **Kokoro GPU TTS 引擎** | C++ Napi Addon 编译通过，Node.js 独立测试通过（RTX 3060 合成成功），Electron 集成测试失败（点击测试按钮无反应，推测 `window.electronAPI.tts` 在 dev 模式下不可用）。详见 [docs/tts-kokoro-20260722.md](../../docs/tts-kokoro-20260722.md) |
| P2 | recitationService stub | batchImportWords 添加 TODO + console.warn |
| P2 | settingStore 过重 | TTS 配置拆分 → ttsSettingStore |
| P2 | recitationStore 引擎 | quizEngine.ts 提取纯逻辑 |
| P2 | 架构文档不一致 | 修正 TTS state 位置、模块路径等 |

## ⏳ P2 — 后续待办（从 v2.0 继承）

同 v2.0 TODO 清单中未完成项，参见 [TODO_v2.0.md](../v2.0/TODO_v2.0.md)。

## ✏️ 编辑区右键菜单 — 待办

### 背景

编辑区（[CellEditor.tsx](../../../src/components/cells/CellEditor.tsx) / [CellOutput.tsx](../../../src/components/cells/CellOutput.tsx)）现有右键菜单仅 `bold` / `italic` / `underline` 三个占位项，`onClick` 为空实现，且仅在编辑态拦截原生菜单。

因项目采用「源文本 + Markdown 渲染分离」，所有格式均以字符标记实现，故菜单应改为**领域标记操作**而非富文本：

| 标记 | 含义 | 来源 |
|------|------|------|
| `**word**` | 新词 | [articleUtils.ts#L114](../../../src/utils/articleUtils.ts#L114) |
| `<u>word</u>` | 复习词 | [articleUtils.ts#L114](../../../src/utils/articleUtils.ts#L114) |

> 阅读态拦截策略本次维持现状（放行原生菜单）。

### 待办事项

| 项目 | 优先级 | 说明 |
|------|--------|------|
| 领域标记菜单项（首期） | 🟡 中 | 标记为新词（`**`）/ 标记为复习词（`<u>`），基于选区操作 |
| 菜单顶部基础编辑项 | 🟡 中 | 复制 / 粘贴 / 全选，补偿被拦截的原生菜单 |
| 菜单结构收口 | 🟢 低 | `ContextMenuItem` 改判别联合、抽 `useContextMenu`、定位改实测尺寸，便于后续扩展 |
| **标记落库与检测验证** | 🔴 高 | 确认编辑区产生的 `**word**` / `<u>word</u>` 标记已持久化到 `.transnb` 存储，用于检测背诵模块（`articleUtils` 解析链路）能否正确识别；不可识别时需补充落库或同步逻辑 |
| 清除标记（二期） | 🟢 低 | 首期菜单暂不展示。基于选区定向剥离 `**` / `<u>` 标记字符：需成对感知（否则留下孤立半截标记）、跨块选区按 textblock 逐块处理 |

## 🔧 Kokoro TTS 引擎 — 待办

### 当前状态：⚠️ Electron 集成失败

| 阶段 | 状态 | 说明 |
|------|------|------|
| C++ Addon 编译 | ✅ 通过 | cmake-js build 成功 |
| Node.js 独立测试 | ✅ 通过 | RTX 3060 合成成功：24000 Hz, 45000 samples, 1.88s |
| Electron 集成测试 | ❌ 失败 | 点击测试按钮无反应，无错误，无崩溃 |

**Electron 集成失败分析**：

推测原因：`kokoroTrt.ts` 中 `_doInit()` 检测到 `window.electronAPI.tts` 不可用后 `console.warn` 静默返回，`speak()` 抛出 `'TTS Electron API 不可用'` 但被 `useTTSService` 的 `try-finally` 块静默吞掉。

可能根因：
1. `preload.ts` 中 `electronAPI.tts` 未正确注入到 renderer 的 `window` 对象
2. `main.ts` 中 `registerTtsHandlers()` 未被调用
3. Electron dev 模式中 preload 脚本路径错误

### 待办事项

| 项目 | 优先级 | 说明 |
|------|--------|------|
| 排查 Electron IPC | 🔴 高 | 确认 `window.electronAPI.tts` 在 dev 模式下是否可用；检查 preload 脚本是否正确注入；验证 `registerTtsHandlers()` 是否被执行 |
| 中文 Phonemizer | 🟡 中 | 解析 phone-zh.fst 以实现完整中文音素转换 |
| 音频输出验证 | 🟡 中 | 将 PCM 写入 WAV 文件试听确认音质 |
| ORT 手动清理 | 🟢 低 | 解决 `destroy()` atexit 冲突，避免依赖 process.exit(0) |
| TensorRT 后续尝试 | 🟢 低 | 关注 TRT 新版本对 ConvTranspose 兼容性修复 |
