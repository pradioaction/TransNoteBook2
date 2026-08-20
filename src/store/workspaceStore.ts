import { create } from 'zustand'
import type { FileEntry } from '@/types/notebook'
import { createRecitationService } from '@/services/recitationService'
import type { RecitationService } from '@/services/types'

let _recitationService: RecitationService | null = null

function getRecitationService(): RecitationService {
  if (!_recitationService) {
    _recitationService = createRecitationService()
  }
  return _recitationService
}

export interface WorkspaceStore {
  workspacePath: string | null
  workspaceFiles: FileEntry[]
  sidebarActiveTab: string
  sidebarVisible: boolean
  sidebarWidth: number
  panelVisible: boolean
  setWorkspace: (path: string | null) => void
  scanWorkspaceFiles: () => Promise<void>
  setSidebarTab: (tabId: string) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  togglePanel: () => void
  refreshFiles: () => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspacePath: null,
  workspaceFiles: [],
  sidebarActiveTab: 'explorer',
  sidebarVisible: true,
  sidebarWidth: 280,
  panelVisible: false,

  setWorkspace: (path) => {
    set({ workspacePath: path, workspaceFiles: [] })
    if (path) {
      get().scanWorkspaceFiles()
      // 工作区加载后立即尝试初始化背诵数据库（无需等待首次点击）
      getRecitationService().init(path).catch((err) => {
        console.error('[Recitation] 工作区加载后自动初始化数据库失败:', err)
      })
    }
  },

  scanWorkspaceFiles: async () => {
    const { workspacePath } = get()
    if (!workspacePath || !window.electronAPI) {
      set({ workspaceFiles: [] })
      return
    }
    try {
      const files = await window.electronAPI.readDirectory(workspacePath)
      set({ workspaceFiles: files })
    } catch {
      set({ workspaceFiles: [] })
    }
  },

  setSidebarTab: (tabId) => set({ sidebarActiveTab: tabId }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  togglePanel: () => set((state) => ({ panelVisible: !state.panelVisible })),
  refreshFiles: () => get().scanWorkspaceFiles(),
}))
