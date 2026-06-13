import type { TranslationProvider, ArkConfig } from '../types'
import type { ProviderInfo } from '@/services/types'
import { useSettingStore, type EnvVar } from '@/store/settingStore'

export class ArkProvider implements TranslationProvider {
  readonly id: string
  readonly name: string
  readonly type = 'custom' as const
  readonly backend = 'ark'

  private config: ArkConfig

  constructor(name: string, config?: Partial<ArkConfig>) {
    this.id = `custom_${name}`
    this.name = `自定义: ${name}`
    this.config = {
      endpoint: config?.endpoint || 'https://ark.cn-beijing.volces.com/api/v3',
      model: config?.model || '',
      apiKeyEnv: config?.apiKeyEnv || 'ARK_API_KEY',
      timeout: config?.timeout || 120,
    }
  }

  private resolveApiKey(): string {
    const envName = this.config.apiKeyEnv || 'ARK_API_KEY'
    // 优先从 settingStore 的环境变量配置中读取
    const storeVars = useSettingStore.getState().envVars
    const match = storeVars.find((v: { name: string; value: string; description: string }) => v.name === envName)
    if (match && match.value) return match.value
    // 回退到 process.env
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env && process.env[envName]) {
        // @ts-ignore
        return process.env[envName] as string
      }
    } catch { /* ignore */ }
    return ''
  }

  async translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string> {
    const apiKey = this.resolveApiKey()
    if (!apiKey) throw new Error(`API key not found for env var: ${this.config.apiKeyEnv}`)

    const prompt = (promptTemplate || '{input}').replace('{input}', text)
    const baseUrl = this.config.endpoint.replace(/\/+$/, '')
    const url = `${baseUrl}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
      signal,
    })

    if (!response.ok) throw new Error(`Ark API error: ${response.status} ${response.statusText}`)

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const apiKey = this.resolveApiKey()
      if (!apiKey) {
        return { success: false, error: `API key not found for env var: ${this.config.apiKeyEnv}` }
      }
      const baseUrl = this.config.endpoint.replace(/\/+$/, '')
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: this.config.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 }),
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Connection failed' }
    }
  }

  getInfo(): ProviderInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      backend: this.backend,
    }
  }
}
