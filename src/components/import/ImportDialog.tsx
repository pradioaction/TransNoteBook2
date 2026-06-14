import { useState, useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { splitTextIntoParagraphs } from '@/utils/fileUtils'
import type { SplitMode } from '@/utils/fileUtils'
import { IconClose } from '@/components/icons'

export interface ImportResult {
  text: string
  filename: string
  splitMode: SplitMode
}

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  onImport: (result: ImportResult) => void
}

const DEFAULT_FILENAME = 'imported'

export function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const { colors } = useTheme()
  const [text, setText] = useState('')
  const [filename, setFilename] = useState(DEFAULT_FILENAME)
  const [splitMode, setSplitMode] = useState<SplitMode>('singleNewline')

  useEffect(() => {
    if (open) {
      setFilename(DEFAULT_FILENAME)
      setText('')
      setSplitMode('singleNewline')
      // 默认从剪贴板读取内容
      const api = window.electronAPI
      if (api?.readClipboard) {
        api.readClipboard().then((content) => {
          if (content) setText(content)
        }).catch(() => { /* 忽略剪贴板读取失败 */ })
      }
    }
  }, [open])

  const paragraphs = text.trim() ? splitTextIntoParagraphs(text, splitMode) : []

  const isValid = text.trim().length > 0 && filename.trim().length > 0

  const handleImport = () => {
    if (!isValid) return
    onImport({ text, filename: filename.trim(), splitMode })
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 10000,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const dialogStyle: React.CSSProperties = {
    width: 620,
    maxHeight: '85vh',
    backgroundColor: colors.editorBackground,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  }

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px', borderBottom: `1px solid ${colors.border}`,
    fontSize: 14, fontWeight: 600, color: colors.foreground,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: colors.foreground, display: 'block', marginBottom: 4, fontWeight: 500,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px', fontSize: 13,
    backgroundColor: colors.inputBackground, color: colors.foreground,
    border: `1px solid ${colors.inputBorder}`, borderRadius: 3,
    outline: 'none', boxSizing: 'border-box',
  }

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 250,
    resize: 'vertical',
    fontFamily: 'monospace',
    lineHeight: 1.5,
  }

  const btnStyle: React.CSSProperties = {
    padding: '6px 16px', fontSize: 13, border: 'none', borderRadius: 4,
    cursor: 'pointer',
  }

  if (!open) return null

  return (
    <div style={overlayStyle} onClick={() => onClose()}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        {/* 标题 */}
        <div style={headerStyle}>
          <span>导入文本</span>
          <button onClick={() => onClose()}
            style={{ background: 'none', border: 'none', color: colors.foreground, cursor: 'pointer', fontSize: 16, display: 'inline-flex', alignItems: 'center' }}>
            <IconClose size={14} />
          </button>
        </div>

        {/* 表单 */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1 }}>
          {/* 文件名 */}
          <div>
            <label style={labelStyle}>文件名</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <input
                style={{ ...inputStyle, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder='输入文件名，如 "myfile" 或 "./sub/myfile"'
                autoFocus
              />
              <span style={{
                padding: '6px 8px', fontSize: 13,
                backgroundColor: colors.toolbarBackground, color: colors.foreground,
                border: `1px solid ${colors.inputBorder}`, borderLeft: 'none', borderRadius: '0 3px 3px 0',
              }}>
                .transnb
              </span>
            </div>
          </div>

          {/* 拆分模式 */}
          <div>
            <label style={labelStyle}>段落拆分方式</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setSplitMode('singleNewline')}
                style={{
                  ...btnStyle,
                  backgroundColor: splitMode === 'singleNewline' ? colors.primaryButton : colors.toolbarBackground,
                  color: splitMode === 'singleNewline' ? '#fff' : colors.foreground,
                  border: splitMode === 'singleNewline' ? 'none' : `1px solid ${colors.border}`,
                  flex: 1,
                }}
              >
                按单个换行符拆分
              </button>
              <button
                onClick={() => setSplitMode('doubleNewline')}
                style={{
                  ...btnStyle,
                  backgroundColor: splitMode === 'doubleNewline' ? colors.primaryButton : colors.toolbarBackground,
                  color: splitMode === 'doubleNewline' ? '#fff' : colors.foreground,
                  border: splitMode === 'doubleNewline' ? 'none' : `1px solid ${colors.border}`,
                  flex: 1,
                }}
              >
                按空行拆分
              </button>
            </div>
          </div>

          {/* 文本内容 */}
          <div>
            <label style={labelStyle}>
              文本内容
              {text && (
                <span style={{ fontSize: 11, color: '#999', fontWeight: 400, marginLeft: 8 }}>
                  ({paragraphs.length} 个段落)
                </span>
              )}
            </label>
            <textarea
              style={textareaStyle}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入或粘贴文本内容，剪贴板内容已自动加载..."
            />
          </div>
        </div>

        {/* 按钮栏 */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          padding: '12px 16px', borderTop: `1px solid ${colors.border}`,
        }}>
          <button
            onClick={() => onClose()}
            style={{
              ...btnStyle,
              border: `1px solid ${colors.border}`,
              backgroundColor: 'transparent', color: colors.foreground,
            }}
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={!isValid}
            style={{
              ...btnStyle,
              backgroundColor: colors.primaryButton, color: '#fff',
              opacity: isValid ? 1 : 0.5,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            导入
          </button>
        </div>
      </div>
    </div>
  )
}
