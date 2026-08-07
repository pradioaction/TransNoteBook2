# TSBook2 API -- 类型定义

> v2.1 变更：`TTSSettings` 从 `settingStore.ts` 移至独立的 `ttsSettingStore.ts`，`TranslationServiceDeps` 新增 `onTranslateComplete`。

## 2.1-2.3 核心数据模型 / IPC 类型 / 主题配置

与 v2.0 一致，参见 [v2.0 文档](../v2.0/api/types.md)。

## 2.4 设置相关类型 — v2.1 变更

### TTSSettings (已移动)

`TTSSettings` 从 `src/store/settingStore.ts` 移至 `src/store/ttsSettingStore.ts`：

```typescript
// src/store/ttsSettingStore.ts (v2.1 新建)
export interface TTSSettings {
  enabled: boolean
  provider: string
  rate: number
  volume: number
  voiceId: string
}
```

### TranslationServiceDeps (新增回调)

```typescript
// src/services/types.ts (v2.1 更新)
export interface TranslationServiceDeps {
  // ... 已有字段
  onTranslateComplete?: () => Promise<void>  // v2.1 新增
}
```

## 2.5-2.6 背诵模式数据模型 / 状态管理接口

与 v2.0 一致，`recitationStore` 的测验引擎逻辑已提取到 `src/recitation/quizEngine.ts`。
