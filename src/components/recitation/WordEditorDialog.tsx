import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useRecitationService } from '@/hooks/useRecitationService'
import type { Word } from '@/recitation/types'
import { IconClose } from '@/components/icons'
import { useTranslation } from 'react-i18next'

interface WordEditorDialogProps {
  mode: 'add' | 'edit'
  bookId: number
  wordData?: Word
  onClose: (saved?: boolean) => void
}

export function WordEditorDialog({ mode, bookId, wordData, onClose }: WordEditorDialogProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const recitationService = useRecitationService()
  const [word, setWord] = useState(wordData?.word ?? '')
  const [phonetic, setPhonetic] = useState(wordData?.phonetic ?? '')
  const [definition, setDefinition] = useState(wordData?.definition ?? '')
  const [example, setExample] = useState(wordData?.example ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = word.trim().length > 0 && definition.trim().length > 0

  const handleSave = async () => {
    if (!isValid) {
      setError(t('wordEditor.errorRequired'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const wordPayload = { word: word.trim(), phonetic: phonetic.trim(), definition: definition.trim(), example: example.trim() }

      if (mode === 'add') {
        const result = await recitationService.addWord(bookId, wordPayload)
        if (!result) {
          setError(t('wordEditor.errorExists'))
          setSaving(false)
          return
        }
      } else {
        const ok = await recitationService.updateWord(wordData!.id!, wordPayload)
        if (!ok) {
          setError(t('wordEditor.errorSave'))
          setSaving(false)
          return
        }
      }

      onClose(true)
    } catch {
      setError(t('wordEditor.errorOperation'))
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px', fontSize: 13,
    backgroundColor: colors.inputBackground, color: colors.foreground,
    border: `1px solid ${colors.inputBorder}`, borderRadius: 3,
    outline: 'none', boxSizing: 'border-box',
  }

  const textareaStyle: React.CSSProperties = {
    ...inputStyle, minHeight: 80, resize: 'vertical',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: colors.foreground, display: 'block', marginBottom: 4,
  }

  return (
    <div
      onClick={() => onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          backgroundColor: colors.editorBackground,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* 标题 */}
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid ${colors.border}`,
          fontSize: 14, fontWeight: 600, color: colors.foreground,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{mode === 'add' ? t('wordEditor.add') : t('wordEditor.edit')}</span>
          <button onClick={() => onClose()} style={{ background: 'none', border: 'none', color: colors.foreground, cursor: 'pointer', fontSize: 16, display: 'inline-flex', alignItems: 'center' }}><IconClose size={14} /></button>
        </div>

        {/* 表单 */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>{t('wordEditor.english')}</label>
            <input
              style={inputStyle}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={t('wordEditor.placeholderEnglish')}
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>{t('wordEditor.phonetic')}</label>
            <input
              style={inputStyle}
              value={phonetic}
              onChange={(e) => setPhonetic(e.target.value)}
              placeholder={t('wordEditor.placeholderPhonetic')}
            />
          </div>
          <div>
            <label style={labelStyle}>{t('wordEditor.definition')}</label>
            <input
              style={inputStyle}
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder={t('wordEditor.placeholderDefinition')}
            />
          </div>
          <div>
            <label style={labelStyle}>{t('wordEditor.example')}</label>
            <textarea
              style={textareaStyle}
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder={t('wordEditor.placeholderExample')}
            />
          </div>

          {error && (
            <div style={{
              padding: '6px 10px', fontSize: 12, color: colors.errorText,
              backgroundColor: colors.errorBackground, borderRadius: 4,
              border: `1px solid ${colors.errorBorder}`,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* 按钮栏 */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          padding: '12px 16px', borderTop: `1px solid ${colors.border}`,
        }}>
          <button
            onClick={() => onClose()}
            style={{
              padding: '6px 16px', fontSize: 13,
              border: `1px solid ${colors.border}`, borderRadius: 4,
              backgroundColor: 'transparent', color: colors.foreground,
              cursor: 'pointer',
            }}
          >
            {t('wordEditor.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            style={{
              padding: '6px 16px', fontSize: 13, border: 'none', borderRadius: 4,
              backgroundColor: colors.primaryButton, color: '#fff',
              cursor: saving || !isValid ? 'not-allowed' : 'pointer',
              opacity: saving || !isValid ? 0.6 : 1,
            }}
          >
            {saving ? t('wordEditor.saving') : t('wordEditor.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
