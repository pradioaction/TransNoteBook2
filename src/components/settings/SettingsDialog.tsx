import { useThemeStore } from '@/store/themeStore'
import { useSettingStore } from '@/store/settingStore'
import { useTheme } from '@/hooks/useTheme'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { createTranslationService } from '@/services/translationService'
import { IconCheck, IconQuestion, IconClose, IconSun, IconMoon } from '@/components/icons'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { theme, setTheme } = useThemeStore()
  const { colors } = useTheme()
  const settingStore = useSettingStore()
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<'general' | 'translation' | 'templates' | 'models'>('general')
  const [newModelOpen, setNewModelOpen] = useState(false)
  const [editingModelName, setEditingModelName] = useState<string | null>(null)
  const [newModel, setNewModel] = useState({
    name: '', apiKeyEnv: '', endpoint: '', model: '', timeout: 120, backend: 'ollama', enabled: true,
  })
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({})
  const [newEnvName, setNewEnvName] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')
  const [newEnvDescription, setNewEnvDescription] = useState('')

  const handleTestConnection = useCallback(async (providerId: string) => {
    setTestingProvider(providerId)
    const service = createTranslationService({
      getSettingState: () => useSettingStore.getState(),
      getNotebook: () => null,
      updateCellOutput: () => {},
      setModified: () => {},
    })
    const result = await service.testConnection(providerId)
    setTestResults(prev => ({ ...prev, [providerId]: result }))
    setTestingProvider(null)
  }, [])

  const renderTestResult = (providerId: string) => {
    const r = testResults[providerId]
    if (r === undefined) return null
    if (r.success) {
      return <span style={{ marginLeft: 8, fontSize: 12, color: '#4caf50' }}><IconCheck size={14} /> {t('settings.connected')}</span>
    }
    return (
      <span style={{ marginLeft: 8, fontSize: 11, color: '#e06c75' }}>
        {r.error || t('settings.failed')}
      </span>
    )
  }

  const handleAddEnvVar = () => {
    if (!newEnvName.trim()) return
    settingStore.setEnvVars([...settingStore.envVars, { name: newEnvName.trim(), value: newEnvValue.trim(), description: newEnvDescription.trim() }])
    setNewEnvName('')
    setNewEnvValue('')
    setNewEnvDescription('')
  }

  const handleRemoveEnvVar = (index: number) => {
    settingStore.setEnvVars(settingStore.envVars.filter((_, i) => i !== index))
  }

  if (!open) return null

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    fontSize: 12,
    cursor: 'pointer',
    border: 'none',
    background: isActive ? colors.editorBackground : 'transparent',
    color: colors.foreground,
    borderBottom: isActive ? `2px solid ${colors.primaryButton}` : `2px solid transparent`,
    fontWeight: isActive ? 600 : 400,
  })

  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: colors.foreground, display: 'block', marginBottom: 4,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px', fontSize: 13,
    backgroundColor: colors.inputBackground, color: colors.foreground,
    border: `1px solid ${colors.inputBorder}`, borderRadius: 3,
    outline: 'none', boxSizing: 'border-box',
  }

  const textareaStyle: React.CSSProperties = {
    ...inputStyle, minHeight: 60, resize: 'vertical',
  }

  const btnStyle: React.CSSProperties = {
    padding: '6px 16px', fontSize: 12, border: 'none', borderRadius: 3,
    cursor: 'pointer',
  }

  const primaryBtn: React.CSSProperties = {
    ...btnStyle, backgroundColor: colors.primaryButton, color: '#fff',
  }

  const handleAddModel = () => {
    if (!newModel.name || !newModel.endpoint) return
    if (editingModelName) {
      settingStore.removeCustomModel(editingModelName)
    }
    settingStore.addCustomModel({ ...newModel })
    setNewModel({ name: '', apiKeyEnv: '', endpoint: '', model: '', timeout: 120, backend: 'ollama', enabled: true })
    setNewModelOpen(false)
    setEditingModelName(null)
  }

  const handleRemoveModel = (name: string) => {
    settingStore.removeCustomModel(name)
  }

  const handleEditModel = (model: typeof settingStore.customModels[0]) => {
    setNewModel({
      name: model.name,
      apiKeyEnv: model.apiKeyEnv,
      endpoint: model.endpoint,
      model: model.model,
      timeout: model.timeout,
      backend: model.backend,
      enabled: model.enabled,
    })
    setEditingModelName(model.name)
    setNewModelOpen(true)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640, maxHeight: '80vh',
          backgroundColor: colors.editorBackground,
          border: `1px solid ${colors.border}`,
          borderRadius: 8, display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid ${colors.border}`,
          fontSize: 14, fontWeight: 600, color: colors.foreground,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{t('settings.title')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.foreground, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><IconClose size={14} /></button>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}`, paddingLeft: 8 }}>
          <button style={tabStyle(activeTab === 'general')} onClick={() => setActiveTab('general')}>{t('settings.tabGeneral')}</button>
          <button style={tabStyle(activeTab === 'translation')} onClick={() => setActiveTab('translation')}>{t('settings.tabTranslation')}</button>
          <button style={tabStyle(activeTab === 'templates')} onClick={() => setActiveTab('templates')}>{t('settings.tabPrompts')}</button>
          <button style={tabStyle(activeTab === 'models')} onClick={() => setActiveTab('models')}>{t('settings.tabModels')}</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {activeTab === 'general' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('settings.theme')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setTheme('light'); settingStore.saveToDisk() }}
                    style={{ ...btnStyle, backgroundColor: theme === 'light' ? colors.primaryButton : colors.toolbarBackground, color: colors.foreground, border: `1px solid ${colors.border}`, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  ><IconSun size={16} /> {t('settings.light')}</button>
                  <button
                    onClick={() => { setTheme('dark'); settingStore.saveToDisk() }}
                    style={{ ...btnStyle, backgroundColor: theme === 'dark' ? colors.primaryButton : colors.toolbarBackground, color: colors.foreground, border: `1px solid ${colors.border}`, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  ><IconMoon size={16} /> {t('settings.dark')}</button>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('settings.language')}</label>
                <select
                  value={i18n.language}
                  onChange={(e) => {
                    i18n.changeLanguage(e.target.value)
                    localStorage.setItem('i18nextLng', e.target.value)
                  }}
                  style={inputStyle}
                >
                  <option value="zh-CN">{t('settings.langChinese')}</option>
                  <option value="en-US">{t('settings.langEnglish')}</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('settings.readingFontSize')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range"
                    min={10} max={24} step={1}
                    value={settingStore.readingFontSize}
                    onChange={(e) => settingStore.setReadingFontSize(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 13, color: colors.foreground, minWidth: 30 }}>
                    {settingStore.readingFontSize}px
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('settings.cellWidthRatio')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range"
                    min={50} max={100} step={5}
                    value={settingStore.cellWidthRatio}
                    onChange={(e) => settingStore.setCellWidthRatio(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 13, color: colors.foreground, minWidth: 30 }}>
                    {settingStore.cellWidthRatio}%
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('settings.envVars')}</label>
                {settingStore.envVars.length === 0 && (
                  <div style={{ fontSize: 12, color: '#999', fontStyle: 'italic', marginBottom: 8 }}>{t('settings.envVarsEmpty')}</div>
                )}
                {settingStore.envVars.map((v, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                    <code style={{ fontSize: 12, backgroundColor: colors.inputBackground, padding: '4px 8px', borderRadius: 3, flex: 1 }}>{v.name}</code>
                    <span style={{ fontSize: 12, color: '#999', flex: 2 }}>{v.description}</span>
                    <button
                      onClick={() => handleRemoveEnvVar(i)}
                      style={{ ...btnStyle, backgroundColor: 'transparent', color: '#e06c75', border: `1px solid #e06c75`, padding: '2px 8px', fontSize: 11 }}
                    >{t('settings.envVarRemove')}</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder={t('settings.envVarName')}
                    value={newEnvName}
                    onChange={(e) => setNewEnvName(e.target.value)}
                  />
                  <input
                    type="password"
                    style={{ ...inputStyle, flex: 2 }}
                    placeholder={t('settings.envVarValue')}
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                  />
                  <input
                    style={{ ...inputStyle, flex: 2 }}
                    placeholder={t('settings.envVarDescription')}
                    value={newEnvDescription}
                    onChange={(e) => setNewEnvDescription(e.target.value)}
                  />
                  <button onClick={handleAddEnvVar} style={primaryBtn}>{t('settings.envVarAdd')}</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'translation' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  <input
                    type="checkbox"
                    checked={settingStore.translation.enabled}
                    onChange={(e) => settingStore.setTranslation({ ...settingStore.translation, enabled: e.target.checked })}
                  /> {t('settings.enableTranslation')}
                </label>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{t('settings.defaultProvider')}</label>
                <select
                  value={settingStore.translation.currentProvider}
                  onChange={(e) => settingStore.setTranslation({ ...settingStore.translation, currentProvider: e.target.value })}
                  style={inputStyle}
                >
                  <option value="system_Ollama">{t('settings.ollamaLabel')}</option>
                  <option value="system_OpenAI">{t('settings.openaiLabel')}</option>
                  {settingStore.customModels.map((m) => (
                    <option key={m.name} value={`custom_${m.name}`}>{t('settings.customLabel', { name: m.name })}</option>
                  ))}
                </select>
              </div>

              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 4, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: colors.foreground, marginBottom: 8 }}>{t('settings.ollamaSection')}</div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>{t('settings.baseUrl')}</label>
                  <input style={inputStyle} value={settingStore.translation.ollama.baseUrl}
                    onChange={(e) => settingStore.setTranslation({ ...settingStore.translation, ollama: { ...settingStore.translation.ollama, baseUrl: e.target.value } })} />
                </div>
                <div>
                  <label style={labelStyle}>{t('settings.model')}</label>
                  <input style={inputStyle} value={settingStore.translation.ollama.model}
                    onChange={(e) => settingStore.setTranslation({ ...settingStore.translation, ollama: { ...settingStore.translation.ollama, model: e.target.value } })} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => handleTestConnection('system_Ollama')}
                    disabled={testingProvider === 'system_Ollama'}
                    style={{ ...btnStyle, border: `1px solid ${colors.border}`, color: colors.foreground }}
                  >
                    {testingProvider === 'system_Ollama' ? t('settings.testing') : t('settings.testConnection')}
                  </button>
                  {testResults['system_Ollama'] !== undefined && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: testResults['system_Ollama'] ? '#4caf50' : '#e06c75' }}>
                      {testResults['system_Ollama'] ? <><IconCheck size={14} /> {t('settings.connected')}</> : <>{t('settings.failed')}</>}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 4, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: colors.foreground, marginBottom: 8 }}>{t('settings.openaiSection')}</div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>{t('settings.baseUrl')}</label>
                  <input style={inputStyle} value={settingStore.translation.openai.baseUrl}
                    onChange={(e) => settingStore.setTranslation({ ...settingStore.translation, openai: { ...settingStore.translation.openai, baseUrl: e.target.value } })} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>{t('settings.model')}</label>
                  <input style={inputStyle} value={settingStore.translation.openai.model}
                    onChange={(e) => settingStore.setTranslation({ ...settingStore.translation, openai: { ...settingStore.translation.openai, model: e.target.value } })} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>{t('settings.apiKeyEnvVar')}</label>
                  <input style={inputStyle} value={settingStore.translation.openai.apiKeyEnv}
                    onChange={(e) => settingStore.setTranslation({ ...settingStore.translation, openai: { ...settingStore.translation.openai, apiKeyEnv: e.target.value } })} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>{t('settings.timeout')}</label>
                  <input type="number" style={inputStyle} value={settingStore.translation.openai.timeout}
                    onChange={(e) => settingStore.setTranslation({ ...settingStore.translation, openai: { ...settingStore.translation.openai, timeout: Number(e.target.value) } })} />
                </div>
                <div>
                  <label style={labelStyle}>{t('settings.proxy')}</label>
                  <input style={inputStyle} value={settingStore.translation.openai.proxy}
                    onChange={(e) => settingStore.setTranslation({ ...settingStore.translation, openai: { ...settingStore.translation.openai, proxy: e.target.value } })} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => handleTestConnection('system_OpenAI')}
                    disabled={testingProvider === 'system_OpenAI'}
                    style={{ ...btnStyle, border: `1px solid ${colors.border}`, color: colors.foreground }}
                  >
                    {testingProvider === 'system_OpenAI' ? t('settings.testing') : t('settings.testConnection')}
                  </button>
                  {testResults['system_OpenAI'] !== undefined && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: testResults['system_OpenAI'] ? '#4caf50' : '#e06c75' }}>
                      {testResults['system_OpenAI'] ? <><IconCheck size={14} /> {t('settings.connected')}</> : <><IconQuestion size={14} /> {t('settings.failed')}</>}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{t('settings.translationPrompt')}</label>
                <textarea style={textareaStyle} value={settingStore.promptTemplates.translation}
                  onChange={(e) => settingStore.setPromptTemplates({ ...settingStore.promptTemplates, translation: e.target.value })} />
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{t('settings.promptHint')}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{t('settings.analysisPrompt')}</label>
                <textarea style={textareaStyle} value={settingStore.promptTemplates.analysis}
                  onChange={(e) => settingStore.setPromptTemplates({ ...settingStore.promptTemplates, analysis: e.target.value })} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{t('settings.sceneryPrompt')}</label>
                <textarea style={textareaStyle} value={settingStore.promptTemplates.scenery}
                  onChange={(e) => settingStore.setPromptTemplates({ ...settingStore.promptTemplates, scenery: e.target.value })} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{t('settings.reviewPrompt')}</label>
                <textarea style={textareaStyle} value={settingStore.promptTemplates.review}
                  onChange={(e) => settingStore.setPromptTemplates({ ...settingStore.promptTemplates, review: e.target.value })} />
              </div>
            </div>
          )}

          {activeTab === 'models' && (
            <div>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.foreground }}>
                  {t('settings.customModels', { count: settingStore.customModels.length })}
                </span>
                <button onClick={() => setNewModelOpen(true)} style={primaryBtn}>{t('settings.addModel')}</button>
              </div>

              {settingStore.customModels.length === 0 && (
                <div style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>{t('settings.noCustomModels')}</div>
              )}

              {settingStore.customModels.map((m) => (
                <div key={m.name} style={{ border: `1px solid ${colors.border}`, borderRadius: 4, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ fontSize: 13, color: colors.foreground }}>{m.name}</strong>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => handleEditModel(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: colors.primaryButton }}>{t('settings.editModel')}</button>
                      <button
                        onClick={() => handleTestConnection(`custom_${m.name}`)}
                        disabled={testingProvider === `custom_${m.name}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: colors.primaryButton }}
                      >
                        {testingProvider === `custom_${m.name}` ? t('settings.testing') : t('settings.testModel')}
                      </button>
                      {renderTestResult(`custom_${m.name}`)}
                      <button onClick={() => handleRemoveModel(m.name)} style={{ background: 'none', border: 'none', color: '#e06c75', cursor: 'pointer', fontSize: 12 }}>{t('settings.removeModel')}</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {m.backend} | {m.endpoint} | model: {m.model} | timeout: {m.timeout}s
                    {m.apiKeyEnv && ` | env: ${m.apiKeyEnv}`}
                  </div>
                </div>
              ))}

              {newModelOpen && (
                <div style={{ border: `1px solid ${colors.primaryButton}`, borderRadius: 4, padding: 12, marginTop: 8 }}>
                  <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: colors.foreground }}>
                    {editingModelName ? t('settings.editModelForm') : t('settings.addModelForm')}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>{t('settings.modelName')}</label>
                    <input style={inputStyle} value={newModel.name}
                      onChange={(e) => setNewModel({ ...newModel, name: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>{t('settings.backend')}</label>
                    <select style={inputStyle} value={newModel.backend}
                      onChange={(e) => setNewModel({ ...newModel, backend: e.target.value })}>
                      <option value="ollama">{t('settings.backendOllama')}</option>
                      <option value="ark">{t('settings.backendArk')}</option>
                      <option value="openai">{t('settings.backendOpenAI')}</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>{t('settings.endpoint')}</label>
                    <input style={inputStyle} value={newModel.endpoint}
                      onChange={(e) => setNewModel({ ...newModel, endpoint: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>{t('settings.model')}</label>
                    <input style={inputStyle} value={newModel.model}
                      onChange={(e) => setNewModel({ ...newModel, model: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>{t('settings.apiKeyEnvVar')}</label>
                    <input style={inputStyle} value={newModel.apiKeyEnv}
                      onChange={(e) => setNewModel({ ...newModel, apiKeyEnv: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>{t('settings.timeout')}</label>
                    <input type="number" style={inputStyle} value={newModel.timeout}
                      onChange={(e) => setNewModel({ ...newModel, timeout: Number(e.target.value) })} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setNewModelOpen(false)} style={{ ...btnStyle, border: `1px solid ${colors.border}`, color: colors.foreground }}>{t('settings.cancel')}</button>
                    <button onClick={handleAddModel} style={primaryBtn}>{editingModelName ? t('settings.save') : t('settings.add')}</button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
