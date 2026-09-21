# TSBook2 API — 翻译服务模块 (v2.2)

> v2.2 变更：三个 Provider 的构造与 API Key 解析统一做 **`trim()` 归一化**（设置面板输入的空白字符不再导致请求失败）。

翻译模块采用策略模式，定义在 `src/translation/`。Provider 接口与实现结构、`ProviderFactory` 与 v2.1 一致，参见 [v2.1 translation.md](../v2.1/api/translation.md)。

## 12.1 Provider 配置归一化 — v2.2 变更

| 文件 | 变更点 |
|---|---|
| [providers/ollama.ts](../../../src/translation/providers/ollama.ts) | `baseUrl` / `model` 等配置值先 `trim()`，空白则回退默认值 |
| [providers/openai.ts](../../../src/translation/providers/openai.ts) | `baseUrl` / `model` / `proxy` `trim()`；`apiKeyEnv` `trim()`；`resolveApiKey()` 中环境变量名与取值均 `trim()` |
| [providers/ark.ts](../../../src/translation/providers/ark.ts) | `endpoint` / `model` / `apiKeyEnv` `trim()`；`resolveApiKey()` 中环境变量名与取值均 `trim()` |

**变更前 → 变更后**

```typescript
// 变更前
baseUrl: config?.baseUrl || 'http://localhost:11434',
model: config?.model || 'qwen2.5:0.5b',

// 变更后（v2.2）
baseUrl: (config?.baseUrl ?? '').trim() || 'http://localhost:11434',
model: (config?.model ?? '').trim() || 'qwen2.5:0.5b',
```

```typescript
// resolveApiKey()（openai / ark 同构）
const envName = (this.config.apiKeyEnv || 'OPENAI_API_KEY').trim()
const storeVars = useSettingStore.getState().envVars
const match = storeVars.find((v) => v.name.trim() === envName)
if (match && match.value.trim()) return match.value.trim()
// 回退 process.env[envName]（同样 trim）
```

> 配套变更：[SettingsDialog.tsx](../../../src/components/settings/SettingsDialog.tsx) 的 `handleAddModel()` 在写库前对 `name` / `endpoint` / `model` / `apiKeyEnv` 做 `trim()` 与必填校验（`name` 与 `endpoint` 为空则不提交），从输入源头避免脏数据。

## 12.2 TranslationServiceDeps — 关键字段

```typescript
// src/services/types.ts
export interface TranslationServiceDeps {
  getSettingState: () => {
    translation: TranslationSettings
    promptTemplates: PromptTemplates
    customModels: CustomModel[]
  }
  getNotebook: () => NotebookFile | null
  updateCellOutput: (index: number, output: string) => void
  setModified: (v: boolean) => void
  /** v2.1 新增：翻译全部完成后回调（用于调用方处理保存等后续操作） */
  onTranslateComplete?: () => Promise<void>
}
```

行为：

| 环节 | 说明 |
|---|---|
| Provider 同步 | 每次翻译前 `syncProvider()` 读取 `settingStore.translation.currentProvider` 并重建自定义 Provider；若当前 Provider 不存在则回退 `system_Ollama` |
| 翻译全部 | `doTranslateCells()` 完成后 `await deps.onTranslateComplete?.()`，**服务不直接写文件**，保存由 [useTranslationService.ts](../../../src/hooks/useTranslationService.ts) 注入的回调执行 |
| 状态上报 | 通过 `status: OperationStatus` 对象原地更新，Hook 侧 200ms 轮询 + 字段级比较同步到 React（`state: 'running'` 而非 `'translating'`，见 [types.md](./types.md)） |
| 写作批阅 | `reviewCell(index, promptTemplate?)` 使用 `promptTemplates.review`，设置 `operationType: 'review'` |
| 取消 | `cancel()` 触发 `AbortController.abort()` 并把 `state` 复位为 `'idle'` |

## 12.3 ProviderFactory

与 v2.1 一致：

```typescript
function buildProvider(model: CustomModelConfig): TranslationProvider
function createSystemProviders(): TranslationProvider[]      // OllamaProvider + OpenAIProvider
function createCustomProviders(customModels: CustomModelConfig[]): TranslationProvider[]  // 仅 enabled === true
```

分支逻辑：`backend === 'ark'` → `ArkProvider`；`backend === 'openai'` → `OpenAIProvider(config, model.name)`；默认 → `OllamaProvider`。
