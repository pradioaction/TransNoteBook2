import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { marked } from 'marked'
import { useTheme } from '@/hooks/useTheme'
import { useSettingStore } from '@/store/settingStore'
import { useTranslation } from 'react-i18next'

interface CellOutputProps {
  content: string
  onContentChange: (content: string) => void
}

marked.setOptions({ breaks: true, gfm: true })

export function CellOutput({ content, onContentChange }: CellOutputProps) {
  const { colors } = useTheme()
  const { readingFontSize } = useSettingStore()
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const renderedHtml = useMemo(() => {
    if (!content) return ''
    return marked.parse(content) as string
  }, [content])

  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [])

  useEffect(() => {
    if (editing) autoResize()
  }, [editing, autoResize])

  useEffect(() => {
    if (editing) autoResize()
  }, [content, editing, autoResize])

  const baseStyle: React.CSSProperties = {
    minHeight: 40,
    padding: '8px 12px',
    fontSize: readingFontSize,
    lineHeight: 1.6,
    fontFamily: 'inherit',
  }

  const markdownBodyCss = `
    .md-body p { margin: 0.3em 0; }
    .md-body h1 { font-size: 1.5em; font-weight: 600; margin: 0.5em 0 0.3em; }
    .md-body h2 { font-size: 1.3em; font-weight: 600; margin: 0.4em 0 0.2em; }
    .md-body h3 { font-size: 1.15em; font-weight: 600; margin: 0.3em 0 0.15em; }
    .md-body ul, .md-body ol { padding-left: 1.5em; margin: 0.3em 0; }
    .md-body li { margin: 0.1em 0; }
    .md-body blockquote {
      border-left: 3px solid ${colors.border};
      padding-left: 1em; margin: 0.4em 0; color: ${colors.foreground}99;
    }
    .md-body pre {
      background: ${colors.background};
      padding: 0.75em 1em; border-radius: 4px;
      overflow-x: auto; font-size: 0.9em; margin: 0.4em 0;
    }
    .md-body code {
      background: ${colors.background};
      border-radius: 3px; padding: 0.15em 0.4em; font-size: 0.9em;
    }
    .md-body pre code { background: none; padding: 0; }
    .md-body table { border-collapse: collapse; width: 100%; margin: 0.4em 0; }
    .md-body th, .md-body td {
      border: 1px solid ${colors.border};
      padding: 6px 10px; text-align: left;
    }
    .md-body th { background: ${colors.toolbarBackground}; }
    .md-body a { color: ${colors.primaryButton}; }
    .md-body hr { border: none; border-top: 1px solid ${colors.border}; margin: 0.8em 0; }
    .md-body strong { font-weight: 600; }
    .md-body em { font-style: italic; }
    .md-body * { pointer-events: none; }
  `

  if (editing) {
    return (
      <div style={{
        backgroundColor: colors.cellOutputBackground,
        borderTop: `1px solid ${colors.cellOutputBorder}`,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 6,
          padding: '3px 8px', backgroundColor: colors.toolbarBackground,
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <span style={{ flex: 1, fontSize: 11, color: '#999', alignSelf: 'center' }}>
            Editing — press Escape to finish
          </span>
          <button onClick={() => setEditing(false)}
            style={{ fontSize: 11, padding: '2px 8px', border: `1px solid ${colors.border}`, borderRadius: 3, backgroundColor: colors.toolbarBackground, color: colors.foreground, cursor: 'pointer' }}
          >Cancel</button>
          <button onClick={() => setEditing(false)}
            style={{ fontSize: 11, padding: '2px 8px', border: 'none', borderRadius: 3, backgroundColor: colors.primaryButton, color: '#fff', cursor: 'pointer' }}
          >Done</button>
        </div>
        <textarea ref={textareaRef} autoFocus value={content}
          onChange={(e) => { onContentChange(e.target.value); autoResize() }}
          onDoubleClick={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
          style={{
            ...baseStyle, display: 'block',
            backgroundColor: colors.cellOutputBackground,
            border: 'none', color: colors.foreground,
            resize: 'none', outline: 'none',
            width: '100%', boxSizing: 'border-box',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            overflow: 'hidden',
          }}
          placeholder="Edit translation (Markdown supported)..."
        />
      </div>
    )
  }

  if (!content) {
    return (
      <div onDoubleClick={() => setEditing(true)}
        style={{
          ...baseStyle, backgroundColor: colors.cellOutputBackground,
          borderTop: `1px solid ${colors.cellOutputBorder}`,
          color: '#999', fontSize: 13, fontStyle: 'italic',
          cursor: 'pointer', userSelect: 'none',
        }}
        title={t('cellOutput.editTranslation')}
      >{t('cellOutput.emptyHint')}</div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <style>{markdownBodyCss}</style>
      <div style={{
        position: 'absolute', top: 1, right: 4, zIndex: 2,
        display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s',
      }} className="cell-output-actions">
        <button onClick={() => setEditing(true)} title="Edit translation"
          style={{ fontSize: 11, padding: '2px 6px', border: `1px solid ${colors.border}`, borderRadius: 3, backgroundColor: colors.toolbarBackground, color: colors.foreground, cursor: 'pointer' }}
        >Edit</button>
      </div>
      <div onDoubleClick={() => setEditing(true)}
        className="md-body"
        style={{
          ...baseStyle, backgroundColor: colors.cellOutputBackground,
          borderTop: `1px solid ${colors.cellOutputBorder}`,
          color: colors.foreground, cursor: 'pointer',
        }}
        title={t('cellOutput.editTranslation')}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
      <style>{`
        .cell-output-actions:hover { opacity: 1 !important; }
        *:hover > .cell-output-actions { opacity: 1; }
      `}</style>
    </div>
  )
}
