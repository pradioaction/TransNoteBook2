import type { TranslationProvider, CustomModelConfig } from './types'
import { OllamaProvider } from './providers/ollama'
import { OpenAIProvider } from './providers/openai'
import { ArkProvider } from './providers/ark'
import type { ProviderInfo } from '@/translation/types'

export function buildProvider(model: CustomModelConfig): TranslationProvider {
  if (model.backend === 'ark') {
    return new ArkProvider(model.name, {
      endpoint: model.endpoint,
      model: model.model,
      apiKeyEnv: model.apiKeyEnv,
      timeout: model.timeout,
    })
  }
  if (model.backend === 'openai') {
    return new OpenAIProvider({
      baseUrl: model.endpoint,
      model: model.model,
      apiKeyEnv: model.apiKeyEnv,
      timeout: model.timeout,
    }, model.name)
  }
  // default: ollama backend
  return new OllamaProvider({
    baseUrl: model.endpoint,
    model: model.model,
    timeout: model.timeout,
  })
}

export function createSystemProviders(): TranslationProvider[] {
  return [new OllamaProvider(), new OpenAIProvider()]
}

export function createCustomProviders(customModels: CustomModelConfig[]): TranslationProvider[] {
  return customModels.filter(m => m.enabled).map(m => buildProvider(m))
}
