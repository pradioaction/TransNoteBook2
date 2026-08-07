# TSBook2 API -- 状态管理、Hooks 与服务层

> v2.1 变更：新增 `ttsSettingStore`、`quizEngine`、`outputStore.subscribe`、TranslationService 回调解耦。

## 4. 状态管理 API (store/)

### 4.1-4.3 notebookStore / workspaceStore / themeStore

与 v2.0 一致，参见 [v2.0 文档](../v2.0/api/stores-hooks-services.md)。

### 4.4 useSettingStore (settingStore.ts) — v2.1 变更

**移除**：`tts` 状态和 `setTTS` 方法已拆分为独立的 `ttsSettingStore`。

```typescript
import { useSettingStore } from '@/store/settingStore'

// 不再包含 tts 字段
const { translation, cellWidthRatio, promptTemplates } = useSettingStore()
```

### 4.4b useTTSSettingStore (ttsSettingStore.ts) — v2.1 新增

TTS 配置独立 Store，从 `settingStore` 拆分。读写 `electronAPI.getSettings()/setSettings()` 的 `tts` 字段，500ms debounced 保存。

```typescript
import { useTTSSettingStore } from '@/store/ttsSettingStore'

interface TTSSettings {
  enabled: boolean
  provider: string
  rate: number
  volume: number
  voiceId: string
}

// 响应式读取
const ttsEnabled = useTTSSettingStore((s) => s.tts.enabled)
// 写入
useTTSSettingStore.getState().setTTS({ provider: 'system_WebSpeech' })
```

### 4.5 useOutputStore (outputStore.ts) — v2.1 变更

**变更**：`addLog()` 现在只做纯状态更新，文件写入通过 Zustand `subscribe` 回调异步处理。

```typescript
interface OutputStore {
  logs: LogEntry[]
  addLog: (message: string, level?: 'info' | 'warn' | 'error', color?: string) => void
  clearLogs: () => void
}

// 文件写入解耦到 subscribe（outputStore.ts 模块底部）
useOutputStore.subscribe((state, prevState) => {
  if (state.logs.length <= prevState.logs.length) return
  const lastEntry = state.logs[state.logs.length - 1]
  // ... appendToFile
})
```

### 4.6 useRecitationStore (recitationStore.ts) — v2.1 变更

**变更**：测验引擎纯逻辑（`answerQuestion` 的计算、`startQuiz` 的状态初始化、`updateSidebarForAnswer`）提取到 `src/recitation/quizEngine.ts`。Store 中的 `startQuiz` 和 `answerQuestion` 现在委托给引擎函数：

```typescript
import { computeAnswerResult, createQuizState } from '@/recitation/quizEngine'

// startQuiz → createQuizState(questions)
// answerQuestion → computeAnswerResult(quizState, sidebarData, pendingSyncResults, index, optionId)
```

quizEngine 导出：

```typescript
// src/recitation/quizEngine.ts
export function createQuizState(questions: QuizQuestion[]): QuizState
export function computeAnswerResult(
  quizState: QuizState,
  sidebarData: WordSidebarData | null,
  pendingSyncResults: Record<number, boolean>,
  questionIndex: number,
  selectedOptionId: string
): { quizState: QuizState; sidebarData: WordSidebarData | null; pendingSyncResults: Record<number, boolean> }
export function updateSidebarForAnswer(data: WordSidebarData | null, wordId: number, isCorrect: boolean): WordSidebarData | null
```

### 4.7 useWorkspaceConfigStore

与 v2.0 一致，参见 [v2.0 文档](../v2.0/api/stores-hooks-services.md)。

## 5. React Hooks API

### 5.1-5.3 useTheme / useKeyboard / useBookmark

与 v2.0 一致。

### 5.4 useRecitationService

与 v2.0 一致。`batchImportWords` 在 v2.1 标记为 `// TODO`，添加 `console.warn`。

## 11. 服务层 API

### 11.1 类型导出

```typescript
import type { FileService, CellService, TranslationService, ProviderInfo, RecitationService } from '@/services/types'
export type { TTSService } from '@/services/ttsService'
export { getTTSService } from '@/services/ttsService'
```

### 11.2-11.3 FileService / CellService

与 v2.0 一致。

### 11.4 TranslationService — v2.1 变更

**新增** `TranslationServiceDeps.onTranslateComplete` 回调，翻译完成后由调用方（hook 层）决定是否保存：

```typescript
interface TranslationServiceDeps {
  // ... 已有字段
  /** 翻译全部完成后回调（用于调用方处理保存等后续操作） */
  onTranslateComplete?: () => Promise<void>
}
```

翻译服务不再直接调用 `window.electronAPI.writeFile()`。保存逻辑在 `useTranslationService` 的 `getService()` 中提供：

```typescript
onTranslateComplete: async () => {
  const nb = useNotebookStore.getState().notebook
  if (nb?.path && window.electronAPI) {
    await window.electronAPI.writeFile(nb.path, serializeNotebookFile(nb.cells, nb.wordMeta))
    useNotebookStore.getState().setModified(false)
  }
}
```

### 11.5 RecitationService

与 v2.0 一致。v2.1 变更：`batchImportWords` stub 添加 `// TODO` 注释。
