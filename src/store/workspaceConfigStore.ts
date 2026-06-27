import { create } from 'zustand'
import { useWorkspaceStore } from './workspaceStore'

export interface WorkspaceConfigStore {
  bookmarkFilePath: string | null
  loaded: boolean
  load: () => Promise<void>
  setBookmarkFilePath: (path: string | null) => Promise<void>
}

export const useWorkspaceConfigStore = create<WorkspaceConfigStore>((set) => ({
  bookmarkFilePath: null,
  loaded: false,

  load: async () => {
    const api = window.electronAPI
    if (!api?.getWorkspaceConfig) return
    const ws = useWorkspaceStore.getState().workspacePath
    if (!ws) { set({ loaded: true }); return }
    try {
      const config = await api.getWorkspaceConfig(ws)
      set({ bookmarkFilePath: config.bookmarkFilePath ?? null, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  setBookmarkFilePath: async (path: string | null) => {
    const api = window.electronAPI
    if (!api?.setWorkspaceConfig) return
    const ws = useWorkspaceStore.getState().workspacePath
    if (!ws) return
    try {
      await api.setWorkspaceConfig(ws, 'bookmarkFilePath', path)
      set({ bookmarkFilePath: path })
    } catch {
      // ignore
    }
  },
}))
