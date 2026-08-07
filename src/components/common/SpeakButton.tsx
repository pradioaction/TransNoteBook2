import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useTTSService } from '@/hooks/useTTSService'
import { useSpeek } from '@/hooks/useSpeek'
import { IconSpeaker, IconMute } from '@/components/icons'
import type { SpeakOptions } from '@/tts/types'

interface SpeakButtonProps {
  /** 要朗读的文本 */
  text: string
  /** 朗读选项 */
  options?: SpeakOptions
  /** 按钮尺寸 */
  size?: number
  /** 是否显示拼读按钮 */
  showSpeek?: boolean
  /** 额外的 class name */
  className?: string
}

export function SpeakButton({ text, options, size = 16, showSpeek = false, className }: SpeakButtonProps) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { speak, stop, speaking } = useTTSService()
  const { speek, stopSpeek, speeking } = useSpeek()
  const isActive = speaking || speeking

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isActive) {
      stop()
      stopSpeek()
    } else {
      speak(text, options)
    }
  }, [text, options, isActive, speak, stop, stopSpeek])

  const handleSpeek = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (speeking) {
      stopSpeek()
    } else {
      speek(text)
    }
  }, [text, speeking, speek, stopSpeek])

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        verticalAlign: 'middle',
      }}
    >
      <button
        onClick={handleClick}
        title={isActive ? t('tts.stop') : t('tts.speak')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size + 8,
          height: size + 8,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: isActive ? colors.link || colors.primaryButton : colors.foreground,
          opacity: isActive ? 1 : 0.6,
          cursor: 'pointer',
          borderRadius: 3,
          transition: 'opacity 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = isActive ? '1' : '0.6' }}
      >
        {isActive ? <IconMute size={size} /> : <IconSpeaker size={size} />}
      </button>
      {showSpeek && (
        <button
          onClick={handleSpeek}
          title={speeking ? t('tts.stop') : t('tts.speek')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            width: size + 4,
            height: size + 4,
            padding: '0 2px',
            border: `1px solid ${colors.border}`,
            borderRadius: 3,
            background: speeking ? `${colors.primaryButton}26` : 'transparent',
            color: speeking ? colors.link || colors.primaryButton : colors.foreground,
            opacity: 0.6,
            cursor: 'pointer',
            transition: 'opacity 0.15s',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6' }}
        >
          {speeking ? '...' : 'ABC'}
        </button>
      )}
    </span>
  )
}
