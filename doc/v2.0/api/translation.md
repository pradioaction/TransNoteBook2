# TSBook2 API — 翻译服务模块

翻译模块采用策略模式设计，定义在 `src/translation/` 目录下。

## 12.1 TranslationProvider 接口

```typescript
interface TranslationProvider {
  readonly id: string
  readonly name: string
  readonly type: 'system' | 'custom'
  readonly backend: string
  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

## 12.2 OllamaProvider

本地 Ollama 服务提供者（系统内置）。

```typescript
class OllamaProvider implements TranslationProvider {
  readonly id = 'system_Ollama'
  readonly name = 'Ollama (Local)'
  readonly type = 'system'
  readonly backend = 'ollama'
  constructor(config?: Partial<OllamaConfig>)
  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

**OllamaConfig**:
```typescript
interface OllamaConfig {
  baseUrl: string   // 默认 http://localhost:11434
  model: string     // 默认 qwen2.5:0.5b
  timeout: number   // 默认 30s
}
```
测试连接: 调用 `GET /api/tags` 检测服务是否可用。

## 12.3 OpenAIProvider

OpenAI 兼容 API 提供者（系统内置）。

```typescript
class OpenAIProvider implements TranslationProvider {
  readonly id = 'system_OpenAI'
  readonly name = 'OpenAI Compatible'
  readonly type = 'system'
  readonly backend = 'openai'
  constructor(config?: Partial<OpenAIConfig>)
  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

**OpenAIConfig**:
```typescript
interface OpenAIConfig {
  baseUrl: string    // 默认 https://api.openai.com/v1
  model: string      // 默认 gpt-3.5-turbo
  apiKeyEnv: string  // API Key 环境变量名，默认 OPENAI_API_KEY
  timeout: number    // 默认 60s
  proxy: string      // 代理地址（可选）
}
```

API Key 通过 `resolveApiKey()` 从 `process.env` 读取，settings.json 仅存储环境变量名。

## 12.4 ArkProvider

火山引擎 Ark 提供者（用户自定义，通过 ProviderFactory 创建）。

```typescript
class ArkProvider implements TranslationProvider {
  readonly id = 'custom_{name}'
  readonly name = '自定义: {name}'
  readonly type = 'custom'
  readonly backend = 'ark'
  constructor(name: string, config?: Partial<ArkConfig>)
  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  testConnection(): Promise<boolean>
  getInfo(): ProviderInfo
}
```

**ArkConfig**:
```typescript
interface ArkConfig {
  endpoint: string    // 默认 https://ark.cn-beijing.volces.com/api/v3
  model: string       // 推理接入点 ID
  apiKeyEnv: string   // API Key 环境变量名，默认 ARK_API_KEY
  timeout: number     // 默认 120s
}
```

## 12.5 ProviderFactory

```typescript
function buildProvider(model: CustomModelConfig): TranslationProvider
function createSystemProviders(): TranslationProvider[]
function createCustomProviders(customModels: CustomModelConfig[]): TranslationProvider[]
```

**CustomModelConfig**:
```typescript
interface CustomModelConfig {
  name: string
  apiKeyEnv: string
  endpoint: string
  model: string
  timeout: number
  backend: string     // "ollama" | "ark"
  enabled: boolean
}
```

## 12.6 useTranslationService Hook

```typescript
function useTranslationService(): {
  status: TranslationStatus           // 响应式状态，通过 useState + 200ms 轮询同步
  translateCell(index: number): Promise<void>
  translateAll(): Promise<void>
  testConnection(providerId: string): Promise<boolean>
  cancel(): void
  listProviders(): ProviderInfo[]
  setCurrentProvider(providerId: string): void
}
```

status 通过 `useState` + 200ms `setInterval` 轮询 TranslationService 内部状态（字段级深度比较避免不必要渲染）。
