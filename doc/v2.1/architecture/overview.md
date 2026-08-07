# TSBook2 软件架构 — 项目概述与系统架构

> v2.1 更新：新增 `ttsSettingStore`、`quizEngine.ts`，修正 TTS 模块文件路径。

## 1. 项目概述

与 v2.0 一致，参见 [v2.0 文档](../v2.0/architecture/overview.md)。

## 2. 系统架构 — v2.1 变更点

### 2.1 整体架构图（变更部分）

```
src/
├── 状态管理层 (store/)
│   ├── ttsSettingStore.ts   # v2.1 新增：TTS 配置独立 Store
│   └── outputStore.ts       # v2.1 变更：日志写入解耦到 subscribe
├── 语音朗读模块 (tts/)
│   └── (服务实现在 src/services/ttsService.ts)
├── 背诵模式类型 (recitation/)
│   └── quizEngine.ts        # v2.1 新增：测验引擎纯函数
```

### v2.1 Store 清单

| Store | 文件 | 变更 |
|-------|------|------|
| notebookStore | `store/notebookStore.ts` | 无变更 |
| workspaceStore | `store/workspaceStore.ts` | 无变更 |
| themeStore | `store/themeStore.ts` | 无变更 |
| settingStore | `store/settingStore.ts` | 移除 `tts`/`setTTS` |
| **ttsSettingStore** | `store/ttsSettingStore.ts` | **v2.1 新增** |
| recitationStore | `store/recitationStore.ts` | 测验引擎逻辑委托给 `quizEngine` |
| outputStore | `store/outputStore.ts` | `addLog` 纯状态，文件写入 → `subscribe` |
| workspaceConfigStore | `store/workspaceConfigStore.ts` | 无变更 |

### v2.1 新增模块

| 模块 | 文件 | 说明 |
|------|------|------|
| quizEngine | `src/recitation/quizEngine.ts` | `createQuizState` / `computeAnswerResult` / `updateSidebarForAnswer` 纯函数 |
| ttsSettingStore | `src/store/ttsSettingStore.ts` | TTS 配置独立管理，读写 settings.json 的 `tts` 字段 |
