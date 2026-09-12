import { useState, useCallback, useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import { useRecitationService } from '@/hooks/useRecitationService'
import { useOutputStore } from '@/store/outputStore'
import { IconClose } from '@/components/icons'

interface ImportBookDialogProps {
  open: boolean
  onClose: () => void
  onImportComplete: () => void
}

// 预设源常量（与后端对应）
const PRESET_SOURCES = [
  { label: 'GitHub - KyleBing/english-vocabulary', owner: 'KyleBing', repo: 'english-vocabulary', path: 'json/', platform: 'github' as const },
  { label: 'Gitee - pradio/english-vocabulary', owner: 'pradio', repo: 'english-vocabulary', path: 'json/', platform: 'gitee' as const },
]

interface RemoteBookFile {
  name: string
  dir: string
  size: number | null
  downloadUrl: string
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return '1 KB'
  if (bytes < 1024 * 1024) return `${Math.floor(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** 解析自定义 URL 为 source 对象 */
function parseUrl(url: string): { label: string; owner: string; repo: string; path: string; platform: 'github' | 'gitee' } | null {
  const trimmed = url.trim().replace(/\/+$/, '')
  // GitHub: https://github.com/owner/repo 或 https://github.com/owner/repo/tree/main/path
  const githubMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/[^/]+\/(.+))?$/)
  if (githubMatch) {
    return {
      label: trimmed,
      owner: githubMatch[1],
      repo: githubMatch[2],
      path: githubMatch[3] ?? '',
      platform: 'github',
    }
  }
  // Gitee: https://gitee.com/owner/repo 或 https://gitee.com/owner/repo/tree/master/path
  const giteeMatch = trimmed.match(/gitee\.com\/([^/]+)\/([^/]+?)(?:\/tree\/[^/]+\/(.+))?$/)
  if (giteeMatch) {
    return {
      label: trimmed,
      owner: giteeMatch[1],
      repo: giteeMatch[2],
      path: giteeMatch[3] ?? '',
      platform: 'gitee',
    }
  }
  return null
}

export function ImportBookDialog({ open, onClose, onImportComplete }: ImportBookDialogProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const recitationService = useRecitationService()
  const addLog = useOutputStore((s) => s.addLog)

  const [activeTab, setActiveTab] = useState<'local' | 'remote'>('local')

  // Remote fetch state
  const [sourceType, setSourceType] = useState<'preset' | 'custom'>('preset')
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [customUrl, setCustomUrl] = useState('')
  const [bookList, setBookList] = useState<RemoteBookFile[]>([])
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState('')
  const [error, setError] = useState<string | null>(null)

  // 切换 tab 时重置状态
  const switchTab = (tab: 'local' | 'remote') => {
    setActiveTab(tab)
    setError(null)
    if (tab === 'remote') {
      setBookList([])
      setSelectedBooks(new Set())
      setImportStatus('')
    }
  }

  // 本地导入
  const handleLocalImport = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    const filePath = await api.openBookDialog()
    if (!filePath) return
    setError(null)
    const fileName = filePath.split(/[/\\]/).pop() || filePath
    addLog(`开始本地导入: ${fileName}`, 'info')
    const start = Date.now()
    try {
      await recitationService.importBook(filePath)
      addLog(`本地导入完成: ${fileName} (${Date.now() - start}ms)`, 'info', '#4caf50')
      onImportComplete()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || '导入失败')
      addLog(`本地导入失败: ${fileName} - ${msg || '未知错误'} (${Date.now() - start}ms)`, 'error')
    }
  }, [recitationService, onImportComplete, onClose, t, addLog])

  // 获取远程列表
  const handleFetch = useCallback(async () => {
    setError(null)
    setBookList([])
    setSelectedBooks(new Set())
    setImportStatus('')

    let source: { label: string; owner: string; repo: string; path: string; platform: 'github' | 'gitee' }

    if (sourceType === 'preset') {
      source = PRESET_SOURCES[selectedPreset]
    } else {
      const parsed = parseUrl(customUrl)
      if (!parsed) {
        setError('无法解析 URL，请提供有效的 GitHub 或 Gitee 仓库地址')
        return
      }
      source = parsed
    }

    setLoading(true)
    addLog(`获取词书列表: ${source.label} (${source.platform})`, 'info')
    const startTime = Date.now()
    try {
      const result = await recitationService.fetchRemoteBooks(source)
      const elapsed = Date.now() - startTime
      if (result.success && result.books) {
        setBookList(result.books)
        addLog(`获取词书列表完成: ${result.books.length} 个文件 (${elapsed}ms)`, 'info', '#4caf50')
      } else {
        setError(result.error || '获取列表失败')
        addLog(`获取词书列表失败: ${result.error || '未知错误'} (${elapsed}ms)`, 'error')
      }
    } catch (err) {
      const elapsed = Date.now() - startTime
      const msg = err instanceof Error ? err.message : String(err)
      setError('获取列表时发生错误')
      addLog(`获取词书列表异常: ${msg} (${elapsed}ms)`, 'error')
    } finally {
      setLoading(false)
    }
  }, [sourceType, selectedPreset, customUrl, recitationService])

  // 勾选/取消
  const toggleBook = (downloadUrl: string) => {
    setSelectedBooks(prev => {
      const next = new Set(prev)
      if (next.has(downloadUrl)) next.delete(downloadUrl)
      else next.add(downloadUrl)
      return next
    })
  }

  // 勾选/取消全部
  const toggleAll = () => {
    if (selectedBooks.size === bookList.length) {
      setSelectedBooks(new Set())
    } else {
      setSelectedBooks(new Set(bookList.map(b => b.downloadUrl)))
    }
  }

  // 按目录分组
  const groupedBooks = useMemo(() => {
    const groups = new Map<string, RemoteBookFile[]>()
    for (const file of bookList) {
      const list = groups.get(file.dir) || []
      list.push(file)
      groups.set(file.dir, list)
    }
    // 排序：根目录排前面，其他按目录名排
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === '') return -1
      if (b === '') return 1
      return a.localeCompare(b)
    })
  }, [bookList])

  // 批量导入
  const handleImport = useCallback(async () => {
    const selectedUrls = Array.from(selectedBooks)
    if (selectedUrls.length === 0) return

    setImporting(true)
    setError(null)
    const failedItems: string[] = []

    for (let i = 0; i < selectedUrls.length; i++) {
      const url = selectedUrls[i]
      const file = bookList.find(b => b.downloadUrl === url)
      if (!file) continue

      // 书名 = 去扩展名的文件名 + 目录标识，避免不同目录下同名文件（如 full/正序、simple/正序 的 雅思.jsonl）重名
      const baseName = file.name.replace(/\.[^.]+$/, '')
      const bookName = file.dir ? `${baseName} (${file.dir.replace(/\/+$/, '')})` : baseName

      setImportStatus(`正在导入 ${file.name} (${i + 1}/${selectedUrls.length})`)
      addLog(`开始导入: ${file.name} (${i + 1}/${selectedUrls.length})`, 'info')
      const importStart = Date.now()
      try {
        const result = await recitationService.importRemoteBook(file.downloadUrl, bookName)
        const elapsed = Date.now() - importStart
        if (!result.success) {
          failedItems.push(file.name)
          addLog(`导入失败: ${file.name} - ${result.error || '未知错误'} (${elapsed}ms)`, 'error')
        } else {
          addLog(`导入完成: ${file.name} (${elapsed}ms)`, 'info', '#4caf50')
        }
      } catch (err) {
        const elapsed = Date.now() - importStart
        const msg = err instanceof Error ? err.message : String(err)
        failedItems.push(file.name)
        addLog(`导入异常: ${file.name} - ${msg} (${elapsed}ms)`, 'error')
      }
    }

    setImporting(false)
    if (failedItems.length === 0) {
      onImportComplete()
      onClose()
    } else {
      setError(`以下文件导入失败：${failedItems.join('、')}`)
      setImportStatus('')
    }
  }, [selectedBooks, bookList, recitationService, onImportComplete, onClose])

  if (!open) return null

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: 13,
    border: 'none',
    background: 'none',
    color: active ? colors.foreground : `${colors.foreground}80`,
    cursor: 'pointer',
    borderBottom: active ? `2px solid ${colors.primaryButton}` : '2px solid transparent',
    fontWeight: active ? 600 : 400,
    transition: 'all 0.2s',
  })

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    backgroundColor: colors.inputBackground,
    color: colors.foreground,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    backgroundColor: colors.inputBackground,
    color: colors.foreground,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 4,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    fontSize: 13,
    border: 'none',
    borderRadius: 4,
    backgroundColor: colors.primaryButton,
    color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  })

  const secondaryBtnStyle: React.CSSProperties = {
    padding: '6px 16px',
    fontSize: 13,
    border: `1px solid ${colors.border}`,
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: colors.foreground,
    cursor: 'pointer',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          backgroundColor: colors.editorBackground,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* 标题栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: colors.foreground }}>
            导入词书
          </span>
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

        {/* Tab 切换 */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}`, marginBottom: 20 }}>
          <button style={tabButtonStyle(activeTab === 'local')} onClick={() => switchTab('local')}>
            本地导入
          </button>
          <button style={tabButtonStyle(activeTab === 'remote')} onClick={() => switchTab('remote')}>
            从远端获取
          </button>
        </div>

        {/* Tab 内容区 */}
        {activeTab === 'local' ? (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: colors.foreground, margin: '0 0 16px 0', lineHeight: 1.5 }}>
              从本地文件导入词书，支持 JSON 格式的词书文件。
            </p>
            <button
              onClick={handleLocalImport}
              style={primaryBtnStyle(false)}
            >
              选择文件
            </button>
            {error && (
              <p style={{ fontSize: 12, color: colors.errorText, marginTop: 8 }}>{error}</p>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            {/* 源选择器 */}
            <div style={{ display: 'flex', marginBottom: 12, gap: 12, alignItems: 'center' }}>
              <label style={{ fontSize: 13, color: colors.foreground, whiteSpace: 'nowrap' }}>
                源选择：
              </label>
              <label style={{ fontSize: 13, color: colors.foreground, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={sourceType === 'preset'}
                  onChange={() => setSourceType('preset')}
                />
                预设源
              </label>
              <label style={{ fontSize: 13, color: colors.foreground, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={sourceType === 'custom'}
                  onChange={() => setSourceType('custom')}
                />
                自定义
              </label>
            </div>

            {sourceType === 'preset' ? (
              <div style={{ marginBottom: 12 }}>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(Number(e.target.value))}
                  style={selectStyle}
                >
                  {PRESET_SOURCES.map((s, i) => (
                    <option key={i} value={i}>{s.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  style={inputStyle}
                />
              </div>
            )}

            {/* 获取列表按钮 */}
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={handleFetch}
                disabled={loading || (sourceType === 'custom' && !customUrl.trim())}
                style={primaryBtnStyle(loading || (sourceType === 'custom' && !customUrl.trim()))}
              >
                {loading ? '获取中...' : '获取列表'}
              </button>
            </div>

            {/* 错误信息 */}
            {error && (
              <p style={{ fontSize: 12, color: colors.errorText, marginBottom: 12 }}>{error}</p>
            )}

            {/* 空状态提示 */}
            {!loading && bookList.length === 0 && !error && (
              <p style={{ fontSize: 13, color: colors.foreground, opacity: 0.6, marginBottom: 12, textAlign: 'center', padding: 20 }}>
                该目录下没有 JSON / JSONL 词书文件
              </p>
            )}

            {/* 文件列表 */}
            {bookList.length > 0 && (
              <>
                <div style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 4,
                  maxHeight: 320,
                  overflowY: 'auto',
                  marginBottom: 12,
                }}>
                  {/* 表头 - 全选 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderBottom: `1px solid ${colors.border}`,
                    backgroundColor: colors.inputBackground,
                    fontSize: 13,
                    color: colors.foreground,
                    fontWeight: 600,
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginRight: 12 }}>
                      <input
                        type="checkbox"
                        checked={selectedBooks.size === bookList.length && bookList.length > 0}
                        ref={(el) => { if (el) el.indeterminate = selectedBooks.size > 0 && selectedBooks.size < bookList.length }}
                        onChange={toggleAll}
                      />
                      全选 ({bookList.length})
                    </label>
                  </div>

                  {/* 按目录分组 */}
                  {groupedBooks.map(([dir, files]) => (
                    <div key={dir || '/'}>
                      {/* 目录标题 */}
                      <div style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        color: `${colors.foreground}99`,
                        backgroundColor: colors.editorBackground,
                        borderBottom: `1px solid ${colors.border}`,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        {dir || '/'}
                      </div>

                      {/* 该目录下的文件列表 */}
                      {files.map((file) => (
                        <div
                          key={file.downloadUrl}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '5px 10px',
                            borderBottom: `1px solid ${colors.border}`,
                            fontSize: 13,
                            color: colors.foreground,
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                          onClick={() => toggleBook(file.downloadUrl)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedBooks.has(file.downloadUrl)}
                            onChange={() => toggleBook(file.downloadUrl)}
                            style={{ marginRight: 10 }}
                          />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.name}
                          </span>
                          <span style={{ flexShrink: 0, color: `${colors.foreground}99`, fontSize: 12, marginLeft: 12 }}>
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* 底部操作栏 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: colors.foreground }}>
                    已选 {selectedBooks.size} 个文件
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {importStatus && (
                      <span style={{ fontSize: 12, color: colors.foreground }}>{importStatus}</span>
                    )}
                    <button
                      onClick={handleImport}
                      disabled={importing || selectedBooks.size === 0}
                      style={primaryBtnStyle(importing || selectedBooks.size === 0)}
                    >
                      {importing ? '导入中...' : '导入选中'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 底部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={secondaryBtnStyle}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
