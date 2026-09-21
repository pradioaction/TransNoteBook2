import { describe, it, expect, beforeEach } from 'vitest'
import { useSearchStore } from '@/store/searchStore'
import { useNotebookStore } from '@/store/notebookStore'
import { useRecitationStore } from '@/store/recitationStore'
import { useReadingTimerStore } from '@/store/readingTimerStore'

describe('SearchStore', () => {
  beforeEach(() => useSearchStore.getState().resetSearch())

  it('selectResult 同时写入选中项、滚动目标与高亮词', () => {
    useSearchStore.getState().selectResult(3, 'word')
    const state = useSearchStore.getState()
    expect(state.selectedIndex).toBe(3)
    expect(state.scrollToCellIndex).toBe(3)
    expect(state.highlightText).toBe('word')
  })

  it('清空关键词时同步清除高亮（v2.0 文档承诺的行为）', () => {
    useSearchStore.getState().selectResult(0, 'word')
    useSearchStore.getState().setKeyword('')
    expect(useSearchStore.getState().highlightText).toBe('')
  })

  it('resetSearch 归零全部搜索会话状态', () => {
    const store = useSearchStore.getState()
    store.setKeyword('word')
    store.setResults([{ cellIndex: 0, matchedText: 'word', matchCount: 1, contextSnippet: 'word' }])
    store.selectResult(0, 'word')

    useSearchStore.getState().resetSearch()

    const state = useSearchStore.getState()
    expect(state.keyword).toBe('')
    expect(state.results).toEqual([])
    expect(state.selectedIndex).toBeNull()
    expect(state.highlightText).toBe('')
    expect(state.scrollToCellIndex).toBeNull()
  })
})

describe('搜索会话的生命周期收口', () => {
  beforeEach(() => {
    useSearchStore.getState().resetSearch()
    useRecitationStore.getState().reset()
  })

  it('切换/打开文件时清空搜索会话', () => {
    useSearchStore.getState().selectResult(1, 'word')
    useNotebookStore
      .getState()
      .openFile({ path: null, name: 'untitled-search-test.transnb', isModified: false, cells: [] })

    expect(useSearchStore.getState().keyword).toBe('')
    expect(useSearchStore.getState().highlightText).toBe('')
    expect(useSearchStore.getState().scrollToCellIndex).toBeNull()
  })

  it('进入检测模式时清空搜索会话并停止阅读计时器', () => {
    useSearchStore.getState().selectResult(1, 'word')
    useReadingTimerStore.setState({ running: true, elapsed: 65, notebookPath: '/tmp/article.transnb' })

    useRecitationStore.getState().activate()

    expect(useRecitationStore.getState().active).toBe(true)
    expect(useSearchStore.getState().highlightText).toBe('')
    expect(useReadingTimerStore.getState().running).toBe(false)
    expect(useReadingTimerStore.getState().elapsed).toBe(0)
  })
})
