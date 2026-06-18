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
  const refresh = () => loadWords(true)

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

  // 分页数据
  const totalPages = Math.max(1, Math.ceil(words.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageWords = useMemo(
    () => words.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [words, safePage]
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

        {/* 单词列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: colors.foreground, opacity: 0.5 }}>
              {t('wordManager.loading')}
            </div>
          ) : words.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: colors.foreground, opacity: 0.5 }}>
              {t('wordManager.empty')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* 表头 */}
              <div style={{
                display: 'flex', gap: 8, padding: '6px 8px', fontSize: 11,
                color: colors.foreground, opacity: 0.5, fontWeight: 600,
                borderBottom: `1px solid ${colors.border}`, textTransform: 'uppercase',
              }}>
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
        {words.length > PAGE_SIZE && (
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
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, words.length)} / {words.length}
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
