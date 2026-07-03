import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNotebookStore } from '@/store/notebookStore'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import type { NotebookCell } from '@/types/notebook'

// ==================== 类型 ====================

interface SearchResult {
  cellIndex: number
  matchedText: string
  matchCount: number
  contextSnippet: string
}

// ==================== 工具函数 ====================

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

function searchInCells(cells: NotebookCell[], keyword: string): SearchResult[] {
  if (!keyword.trim()) return []
  const lowerKeyword = keyword.toLowerCase()
  const results: SearchResult[] = []

  cells.forEach((cell, index) => {
    const plainContent = stripHtml(cell.content)
    const output = cell.output
    const contentLower = plainContent.toLowerCase()
    const outputLower = output.toLowerCase()

    let matchCount = 0
    let firstMatch = ''

    // 在 content 中搜索
    let pos = 0
    while ((pos = contentLower.indexOf(lowerKeyword, pos)) !== -1) {
      matchCount++
      if (!firstMatch) {
        firstMatch = plainContent.substring(pos, pos + keyword.length)
      }
      pos += lowerKeyword.length
    }

    // 在 output 中搜索
    pos = 0
    while ((pos = outputLower.indexOf(lowerKeyword, pos)) !== -1) {
      matchCount++
      if (!firstMatch) {
        firstMatch = output.substring(pos, pos + keyword.length)
      }
      pos += lowerKeyword.length
    }

    if (matchCount > 0) {
      // 取第一个匹配位置生成上下文片段
      const contentMatchPos = contentLower.indexOf(lowerKeyword)
      const outputMatchPos = outputLower.indexOf(lowerKeyword)

      let snippet: string
      if (contentMatchPos !== -1 && (outputMatchPos === -1 || contentMatchPos <= outputMatchPos)) {
        const start = Math.max(0, contentMatchPos - 30)
        const end = Math.min(plainContent.length, contentMatchPos + keyword.length + 30)
        snippet = (start > 0 ? '…' : '') + plainContent.slice(start, end) + (end < plainContent.length ? '…' : '')
      } else {
        const start = Math.max(0, outputMatchPos - 30)
        const end = Math.min(output.length, outputMatchPos + keyword.length + 30)
        snippet = (start > 0 ? '…' : '') + output.slice(start, end) + (end < output.length ? '…' : '')
      }

      results.push({
        cellIndex: index,
        matchedText: firstMatch || keyword,
        matchCount,
        contextSnippet: snippet,
      })
    }
  })

  return results
}

// ==================== 组件 ====================

export function SearchPanel() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const cells = useNotebookStore((s) => s.notebook?.cells ?? [])
  const setScrollToCell = useNotebookStore((s) => s.setScrollToCell)
  const setSearchHighlight = useNotebookStore((s) => s.setSearchHighlight)

  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setKeyword(value)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        setResults(searchInCells(cells, value))
        setSelectedIndex(null)
      }, 300)
    },
    [cells],
  )

  // 组件卸载时清理 debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const totalMatches = useMemo(
    () => results.reduce((sum, r) => sum + r.matchCount, 0),
    [results],
  )

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      setSelectedIndex(result.cellIndex)
      setScrollToCell(result.cellIndex)
      setSearchHighlight(result.matchedText)
    },
    [setScrollToCell, setSearchHighlight],
  )

  // ==================== 样式 ====================

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    color: colors.foreground,
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px 8px',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#999',
  }

  const inputWrapperStyle: React.CSSProperties = {
    padding: '0 16px 8px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: 13,
    backgroundColor: colors.inputBackground,
    color: colors.foreground,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 3,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const statsStyle: React.CSSProperties = {
    padding: '4px 16px 8px',
    fontSize: 11,
    color: '#999',
    borderBottom: `1px solid ${colors.sidebarBorder}`,
  }

  const resultsListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  }

  const resultItemStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: 13,
    cursor: 'pointer',
    color: isSelected ? '#fff' : colors.foreground,
    backgroundColor: isSelected ? colors.listItemSelected : 'transparent',
    borderBottom: `1px solid ${colors.sidebarBorder}`,
  })

  const cellNumberStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: colors.primaryButton,
    marginBottom: 2,
  }

  const snippetStyle: React.CSSProperties = {
    fontSize: 12,
    lineHeight: 1.4,
    color: colors.foreground,
    opacity: 0.8,
    wordBreak: 'break-all',
  }

  const matchCountStyle: React.CSSProperties = {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  }

  const emptyStyle: React.CSSProperties = {
    padding: '24px 16px',
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
  }

  // ==================== 渲染 ====================

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>{t('sidebar.search')}</div>

      <div style={inputWrapperStyle}>
        <input
          placeholder={t('sidebar.searchPlaceholder')}
          value={keyword}
          onChange={handleChange}
          style={inputStyle}
        />
      </div>

      {keyword.trim() ? (
        results.length > 0 ? (
          <>
            <div style={statsStyle}>
              {t('searchPanel.resultsCount', { count: results.length })}
              {totalMatches > results.length && (
                <> · {t('searchPanel.matchesCount', { count: totalMatches })}</>
              )}
            </div>
            <div style={resultsListStyle}>
              {results.map((result) => (
                <div
                  key={result.cellIndex}
                  style={resultItemStyle(selectedIndex === result.cellIndex)}
                  onClick={() => handleResultClick(result)}
                  onMouseEnter={(e) => {
                    if (selectedIndex !== result.cellIndex) {
                      e.currentTarget.style.backgroundColor = colors.listItemHover
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedIndex !== result.cellIndex) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <div style={cellNumberStyle}>#{result.cellIndex + 1}</div>
                  <div style={snippetStyle}>{result.contextSnippet}</div>
                  {result.matchCount > 1 && (
                    <div style={matchCountStyle}>
                      {t('searchPanel.matchesCount', { count: result.matchCount })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={emptyStyle}>{t('searchPanel.noResults')}</div>
        )
      ) : (
        <div style={emptyStyle}>{t('searchPanel.enterKeyword')}</div>
      )}
    </div>
  )
}
