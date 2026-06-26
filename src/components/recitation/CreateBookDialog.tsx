import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import { IconClose } from '@/components/icons'

interface CreateBookDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, description: string) => void
}

export function CreateBookDialog({ open, onClose, onCreate }: CreateBookDialogProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  if (!open) return null

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed, description.trim())
    setName('')
    setDescription('')
  }

  const handleCancel = () => {
    setName('')
    setDescription('')
    onClose()
  }

  return (
    <div
      onClick={handleCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          backgroundColor: colors.editorBackground,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: colors.foreground }}>
            {t('bookManager.createBook')}
          </span>
          <button
            onClick={handleCancel}
            style={{
              background: 'none', border: 'none', color: colors.foreground,
              cursor: 'pointer', fontSize: 16, padding: '0 4px', display: 'inline-flex', alignItems: 'center',
            }}
          >
            <IconClose size={14} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: colors.foreground, marginBottom: 6, fontWeight: 500 }}>
            {t('bookManager.createBookName')} <span style={{ color: colors.errorText }}>*</span>
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            placeholder={t('bookManager.createBookNameRequired')}
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13,
              backgroundColor: colors.inputBackground, color: colors.foreground,
              border: `1px solid ${colors.inputBorder}`, borderRadius: 4,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: colors.foreground, marginBottom: 6, fontWeight: 500 }}>
            {t('bookManager.createBookDesc')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('bookManager.createBookDesc')}
            rows={3}
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13,
              backgroundColor: colors.inputBackground, color: colors.foreground,
              border: `1px solid ${colors.inputBorder}`, borderRadius: 4,
              outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '6px 16px', fontSize: 13,
              border: `1px solid ${colors.border}`, borderRadius: 4,
              backgroundColor: 'transparent', color: colors.foreground,
              cursor: 'pointer',
            }}
          >
            {t('bookManager.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            style={{
              padding: '6px 16px', fontSize: 13,
              border: 'none', borderRadius: 4,
              backgroundColor: colors.primaryButton, color: '#fff',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            {t('bookManager.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
