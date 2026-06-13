import type { NotebookCell, NotebookFile, FileEntry } from '@/types/notebook'

export interface FileService {
  openFile(filePath?: string): Promise<void>
  saveFile(): Promise<boolean>
  saveFileAs(): Promise<boolean>
  importText(): Promise<void>
  createFile(name?: string): Promise<void>
  deleteFile(filePath: string): Promise<void>
  renameFile(oldPath: string, newName: string): Promise<void>
}

export interface CellService {
  insertBelow(): void
  insertAbove(): void
  deleteSelected(): void
  copyCell(index: number): void
  splitCell(index: number, beforeText: string, afterText: string): void
  mergeSelected(): void
  moveCell(from: number, to: number): void
  toggleCollapse(index: number): void
  toggleInputCollapse(index: number): void
  toggleOutputCollapse(index: number): void
  toggleInputCollapseAll(): void
  toggleOutputCollapseAll(): void
  toggleDependency(index: number): void
  setDependent(childIndex: number, parentIndex: number): void
  removeDependency(index: number): void
  updateContent(index: number, content: string): void
  updateOutput(index: number, output: string): void
}

export interface TranslationStatus {
  state: 'idle' | 'translating' | 'error'
  currentIndex: number
  totalCount: number
  progress: number
  error: string | null
  cellStates: Record<number, 'pending' | 'translating' | 'done' | 'error'>
  cellErrors: Record<number, string>
  currentContent?: string
}

export interface ProviderInfo {
  id: string
  name: string
  type: 'system' | 'custom'
  backend: string
}

export interface TranslationService {
  listProviders(): ProviderInfo[]
  setCurrentProvider(providerId: string): void
  translateCell(index: number): Promise<void>
  translateAll(): Promise<void>
  translateCells(indices: number[]): Promise<void>
  testConnection(providerId: string): Promise<{ success: boolean; error?: string }>
  getStatus(): TranslationStatus
  cancel(): void
  /** 预留接口：供背诵模块生成场景文章 */
  generateSceneText(words: string[], promptTemplate?: string): Promise<string>
}
