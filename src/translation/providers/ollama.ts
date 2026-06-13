import type { TranslationProvider, OllamaConfig } from '../types'
import type { ProviderInfo } from '@/services/types'

export class OllamaProvider implements TranslationProvider {
  readonly id = 'system_Ollama'
  readonly name = 'Ollama (Local)'
  readonly type = 'system' as const
  readonly backend = 'ollama'

  private config: OllamaConfig

  constructor(config?: Partial<OllamaConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || 'http://localhost:11434',
      model: config?.model || 'qwen2.5:0.5b',
      timeout: config?.timeout || 30,
    }
  }

  async translate(text: string, promptTemplate?: string, signal?: AbortSignal): Promise<string> {
    const prompt = (promptTemplate || '{input}').replace('{input}', text)
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/api/generate`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.config.model, prompt, stream: false }),
      signal,
    })

    if (!response.ok) throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)

    const data = await response.json()
    return data.response || ''
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${this.config.baseUrl.replace(/\/+$/, '')}/api/tags`
      const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) })
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
