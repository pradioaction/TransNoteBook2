export interface ProviderInfo {
  id: string
  name: string
  type: 'system' | 'custom'
  backend: string
}

export interface TranslationProvider {
  readonly id: string
  readonly name: string
  readonly type: 'system' | 'custom'
  readonly backend: string

  translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string>
  testConnection(): Promise<{ success: boolean; error?: string }>
  getInfo(): ProviderInfo
}

export interface OllamaConfig {
  baseUrl: string
  model: string
  timeout: number
}

export interface OpenAIConfig {
  baseUrl: string
  model: string
  apiKeyEnv: string
  timeout: number
  proxy: string
}

export interface ArkConfig {
  endpoint: string
  model: string
  apiKeyEnv: string
  timeout: number
}

export interface CustomModelConfig {
  name: string
  apiKeyEnv: string
  endpoint: string
  model: string
  timeout: number
  backend: string
  enabled: boolean
}
