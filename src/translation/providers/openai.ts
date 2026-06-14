import type { TranslationProvider, OpenAIConfig } from '../types'
import type { ProviderInfo } from '@/translation/types'
import { useSettingStore } from '@/store/settingStore'

export class OpenAIProvider implements TranslationProvider {
  readonly id: string
  readonly name: string
  readonly type: 'system' | 'custom'
  readonly backend = 'openai'

  private config: OpenAIConfig

  constructor(config?: Partial<OpenAIConfig>, customName?: string) {
    this.id = customName ? `custom_${customName}` : 'system_OpenAI'
    this.name = customName ? `自定义: ${customName}` : 'OpenAI Compatible'
    this.type = customName ? 'custom' : 'system'
    this.config = {
      baseUrl: config?.baseUrl || 'https://api.openai.com/v1',
      model: config?.model || 'gpt-3.5-turbo',
      apiKeyEnv: config?.apiKeyEnv || 'OPENAI_API_KEY',
      timeout: config?.timeout || 60,
      proxy: config?.proxy || '',
    }
  }

  private resolveApiKey(): string {
    const envName = this.config.apiKeyEnv || 'OPENAI_API_KEY'
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
    const baseUrl = this.config.baseUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/chat/completions`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }
    if (this.config.proxy) headers['X-Proxy'] = this.config.proxy

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
      signal,
    })

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const apiKey = this.resolveApiKey()
      if (!apiKey) {
        return { success: false, error: `API key not found for env var: ${this.config.apiKeyEnv}` }
      }
      const baseUrl = this.config.baseUrl.replace(/\/+$/, '')
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
