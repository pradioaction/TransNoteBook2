import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@/locales/i18n'
import { SearchPanel } from '@/components/search/SearchPanel'
import { useNotebookStore } from '@/store/notebookStore'
import { useSearchStore } from '@/store/searchStore'

function makeCell(id: string, content: string) {
  return {
    id,
    type: 'markdown' as const,
    content,
    output: '',
    parentId: null,
    indentLevel: 0,
    isCollapsed: false,
    isInputCollapsed: false,
    isOutputCollapsed: false,
  }
}

describe('SearchPanel', () => {
  beforeEach(() => {
    useSearchStore.getState().resetSearch()
  })

  afterEach(() => {
    vi.useRealTimers()
    useNotebookStore.getState().closeNotebook()
  })

  it('未打开文件（notebook = null）时可正常挂载并接受输入', () => {
    useNotebookStore.getState().closeNotebook()
    expect(useNotebookStore.getState().notebook).toBeNull()

    // 回归：选择器返回不稳定引用时，这里会因 getSnapshot 无限循环而抛错
    render(<SearchPanel />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })
    expect(input).toHaveValue('test')
  })

  it('有文章内容时按关键词返回结果，点击结果写入高亮与滚动目标', () => {
    vi.useFakeTimers()
    useNotebookStore.getState().openFile({
      path: null,
      name: 'untitled-search-panel.transnb',
      isModified: false,
      cells: [makeCell('c1', 'The quick brown fox'), makeCell('c2', 'nothing here')],
    })

    render(<SearchPanel />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'fox' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(useSearchStore.getState().results).toHaveLength(1)

    fireEvent.click(screen.getByText(/quick brown fox/))
    expect(useSearchStore.getState().highlightText).toBe('fox')
    expect(useSearchStore.getState().scrollToCellIndex).toBe(0)
  })
})
