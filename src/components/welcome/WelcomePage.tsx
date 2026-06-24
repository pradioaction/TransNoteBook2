import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useFileService } from '@/hooks/useFileService'
import { useSettingStore } from '@/store/settingStore'
import { IconFile } from '@/components/icons'

interface WelcomePageProps {
  onFileOpened?: () => void
}

export function WelcomePage(_props: WelcomePageProps) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const fileService = useFileService()
  const { recentFiles } = useSettingStore()

  const btnStyle: React.CSSProperties = {
    padding: '8px 24px',
    fontSize: 14,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    backgroundColor: colors.primaryButton,
    color: '#fff',
  }

  const handleOpenFile = async () => {
    await fileService.openFile()
  }

  const handleNewFile = async () => {
    await fileService.createFile()
  }

  const openRecentFile = async (path: string) => {
    await fileService.openFile(path)
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.editorBackground,
        color: colors.foreground,
        padding: 40,
        gap: 24,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>
        {t('welcome.title')}
      </div>
      <div style={{ fontSize: 13, color: '#999' }}>
        {t('welcome.subtitle')}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button style={btnStyle} onClick={handleOpenFile}>
          {t('welcome.openFile')}
        </button>
        <button
          style={{ ...btnStyle, backgroundColor: colors.toolbarBackground, color: colors.foreground, border: `1px solid ${colors.border}` }}
          onClick={handleNewFile}
        >
          {t('welcome.newFile')}
        </button>
      </div>

      {recentFiles.length > 0 && (
        <div style={{ width: '100%', maxWidth: 400, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#999', marginBottom: 8, letterSpacing: 1 }}>
            {t('welcome.recentFiles')}
          </div>
          {recentFiles.slice(0, 10).map((path) => (
            <div
              key={path}
              onClick={() => openRecentFile(path)}
              style={{
                padding: '6px 8px',
                fontSize: 13,
                cursor: 'pointer',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.toolbarBackground)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center' }}><IconFile size={14} /></span>    
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {path.split(/[/\\]/).pop()}
              </span>
              <span style={{ fontSize: 11, color: '#666', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', 
whiteSpace: 'nowrap', maxWidth: 200 }} title={path}>
                {path}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
