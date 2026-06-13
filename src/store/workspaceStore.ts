import { create } from 'zustand'
import type { FileEntry } from '@/types/notebook'

export interface WorkspaceStore {
  workspacePath: string | null
  workspaceFiles: FileEntry[]
  recentFiles: string[]
  sidebarActiveTab: string
  sidebarVisible: boolean
  panelVisible: boolean
  setWorkspace: (path: string | null) => void
  scanWorkspaceFiles: () => Promise<void>
  addRecentFile: (path: string) => void
  setSidebarTab: (tabId: string) => void
  toggleSidebar: () => void
  togglePanel: () => void
  refreshFiles: () => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspacePath: null,
  workspaceFiles: [],
  recentFiles: [],
  sidebarActiveTab: 'explorer',
  sidebarVisible: true,
  panelVisible: false,

  setWorkspace: (path) => {
    set({ workspacePath: path, workspaceFiles: [] })
    if (path) {
      get().scanWorkspaceFiles()
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

  addRecentFile: (path) =>
    set((state) => ({
      recentFiles: [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 10),
    })),

  setSidebarTab: (tabId) => set({ sidebarActiveTab: tabId }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  togglePanel: () => set((state) => ({ panelVisible: !state.panelVisible })),
  refreshFiles: () => get().scanWorkspaceFiles(),
}))
