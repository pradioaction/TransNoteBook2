import { useState, useEffect, useRef, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { marked } from 'marked'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useSettingStore } from '@/store/settingStore'
import type { NotebookCell } from '@/types/notebook'

interface CellEditorProps {
  cell: NotebookCell
  onContentChange: (content: string) => void
  onFocus: () => void
  placeholder?: string
}

// Strip HTML tags to get plain text for marked rendering
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

export function CellEditor({
  cell,
  onContentChange,
  onFocus,
  placeholder: placeholderProp,
}: CellEditorProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const { readingFontSize } = useSettingStore()
  const [editing, setEditing] = useState(false)
  const isUpdatingRef = useRef(false)

  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Placeholder.configure({ placeholder: placeholderProp }),
  ], [placeholderProp])

  const editor = useEditor({
    extensions,
    content: cell.content,
    editable: editing,
    onUpdate: ({ editor: ed }) => {
      if (isUpdatingRef.current) return
      onContentChange(ed.getHTML())
    },
    onFocus,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape' && editing) {
          setEditing(false)
          return true
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (editor && cell.content !== editor.getHTML()) {
      isUpdatingRef.current = true
      editor.commands.setContent(cell.content)
      isUpdatingRef.current = false
    }
  }, [editor, cell.content])

  useEffect(() => {
    if (editor) editor.setEditable(editing)
  }, [editor, editing])

  const renderedHtml = useMemo(() => {
    if (!cell.content) return ''
    // Strip HTML to get raw text, then render as Markdown
    const text = stripHtml(cell.content)
    return marked.parse(text) as string
  }, [cell.content])

  const readingStyle: React.CSSProperties = {
    minHeight: 40,
    padding: '8px 12px',
    fontSize: readingFontSize,
    lineHeight: 1.6,
    fontFamily: 'inherit',
    cursor: 'pointer',
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      {editing && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 6,
          padding: '2px 8px',
          backgroundColor: colors.toolbarBackground,
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <span style={{ flex: 1, fontSize: 11, color: '#999', alignSelf: 'center' }}>
            Editing 鈥?press Escape to finish
          </span>
          <button
            onClick={() => setEditing(false)}
            onMouseDown={(e) => e.preventDefault()}
            style={{
              fontSize: 11, padding: '2px 8px',
              border: 'none', borderRadius: 3,
              backgroundColor: colors.primaryButton, color: '#fff',
              cursor: 'pointer',
            }}
          >{t('cellEditor.done')}</button>
        </div>
      )}

      {editing ? (
        <div
          onDoubleClick={() => setEditing(false)}
          style={{
          minHeight: 60, padding: '4px 8px',
          fontSize: readingFontSize,
          backgroundColor: colors.editorBackground,
          color: colors.editorForeground, flex: 1,
        }}>
          <EditorContent editor={editor} />
        </div>
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          className="md-body"
          style={{
            ...readingStyle,
            backgroundColor: colors.editorBackground,
            color: colors.editorForeground,
          }}
          title={t('cellEditor.doubleClickHint')}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )}
    </div>
  )
}

