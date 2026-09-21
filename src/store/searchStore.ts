import { create } from 'zustand'

// === v2.2 新增：搜索会话状态 ===
// 此前搜索状态被拆成两处：keyword/results/selectedIndex 在 SearchPanel 局部 state，
// highlightText/scrollToCellIndex 在 notebookStore。两者生命周期不一致：
// 进入检测时 SearchPanel 卸载丢失关键词，而全局高亮残留，返回阅读后出现
// 「搜索框已空却满屏高亮」。现统一收口到本 store，生命周期由 resetSearch() 单点管理。

export interface SearchResult {
  cellIndex: number
  matchedText: string
  matchCount: number
  contextSnippet: string
}

interface SearchStore {
  keyword: string
  results: SearchResult[]
  selectedIndex: number | null
  highlightText: string
  scrollToCellIndex: number | null
  setKeyword: (keyword: string) => void
  setResults: (results: SearchResult[]) => void
  selectResult: (cellIndex: number, matchedText: string) => void
  setScrollToCell: (index: number | null) => void
  clearHighlight: () => void
  resetSearch: () => void
}

export const useSearchStore = create<SearchStore>((set) => ({
  keyword: '',
  results: [],
  selectedIndex: null,
  highlightText: '',
  scrollToCellIndex: null,

  // 清空关键词时一并清除高亮（v2.0 文档所述「清空搜索自动清除」的实际补齐）
  setKeyword: (keyword) => set(keyword.trim() === '' ? { keyword, highlightText: '' } : { keyword }),

  setResults: (results) => set({ results, selectedIndex: null }),

  selectResult: (cellIndex, matchedText) =>
    set({ selectedIndex: cellIndex, scrollToCellIndex: cellIndex, highlightText: matchedText }),

  setScrollToCell: (index) => set({ scrollToCellIndex: index }),

  clearHighlight: () => set({ highlightText: '' }),

  resetSearch: () =>
    set({ keyword: '', results: [], selectedIndex: null, highlightText: '', scrollToCellIndex: null }),
}))
