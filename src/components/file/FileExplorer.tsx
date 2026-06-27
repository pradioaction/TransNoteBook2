import { useState, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useNotebookStore } from '@/store/notebookStore'
import { useTheme } from '@/hooks/useTheme'
import { useFileService } from '@/hooks/useFileService'
import type { FileEntry } from '@/types/notebook'
import { ImportDialog } from '@/components/import/ImportDialog'
import { IconFolder, IconFolderOpen, IconFile, IconChevronRight, IconChevronDown, IconImport, IconRefresh, IconEdit, IconClose, IconDot, IconSave, IconSearch } from '@/components/icons'
import { useTranslation } from 'react-i18next'
import { useWorkspaceConfigStore } from '@/store/workspaceConfigStore'
import { useOutputStore } from '@/store/outputStore'
import { IconStar } from '@/components/icons'

export function FileExplorer() {
  const {
    workspacePath, workspaceFiles, setWorkspace, refreshFiles,
  } = useWorkspaceStore()
  const {
    openFiles, activeFilePath, notebook, switchToFile, closeFile, openFile,
    setModified, setFilePath,
  } = useNotebookStore()
  const { colors } = useTheme()
  const { t } = useTranslation()
  const fileService = useFileService()

  const bookmarkFilePath = useWorkspaceConfigStore((s) => s.bookmarkFilePath)
  const loadConfig = useWorkspaceConfigStore((s) => s.load)
  const setBookmarkFilePath = useWorkspaceConfigStore((s) => s.setBookmarkFilePath)

  const [collapsedEditors, setCollapsedEditors] = useState(false)
  const [collapsedWorkspace, setCollapsedWorkspace] = useState(false)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [loadedDirs, setLoadedDirs] = useState<Map<string, FileEntry[]>>(new Map())
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; entry: FileEntry
  } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const openEditors = [...openFiles.entries()]

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return
    const folder = await window.electronAPI.openFolderDialog()
    if (folder) setWorkspace(folder)
  }

  const loadDirChildren = useCallback(async (dirPath: string) => {
    if (!window.electronAPI) return
    if (loadedDirs.has(dirPath)) return
    const entries = await window.electronAPI.readDirectory(dirPath)
    setLoadedDirs((prev) => {
      const next = new Map(prev)
      next.set(dirPath, entries)
      return next
    })
  }, [loadedDirs])

  const handleOpenFile = useCallback(
    async (filePath: string) => {
      await fileService.openFile(filePath)
    },
    [fileService]
  )

  const handleNewFile = async () => {
    await fileService.createFile()
  }

  const handleSave = async () => {
    await fileService.saveFile()
  }

  const handleSaveAs = async () => {
    await fileService.saveFileAs()
  }

  const handleImportText = async () => {
    setImportOpen(true)
  }

  const handleRename = async () => {
    if (!renaming) return
    const entry = workspaceFiles.find((f) => f.path === renaming)
    if (!entry) return
    await fileService.renameFile(entry.path, renameValue)
    setRenaming(null)
  }

  const handleDelete = async (entry: FileEntry) => {
    await fileService.deleteFile(entry.path)
  }

  const handleSetBookmark = async (entry: FileEntry) => {
    const normalized = entry.path.replace(/\\/g, '/')
    await setBookmarkFilePath(normalized)
    useOutputStore.getState().addLog('📌 已将 "' + entry.name + '" 设为收藏夹', 'info', '#4caf50')
  }

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) next.delete(dirPath)
      else next.add(dirPath)
      return next
    })
    loadDirChildren(dirPath)
  }

  useEffect(() => {
    const ws = useWorkspaceStore.getState().workspacePath
    if (!ws) {
      const last = localStorage.getItem('tsbook2_last_workspace')
      if (last) setWorkspace(last)
    }
  }, [setWorkspace])

  useEffect(() => {
    if (workspacePath) localStorage.setItem('tsbook2_last_workspace', workspacePath)
  }, [workspacePath])

  useEffect(() => { loadConfig() }, [loadConfig])

  const sectionStyle: React.CSSProperties = {
    padding: '4px 12px',
    fontSize: 11,
    fontWeight: 700,
    color: '#999',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none',
  }

  const actionBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: '#999',
    cursor: 'pointer', fontSize: 13, padding: '0 4px', lineHeight: 1,
  }

  const itemStyle = (active: boolean): React.CSSProperties => ({
    padding: '2px 24px 2px 36px',
    fontSize: 13, cursor: 'pointer',
    color: active ? '#fff' : colors.foreground,
    backgroundColor: active ? colors.listItemSelected : 'transparent',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    display: 'flex', alignItems: 'center', gap: 6,
    userSelect: 'none',
  })

  const renderFileEntry = (entry: FileEntry, depth: number, isActive: boolean) => {
    const isDir = entry.isDirectory
    const isExpanded = expandedDirs.has(entry.path)
    const children = loadedDirs.get(entry.path)
    const padLeft = 36 + depth * 16

    return (
      <div key={entry.path}>
        <div
          style={{
            ...itemStyle(isActive),
            paddingLeft: padLeft,
          }}
          onClick={() => {
            if (isDir) toggleDir(entry.path)
            else handleOpenFile(entry.path)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            if (!isDir) setContextMenu({ x: e.clientX, y: e.clientY, entry })
          }}
        >
          <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
            {isDir ? (isExpanded ? <IconFolderOpen size={14} /> : <IconFolder size={14} />) : (
              entry.path.replace(/\\/g, '/') === bookmarkFilePath
                ? <IconStar size={14} style={{ color: '#e4b400' }} />
                : <IconFile size={14} />
            )}
          </span>
          {renaming === entry.path ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setRenaming(null)
              }}
              onBlur={() => setRenaming(null)}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                background: colors.inputBackground,
                color: colors.foreground,
                border: `1px solid ${colors.primaryButton}`,
                borderRadius: 2,
                padding: '1px 4px',
                fontSize: 12,
                outline: 'none',
              }}
            />
          ) : (
            <span>{entry.name}</span>
          )}
        </div>
        {isDir && isExpanded && children && children.map((child: FileEntry) =>
          renderFileEntry(child, depth + 1, false)
        )}
        {isDir && isExpanded && (!children || children.length === 0) && (
          <div style={{ paddingLeft: padLeft + 16, fontSize: 11, color: '#666', paddingTop: 2, paddingBottom: 2 }}>
            (empty)
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: colors.foreground, backgroundColor: colors.sidebarBackground }}
      onClick={() => setContextMenu(null)}
    >
      <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#999', backgroundColor: colors.sidebarHeader, borderBottom: `1px solid ${colors.sidebarBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Explorer</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={handleNewFile} title={t('fileExplorer.newFile')} style={actionBtn}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><IconFile size={14} /></span></button>
          <button onClick={handleImportText} title={t('fileExplorer.importText')} style={actionBtn}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><IconImport size={14} /></span></button>
          <button onClick={() => refreshFiles()} title={t('fileExplorer.refresh')} style={actionBtn}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><IconRefresh size={14} /></span></button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        <div style={sectionStyle} onClick={() => setCollapsedEditors(!collapsedEditors)}>
          <span><span style={{ display: 'inline-flex', verticalAlign: 'middle', fontSize: 10 }}>{collapsedEditors ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}</span> {t('fileExplorer.openEditors')}</span>
          <span style={{ fontSize: 10, fontWeight: 400 }}>{openEditors.length}</span>
        </div>
        {!collapsedEditors && (openEditors.length > 0 ? (
          openEditors.map(([key, file]) => {
            const isActive = key === activeFilePath
            return (
              <div key={key}
                style={itemStyle(isActive)}
                onClick={() => switchToFile(key)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  closeFile(key)
                }}
                title={file.path || file.name}
              >
                <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><IconEdit size={14} /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}{file.isModified ? <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><IconDot size={10} /></span> : ''}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); closeFile(key) }}
                  style={{ cursor: 'pointer', opacity: 0.5, fontSize: 14, padding: '0 2px' }}
                  title={t('fileExplorer.close')}
                ><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><IconClose size={12} /></span></span>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '2px 24px', fontSize: 13, color: colors.foreground, opacity: 0.5, fontStyle: 'italic' }}>
            {t('fileExplorer.noFiles')}
          </div>
        ))}

        <div style={{ ...sectionStyle, marginTop: 12 }} onClick={() => setCollapsedWorkspace(!collapsedWorkspace)}>
          <span><span style={{ display: 'inline-flex', verticalAlign: 'middle', fontSize: 10 }}>{collapsedWorkspace ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}</span> {t('fileExplorer.workspace')}</span>
          <button onClick={(e) => { e.stopPropagation(); handleSelectFolder() }} title={t('fileExplorer.openFolder')} style={actionBtn}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><IconFolderOpen size={14} /></span></button>
        </div>

        {!collapsedWorkspace && (!workspacePath ? (
          <div style={{ padding: '16px 24px', fontSize: 12, color: '#999', textAlign: 'center' }}>
            <div style={{ marginBottom: 8 }}>{t('fileExplorer.noWorkspace')}</div>
            <button onClick={handleSelectFolder} style={{ padding: '4px 12px', fontSize: 12, backgroundColor: colors.primaryButton, color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
              {t('fileExplorer.openFolder')}
            </button>
          </div>
        ) : workspaceFiles.length === 0 ? (
          <div style={{ padding: '16px 24px', fontSize: 12, color: '#999', textAlign: 'center' }}>
            <div style={{ marginBottom: 4, fontSize: 11 }} title={workspacePath}>
              <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}><IconFolder size={14} /></span> {workspacePath.split(/[/\\]/).pop()}
            </div>
            <div style={{ marginBottom: 8 }}>{t('fileExplorer.noTransnbFiles')}</div>
            <button onClick={handleNewFile} style={{ padding: '4px 12px', fontSize: 12, backgroundColor: colors.primaryButton, color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
              + New File
            </button>
          </div>
        ) : (
          <>
            <div style={{ padding: '4px 12px', fontSize: 11, color: '#999' }} title={workspacePath}>
              <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}><IconFolder size={14} /></span> {workspacePath.split(/[/\\]/).pop()}
            </div>
            {workspaceFiles.map((entry) => renderFileEntry(entry, 0, notebook?.path === entry.path))}
          </>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${colors.sidebarBorder}`, padding: '6px 12px', fontSize: 11, color: '#999', display: 'flex', justifyContent: 'space-between' }}>
        <span>{t('fileExplorer.cellCount', { count: notebook?.cells.length ?? 0 })}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} style={{ ...actionBtn, fontSize: 11 }} title="Save (Ctrl+S)"><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><IconSave size={14} /></span></button>
          <button onClick={handleSaveAs} style={{ ...actionBtn, fontSize: 11 }} title="Save As">Save As</button>
        </div>
      </div>

      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000,
            backgroundColor: colors.editorBackground,
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minWidth: 120,
          }}
        >
          <div
            style={{ padding: '6px 16px', fontSize: 12, cursor: 'pointer', color: colors.foreground }}
            onClick={() => {
              setRenaming(contextMenu.entry.path)
              setRenameValue(contextMenu.entry.name)
              setContextMenu(null)
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.listItemHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >Rename</div>
          <div style={{ height: 1, backgroundColor: colors.border, margin: '4px 0' }} />
          <div
            style={{ padding: '6px 16px', fontSize: 12, cursor: 'pointer', color: '#e4b400' }}
            onClick={() => {
              handleSetBookmark(contextMenu.entry)
              setContextMenu(null)
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.listItemHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            ★ 设为收藏夹
          </div>
          <div
            style={{ padding: '6px 16px', fontSize: 12, cursor: 'pointer', color: '#e06c75' }}
            onClick={() => {
              handleDelete(contextMenu.entry)
              setContextMenu(null)
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.listItemHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >Delete</div>
        </div>
      )}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(result) => {
          setImportOpen(false)
          fileService.saveImportAsTransnb(result)
        }}
      />
    </div>
  )
}
