# TSBook2 API -- 翻译服务模块

> v2.1 变更：`TranslationServiceDeps` 新增 `onTranslateComplete` 回调，翻译服务不再直接执行文件保存。

翻译模块采用策略模式设计，定义在 `src/translation/` 目录下。

## 12.1-12.5 TranslationProvider / Ollama / OpenAI / Ark / ProviderFactory

Provider 接口和各实现与 v2.0 完全一致，参见 [v2.0 文档](../v2.0/api/translation.md)。

## 12.6 TranslationServiceDeps — v2.1 变更

```typescript
// src/services/types.ts
export interface TranslationServiceDeps {
  getSettingState: () => { translation: TranslationSettings; promptTemplates: PromptTemplates; customModels: CustomModel[] }
  getNotebook: () => NotebookFile | null
  updateCellOutput: (index: number, output: string) => void
  setModified: (v: boolean) => void
  /** v2.1 新增：翻译全部完成后回调（用于调用方处理保存等后续操作） */
  onTranslateComplete?: () => Promise<void>
}
```

**v2.0 行为**：`doTranslateCells()` 翻译完成后直接调用 `window.electronAPI.writeFile()` 保存文件。

**v2.1 行为**：翻译服务改为 `await deps.onTranslateComplete?.()`，保存逻辑移至 `useTranslationService` hook 的 `getService()` 中。
