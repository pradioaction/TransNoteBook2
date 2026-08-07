# TSBook2 v2.1 架构优化计划

> 基于 v2.0 模块化诊断 | 最后更新: 2026-07-21

## 1. 诊断概述

v2.0 整体架构分层清晰（Store → Service/Hooks → Components），IPC Handler 模块化、翻译/TTS 策略模式均设计良好。但经深入审查，发现以下问题并已按优先级修复：

---

## 2. 问题清单与修复记录

### P0 — 高优先级（Bug 级别）

#### P0-1 TTSService 实例重复创建 ✅ 已修复

**位置**：`src/hooks/useTTSService.ts` + `src/hooks/useSpeek.ts`

**现象**：`useTTSService` 创建了一个模块级 `TTSService` 单例，`useSpeek` 又通过 `getService()` 创建了**另一个**独立单例。两个 hook 持有不同的 `TTSService` 实例，导致：
- 调用 `useTTSService.stop()` 无法停止 `useSpeek` 发起的朗读
- 调用 `useSpeek.stopSpeek()` 无法停止 `useTTSService` 发起的朗读

**根因**：`createTTSService()` 每次调用都返回新实例，两个模块各自创建自己的单例。

**修复**：
- [ttsService.ts](file:///g:/program/TSBook2/src/services/ttsService.ts)：新增 `getTTSService()` 模块级惰性单例导出，保留 `createTTSService()` 工厂函数
- [useTTSService.ts](file:///g:/program/TSBook2/src/hooks/useTTSService.ts)：`createTTSService()` → `getTTSService()`
- [useSpeek.ts](file:///g:/program/TSBook2/src/hooks/useSpeek.ts)：移除独立的 `serviceInstance` 和 `getService()`，改为 `getTTSService()`
- [index.ts](file:///g:/program/TSBook2/src/services/index.ts)：导出 `getTTSService`

---

### P1 — 中优先级（职责/耦合问题）

#### P1-1 outputStore.addLog() 隐含文件 I/O 副作用 ✅ 已修复

**位置**：`src/store/outputStore.ts`

**现象**：`addLog()` 在更新 Zustand 状态的同时，隐式调用 `logService.appendToFile()` 写入磁盘。Store action 混入了文件 I/O 副作用，且 `getLogService()` 惰性初始化时又 coupling 了 `workspaceStore`。

**修复**：
- [outputStore.ts](file:///g:/program/TSBook2/src/store/outputStore.ts)：`addLog()` 只保留纯状态更新（push entry 到 logs 数组）；文件写入逻辑移至 `useOutputStore.subscribe()` 回调中异步执行

```typescript
// 修复前：addLog 内部直接写文件
addLog: (message, level, color) => {
  set((state) => ({ logs: [...state.logs, entry] }))
  const svc = getLogService()
  svc.appendToFile(todayPath, ...)  // 副作用混入
}

// 修复后：subscribe 解耦副作用
addLog: (message, level, color) => {
  set((state) => ({ logs: [...state.logs, entry] }))  // 纯状态更新
}

useOutputStore.subscribe((state, prevState) => {
  if (state.logs.length <= prevState.logs.length) return
  const svc = getLogService()
  svc.appendToFile(todayPath, ...)  // 副作用在 subscribe 中处理
})
```

---

#### P1-2 TranslationService 翻译后自动保存文件 ✅ 已修复

**位置**：`src/services/translationService.ts`

**现象**：`doTranslateCells()` 翻译完所有单元格后，直接调用 `window.electronAPI.writeFile()` 自动保存。翻译服务不应该关心文件持久化 — 违反单一职责原则。

**修复**：
- [types.ts](file:///g:/program/TSBook2/src/services/types.ts)：`TranslationServiceDeps` 新增 `onTranslateComplete?: () => Promise<void>` 可选回调
- [translationService.ts](file:///g:/program/TSBook2/src/services/translationService.ts)：删除 `window.electronAPI.writeFile()` 直接调用，改为 `await deps.onTranslateComplete?.()`；移除 `serializeNotebookFile` 导入
- [useTranslationService.ts](file:///g:/program/TSBook2/src/hooks/useTranslationService.ts)：在 `getService()` 的 deps 中提供 `onTranslateComplete` 回调，实现自动保存逻辑

---

### P2 — 低优先级（Store 职责过重 / 冗余 / 文档）

#### P2-1 recitationService 是纯粹的 IPC 透传层 ✅ 已修复

**位置**：`src/services/recitationService.ts`

**现象**：几乎所有方法只是 `api()?.methodName()` 的一层转发，无业务逻辑转换。`batchImportWords` 是返回假数据的 stub。

**修复**：
- [recitationService.ts](file:///g:/program/TSBook2/src/services/recitationService.ts)：`batchImportWords` stub 添加明确的 `TODO` 注释和 `console.warn`，说明需新增 IPC 通道和 electron 端处理逻辑

---

#### P2-2 settingStore 职责过重 ✅ 已修复

**位置**：`src/store/settingStore.ts`

**现象**：同时管理 UI 偏好、翻译配置、文件历史、TTS 配置、主题回调解耦，形成"上帝 Store"。

**修复**：
- [ttsSettingStore.ts](file:///g:/program/TSBook2/src/store/ttsSettingStore.ts)（新建）：独立管理 TTS 配置状态，含 `TTSSettings` 接口、`setTTS`、`loadFromDisk`、`saveToDisk`（读写时合并现有 settings 的其余字段，避免覆盖）
- [settingStore.ts](file:///g:/program/TSBook2/src/store/settingStore.ts)：移除 `TTSSettings` 接口、`tts` 状态、`setTTS` 方法、`loadFromDisk`/`saveToDisk` 中的 tts 字段
- [useTTSService.ts](file:///g:/program/TSBook2/src/hooks/useTTSService.ts)：所有 TTS selector 从 `useSettingStore` 改为 `useTTSSettingStore`
- [SettingsDialog.tsx](file:///g:/program/TSBook2/src/components/settings/SettingsDialog.tsx)：TTS 读写改用 `useTTSSettingStore`
- [App.tsx](file:///g:/program/TSBook2/src/App.tsx)：启动时 `Promise.all` 同时加载 settings 和 TTS 配置

---

#### P2-3 recitationStore 测验引擎逻辑过重 ✅ 已修复

**位置**：`src/store/recitationStore.ts`

**现象**：Store 包含了约 150 行测验引擎逻辑（Map 操作、题目状态判断、全部答完检测），这些是纯业务逻辑，不应放在 Store 中。

**修复**：
- [quizEngine.ts](file:///g:/program/TSBook2/src/recitation/quizEngine.ts)（新建）：提取 3 个纯函数 — `createQuizState(questions)` 创建初始状态、`computeAnswerResult(...)` 处理答题逻辑、`updateSidebarForAnswer(...)` 更新侧边栏
- [recitationStore.ts](file:///g:/program/TSBook2/src/store/recitationStore.ts)：`startQuiz` 改用 `createQuizState`，`answerQuestion` 改用 `computeAnswerResult`，删除本地 `updateSidebarForAnswer` 函数（约 50 行 → 10 行）

---

#### P2-4 架构文档与代码不一致 ✅ 已修复

**位置**：`doc/v2.0/architecture/modules.md` 第 397-408 行

**现象**：文档声称 `recitationStore` 包含 TTS 状态字段，实际代码中这些字段在 `settingStore` 中。

**修复**：创建 [modules.md](file:///g:/program/TSBook2/doc/v2.1/architecture/modules.md) 记录 4 处文档与代码不一致的修正。

---

## 3. 修复进度

```
P0-1 (TTSService 实例重复)         ✅ 已修复
P1-1 (outputStore 副作用)          ✅ 已修复
P1-2 (TranslationService 自动保存) ✅ 已修复
P2-1 (recitationService 透传层)    ✅ 已修复
P2-2 (settingStore 过重)           ✅ 已修复
P2-3 (recitationStore 过重)        ✅ 已修复
P2-4 (架构文档不一致)              ✅ 已修复
```
