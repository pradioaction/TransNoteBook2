import { useState, useEffect, useRef, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { DOMSerializer } from 'prosemirror-model'
import { marked } from 'marked'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useSettingStore } from '@/store/settingStore'
import type { NotebookCell } from '@/types/notebook'

interface CellEditorProps {
  cell: NotebookCell
  onContentChange: (content: string) => void
  onFocus: () => void
  onSplit: (beforeHtml: string, afterHtml: string) => void
  placeholder?: string
}

// Strip structural HTML tags but preserve <u> tags for review word underlines
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  function walkNodes(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const inner = Array.from(el.childNodes).map(walkNodes).join('')
      if (el.tagName.toLowerCase() === 'u') {
        return `<u>${inner}</u>`
      }
      return inner
    }
    return ''
  }

  return walkNodes(doc.body)
}

export function CellEditor({
  cell,
  onContentChange,
  onFocus,
  onSplit,
  placeholder: placeholderProp,
}: CellEditorProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const { readingFontSize } = useSettingStore()
  const [editing, setEditing] = useState(false)
  const lastSyncedRef = useRef('')

  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Placeholder.configure({ placeholder: placeholderProp }),
  ], [placeholderProp])

  const editor = useEditor({
    extensions,
    content: cell.content,
    editable: editing,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      // Skip if this update is from our own sync (TipTap fires onUpdate async)
      if (html === lastSyncedRef.current) return
      // Decode &lt;u&gt; back to <u> before storing
      onContentChange(html.replace(/&lt;(\/?)u&gt;/g, '<$1u>'))
    },
    onFocus,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape' && editing) {
          setEditing(false)
          return true
        }
        // Ctrl+P 拆分 cell
        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === 'p') {
          if (!editor) return true
          event.preventDefault()
          const { from } = editor.state.selection
          const doc = editor.state.doc
          const docSize = doc.content.size

          // 光标在文档开头或末尾时阻止分割
          if (from <= 0 || from >= docSize) return true

          // 序列化光标前的内容为 HTML
          const beforeDiv = document.createElement('div')
          beforeDiv.appendChild(
            DOMSerializer.fromSchema(editor.schema)
              .serializeFragment(doc.slice(0, from).content)
          )
          const beforeHtml = beforeDiv.innerHTML

          // 序列化光标后的内容为 HTML
          const afterDiv = document.createElement('div')
          afterDiv.appendChild(
            DOMSerializer.fromSchema(editor.schema)
              .serializeFragment(doc.slice(from).content)
          )
          const afterHtml = afterDiv.innerHTML

          onSplit(beforeHtml, afterHtml)
          return true
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (editor && cell.content !== editor.getHTML()) {
      // Encode <u> as &lt;u&gt; so TipTap displays it as visible text markers
      const editorContent = cell.content.replace(/<(\/?)u>/g, '&lt;$1u&gt;')
      if (editorContent !== editor.getHTML()) {
        editor.commands.setContent(editorContent)
        lastSyncedRef.current = editor.getHTML()
      }
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
            {t('cellEditor.editingHint')}
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
        <div style={{ position: 'relative' }}>
          <style>{markdownBodyCss}</style>
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
        </div>
      )}
    </div>
  )
}

