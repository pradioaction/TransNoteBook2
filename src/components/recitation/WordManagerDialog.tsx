import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { ThemeConfig } from '@/types/notebook'
import { useTheme } from '@/hooks/useTheme'
import { useRecitationService } from '@/hooks/useRecitationService'
import { WordEditorDialog } from './WordEditorDialog'
import type { Word, StageFilter } from '@/recitation/types'
import { IconClose } from '@/components/icons'
import { useTranslation } from 'react-i18next'

interface WordManagerDialogProps {
  bookId: number
  bookName: string
  onClose: () => void
  stageFilter?: StageFilter
}

// 模块级缓存：bookId → { words, timestamp }（stage filter 不缓存）
const CACHE_TTL = 30_000 // 30 秒
const wordCache = new Map<number, { words: Word[]; timestamp: number }>()

const PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 200

export function WordManagerDialog({ bookId, bookName, onClose, stageFilter }: WordManagerDialogProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const recitationService = useRecitationService()
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<Word | null>(null)
  const [page, setPage] = useState(0)
  const pageRef = useRef(page)
  pageRef.current = page
  const [searchKeyword, setSearchKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const selectAllRef = useRef<HTMLInputElement>(null)

  // 当 stageFilter 变化时重置搜索关键字
  useEffect(() => {
    setSearchKeyword('')
    setDebouncedKeyword('')
  }, [stageFilter])

  // 200ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(searchKeyword)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchKeyword])

  // 搜索过滤
  const filteredWords = useMemo(() => {
    if (!debouncedKeyword.trim()) return words
    const kw = debouncedKeyword.toLowerCase().trim()
    return words.filter(
      (w) =>
        w.word.toLowerCase().includes(kw) ||
        (w.definition && w.definition.toLowerCase().includes(kw))
    )
  }, [words, debouncedKeyword])

  const loadWords = useCallback(async (force = false) => {
    // stage filter 模式不使用缓存
    if (stageFilter) {
      setLoading(true)
      try {
        let list: Word[]
        if (stageFilter.min === -1 && stageFilter.max === -1) {
          // "未学"阶段：不在 user_study 中的单词
          list = await recitationService.getUnstudiedWords(bookId) as Word[]
        } else {
          list = await recitationService.getWordsByStage(bookId, stageFilter.min, stageFilter.max) as Word[]
        }
        setWords(list)
        const maxPage = Math.max(0, Math.ceil(list.length / PAGE_SIZE) - 1)
        if (pageRef.current > maxPage) setPage(maxPage)
      } catch {
        console.error('加载阶段单词失败')
      } finally {
        setLoading(false)
      }
      return
    }

    const cached = wordCache.get(bookId)
    if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setWords(cached.words)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const list = await recitationService.getWordsByBook(bookId)
      const wordList = list as Word[]
      wordCache.set(bookId, { words: wordList, timestamp: Date.now() })
      setWords(wordList)
      // 如果当前页超出新总数，回退到最后一页
      const maxPage = Math.max(0, Math.ceil(wordList.length / PAGE_SIZE) - 1)
      if (pageRef.current > maxPage) setPage(maxPage)
    } catch {
      console.error('加载单词失败')
    } finally {
      setLoading(false)
    }
  }, [recitationService, bookId, stageFilter])

  useEffect(() => {
    loadWords()
  }, [loadWords])

  // 刷新时跳过缓存
  const refresh = () => {
    setSelectedIds(new Set())
    loadWords(true)
  }

  const handleAdd = () => {
    setEditingWord(null)
    setEditorOpen(true)
  }

  const handleEdit = (word: Word) => {
    setEditingWord(word)
    setEditorOpen(true)
  }

  const handleEditorClose = (saved?: boolean) => {
    setEditorOpen(false)
    setEditingWord(null)
    if (saved) {
      wordCache.delete(bookId) // 清除缓存让下次加载重新获取
      refresh()
    }
  }

  const handleDelete = async (wordId: number) => {
    try {
      await recitationService.deleteWord(wordId)
      wordCache.delete(bookId)
      refresh()
    } catch {
      console.error('删除单词失败')
    }
  }

  const handleDoubleClick = (word: Word) => {
    handleEdit(word)
  }

  // 切换单个单词选中状态
  const toggleSelect = (wordId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(wordId)) {
        next.delete(wordId)
      } else {
        next.add(wordId)
      }
      return next
    })
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    const allSelected = filteredWords.every((w) => w.id != null && selectedIds.has(w.id))
    if (allSelected) {
      // 取消全选
      setSelectedIds(new Set())
    } else {
      // 全选
      setSelectedIds(new Set(filteredWords.map((w) => w.id!).filter((id) => id != null)))
    }
  }

  // 表头复选框 indeterminate 状态
  const allFilteredSelected = filteredWords.length > 0 && filteredWords.every((w) => w.id != null && selectedIds.has(w.id))
  const someFilteredSelected = filteredWords.some((w) => w.id != null && selectedIds.has(w.id))
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected
    }
  }, [someFilteredSelected, allFilteredSelected])

  // 批量删除
  const handleBatchDelete = async () => {
    const selectedCount = selectedIds.size
    if (selectedCount === 0) return
    const confirmed = confirm(t('wordManager.confirmBatchDelete', { count: selectedCount }))
    if (!confirmed) return
    try {
      await recitationService.batchDeleteWords(bookId, Array.from(selectedIds))
      setSelectedIds(new Set())
      wordCache.delete(bookId)
      refresh()
    } catch {
      console.error('批量删除单词失败')
    }
  }

  // 分页数据（基于过滤后的单词列表）
  const totalPages = Math.max(1, Math.ceil(filteredWords.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageWords = useMemo(
    () => filteredWords.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [filteredWords, safePage]
  )

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '70vw', maxWidth: 900,
          height: '80vh',
          backgroundColor: colors.editorBackground,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* 标题栏 */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.border}`,
          fontSize: 14, fontWeight: 600, color: colors.foreground,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span>{t('wordManager.title', { bookName: stageFilter ? `${bookName} - ${stageFilter.label}` : bookName, count: words.length })}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={refresh}
              style={{
                padding: '4px 10px', fontSize: 12, border: `1px solid ${colors.border}`, borderRadius: 4,
                backgroundColor: 'transparent', color: colors.foreground, cursor: 'pointer',
              }}
            >
              {t('wordManager.refresh')}
            </button>
            <button
              onClick={handleAdd}
              style={{
                padding: '4px 12px', fontSize: 12, border: 'none', borderRadius: 4,
                backgroundColor: colors.primaryButton, color: '#fff', cursor: 'pointer',
              }}
            >
              {t('wordManager.addWord')}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchDelete}
                style={{
                  padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 4,
                  backgroundColor: 'transparent', color: colors.errorText, cursor: 'pointer',
                }}
              >
                {t('wordManager.batchDelete', { count: selectedIds.size })}
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: colors.foreground,
                cursor: 'pointer', fontSize: 16, padding: '0 4px', display: 'inline-flex', alignItems: 'center',
              }}
            >
              <IconClose size={14} />
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        <div style={{
          padding: '8px 12px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0,
        }}>
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value)
              setPage(0)
            }}
            placeholder={t('wordManager.searchPlaceholder')}
            style={{
              width: '100%', padding: '6px 8px', fontSize: 13, boxSizing: 'border-box',
              backgroundColor: colors.inputBackground, color: colors.foreground,
              border: `1px solid ${colors.inputBorder}`, borderRadius: 3,
              outline: 'none',
            }}
          />
        </div>

        {/* 单词列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: colors.foreground, opacity: 0.5 }}>
              {t('wordManager.loading')}
            </div>
          ) : filteredWords.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: colors.foreground, opacity: 0.5 }}>
              {debouncedKeyword ? t('wordManager.noSearchResults') : t('wordManager.empty')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* 表头 */}
              <div style={{
                display: 'flex', gap: 8, padding: '6px 8px', fontSize: 11,
                color: colors.foreground, opacity: 0.5, fontWeight: 600,
                borderBottom: `1px solid ${colors.border}`, textTransform: 'uppercase',
                alignItems: 'center',
              }}>
                <span style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', margin: 0 }}
                  />
                </span>
                <span style={{ width: 130 }}>{t('wordManager.colEnglish')}</span>
                <span style={{ width: 100 }}>{t('wordManager.colPhonetic')}</span>
                <span style={{ width: 150 }}>{t('wordManager.colDefinition')}</span>
                <span style={{ flex: 1 }}>{t('wordManager.colExample')}</span>
                <span style={{ width: 80, textAlign: 'right' }}>{t('wordManager.colActions')}</span>
              </div>
              {pageWords.map((w) => (
                <div
                  key={w.id}
                  onDoubleClick={() => handleDoubleClick(w)}
                  style={{
                    display: 'flex', gap: 8, padding: '6px 8px', fontSize: 13,
                    color: colors.foreground, alignItems: 'center',
                    borderRadius: 3, cursor: 'pointer',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.listItemHover }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <span style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={w.id != null && selectedIds.has(w.id)}
                      onChange={() => { if (w.id != null) toggleSelect(w.id) }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', margin: 0 }}
                    />
                  </span>
                  <span style={{ width: 130, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.word}</span>
                  <span style={{ width: 100, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.phonetic || '-'}</span>
                  <span style={{ width: 150, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.definition || '-'}</span>
                  <span style={{ flex: 1, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {w.example || ''}
                  </span>
                  <div style={{ width: 80, display: 'flex', gap: 4, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(w) }}
                      style={{
                        padding: '2px 8px', fontSize: 11,
                        border: `1px solid ${colors.border}`, borderRadius: 3,
                        backgroundColor: 'transparent', color: colors.foreground,
                        cursor: 'pointer',
                      }}
                    >
                      {t('wordManager.edit')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(w.id!) }}
                      style={{
                        padding: '2px 8px', fontSize: 11, border: 'none', borderRadius: 3,
                        backgroundColor: 'transparent', color: colors.errorText,
                        cursor: 'pointer',
                      }}
                    >
                      {t('wordManager.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 分页栏 */}
        {filteredWords.length > PAGE_SIZE && (
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderTop: `1px solid ${colors.border}`,
            flexShrink: 0, fontSize: 12, color: colors.foreground,
          }}>
            <PageButton
              label="‹"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              colors={colors}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={safePage + 1}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (v >= 1 && v <= totalPages) setPage(v - 1)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget
                    const v = parseInt(input.value, 10)
                    if (v >= 1 && v <= totalPages) setPage(v - 1)
                    else input.value = String(safePage + 1)
                  }
                }}
                style={{
                  width: 40, padding: '2px 4px', fontSize: 12, textAlign: 'center',
                  backgroundColor: colors.inputBackground, color: colors.foreground,
                  border: `1px solid ${colors.inputBorder}`, borderRadius: 3,
                  outline: 'none',
                }}
              />
              <span style={{ opacity: 0.6 }}>{t('wordManager.pageOf', { total: totalPages })}</span>
            </span>
            <PageButton
              label="›"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
              colors={colors}
            />
            <span style={{ opacity: 0.5, marginLeft: 8 }}>
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredWords.length)} / {filteredWords.length}
            </span>
          </div>
        )}

        {/* 底部提示 */}
        <div style={{
          padding: '6px 16px', fontSize: 11, color: colors.foreground, opacity: 0.4,
          borderTop: `1px solid ${colors.border}`, flexShrink: 0,
        }}>
          {t('wordManager.footerHint', { pageSize: PAGE_SIZE, total: words.length })}
        </div>
      </div>

      {/* WordEditorDialog */}
      {editorOpen && (
        <WordEditorDialog
          mode={editingWord ? 'edit' : 'add'}
          bookId={bookId}
          wordData={editingWord ?? undefined}
          onClose={handleEditorClose}
        />
      )}
    </div>
  )
}

function PageButton({
  label, active, disabled, onClick, colors,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  colors: ThemeConfig
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 26, height: 26, padding: '0 6px',
        fontSize: 12,
        border: active ? 'none' : `1px solid ${colors.border}`,
        borderRadius: 3,
        backgroundColor: active ? colors.primaryButton : 'transparent',
        color: active ? '#fff' : colors.foreground,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}
