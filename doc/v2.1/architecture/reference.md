# TSBook2 软件架构 — 数据流程、扩展点与参考

> v2.1 更新：日志写入流程变更、翻译后保存流程变更、新增 ttsSettingStore 扩展点。其余与 v2.0 一致。

## 4. 数据流程

### 4.6 设置加载/保存流程 (v2.1 更新)

```
App 启动 → Promise.all([
  settingStore.loadFromDisk() → electronAPI.getSettings() → set({...}),
  ttsSettingStore.loadFromDisk() → electronAPI.getSettings() → set({ tts })
])
设置变更 → set* 方法 → debouncedSave() (500ms 防抖) → saveToDisk() → electronAPI.setSettings(state)
TTS 设置变更 → setTTS() → debouncedSave() → saveToDisk()
  → electronAPI.getSettings() → merge tts → electronAPI.setSettings()
```

### 4.8 日志写入流程 (v2.1 更新)

```
组件调用 useOutputStore.getState().addLog(message, level, color?)
    ↓
outputStore 生成 LogEntry { id, timestamp, message, level, color? }
    ↓
set(state => logs.push(entry))  →  Panel 实时显示 (纯状态更新)
    ↓
useOutputStore.subscribe() 检测 logs.length 增长
    ↓
取最后一条 entry → logService.appendToFile(todayPath, `[HH:mm:ss] [LEVEL] message\n`)
    ↓
window.electronAPI.appendFile(filePath, content)
    ↓
日志文件: {workspace}/.TransRead/log/{yyyy-MM-dd}.log
```

> **v2.1 变更**：文件写入从 `addLog()` 内部移至 `subscribe()` 回调，Store action 不再含副作用。

### 4.10 翻译全部完成后自动保存流程 (v2.1 更新)

```
TranslationService.doTranslateCells() 翻译完成
    ↓
await deps.onTranslateComplete?.()   ← 回调通知（不再直接写文件）
    ↓
useTranslationService hook 中实现:
  getNotebook() → serializeNotebookFile → electronAPI.writeFile → setModified(false)
```

## 5. 扩展点

### 5.9 新增 TTS 配置项 (v2.1 新增)

1. 在 `ttsSettingStore.ts` 的 `TTSSettings` 接口中添加字段
2. 在 `settingStore.ts` 的 `saveToDisk/loadFromDisk` 中不需要修改（ttsSettingStore 独立持久化）
3. 在 `SettingsDialog.tsx` 的 TTS 标签页中添加 UI

## 7. 目录结构 (v2.1 更新)

```
src/
├── store/
│   └── ttsSettingStore.ts    # 🆕 v2.1: TTS 配置独立 Store
├── recitation/
│   └── quizEngine.ts         # 🆕 v2.1: 测验引擎纯函数
```

## 8. 设计模式 (v2.1 更新)

| 模式 | 应用位置 |
|------|----------|
| 模块级单例模式 | TranslationService, RecitationService, **getTTSService()** |
| **subscribe 解耦模式** | **outputStore.subscribe() ← logService** (v2.1 新增) |
| **回调解耦模式** | **TranslationServiceDeps.onTranslateComplete → useTranslationService** (v2.1 新增) |
| **纯函数引擎模式** | **quizEngine.ts** (v2.1 新增) |

## 12. 版本状态

> 当前版本: v2.1 | 最后更新: 2026-07-21

### v2.1 (已完成) — 架构优化
- **TTSService 单例**: `getTTSService()` 跨 hook 共享实例
- **TTS 配置独立**: `ttsSettingStore` 从 `settingStore` 拆分
- **outputStore 解耦**: 文件写入移至 `subscribe`
- **TranslationService 解耦**: `onTranslateComplete` 回调解耦
- **测验引擎提取**: `quizEngine.ts` 纯函数
- **recitationService stub**: `batchImportWords` 标记 TODO

### v2.0 (已完成)
- 远程词书导入 (GitHub/Gitee)
- 侧边栏搜索 (SearchPanel)
- 词书 UI/UX 改进
- TTS 语音朗读模块 (WebSpeechProvider)

### v1.4 (已完成)
- IPC Handler 模块化 / ConfigProvider / workspaceConfigStore / 单元格收藏 / 词书操作增强
